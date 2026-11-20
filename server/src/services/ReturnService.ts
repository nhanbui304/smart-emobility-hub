// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import type { VehicleStatus, VehicleTechStatus } from "../constants";
import type { Trip } from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import { hubRepository } from "../repositories/HubRepository";
import { operationalRepository } from "../repositories/OperationalRepository";
import { findCurrentTrip } from "../repositories/operational/returnOps";
import { vehicleSimulator } from "../simulator/VehicleSimulator";
import type {
  CurrentTripInfo,
  HubReturnContext,
  LockResult,
  OperatorAlert,
  ReturnPreparation,
  ReturnResult,
  ReturnSlotPlan,
  VehiclePosition,
} from "../types/dto";
import { hubService } from "./HubService";
import { notificationService } from "./NotificationService";

/** Số lần chọn lại chỗ khi chỗ vừa bị phân bổ cho yêu cầu khác (Ext 4a). */
const MAX_ALLOCATE_ATTEMPTS = 3;

export const returnService = {
  /** UC05 bước 1–4: kiểm tra chuyến đi, Hub tiếp nhận, phân bổ vị trí và trả hướng dẫn đỗ xe. */
  async prepareReturn(requestId: string, studentId: string, tripId: string, hubId: string): Promise<ReturnPreparation> {
    const trip = operationalRepository.findTripForReturn(tripId);
    if (!trip || !validateTripForReturn(trip, studentId)) {
      throw new AppError("NOT_FOUND", "Không tìm thấy chuyến đi của bạn.");
    }
    if (trip.status === "ENDED") throw new AppError("CONFLICT", "Chuyến đi đã kết thúc, xe đã được trả.");
    if (trip.status === "PENDING_RECONCILIATION") {
      throw new AppError("CONFLICT", "Lượt trả xe đang chờ Operator đối soát. Vui lòng liên hệ Operator.");
    }

    for (let attempt = 1; ; attempt++) {
      const context = operationalRepository.queryHubReturnContext(hubId, trip.vehicleId, studentId, new Date());
      if (!context.accepting || (!context.confirmedBooking && context.availableSlots.length === 0)) {
        // Ext 3a: gợi ý Hub khác còn chỗ; chuyến đi chưa kết thúc
        const alternativeHubs = hubService
          .getAllHubStatuses()
          .filter((h) => h.id !== hubId && h.freeSlots > 0)
          .map((h) => ({ id: h.id, name: h.name, freeSlots: h.freeSlots }));
        throw new AppError("CONFLICT", "Hub này hiện không còn chỗ phù hợp. Vui lòng chọn Hub khác.", {
          alternativeHubs,
        });
      }
      const slotPlan = selectReturnSlot(context);
      try {
        const { trip: updatedTrip, allocation } = db.transaction(() =>
          operationalRepository.atomicAllocateReturnSlot(requestId, tripId, hubId, slotPlan),
        );
        const slotCode = hubRepository.listSlots().find((s) => s.id === allocation.slotId)?.code ?? "";
        return { trip: updatedTrip, allocation, slotCode };
      } catch (err) {
        const slotTaken =
          err instanceof AppError && (err.details as { code?: string } | undefined)?.code === "SLOT_TAKEN";
        if (!slotTaken || attempt >= MAX_ALLOCATE_ATTEMPTS) throw err;
      }
    }
  },

  /**
   * UC05 bước 5–9: kiểm tra xe đỗ đúng Hub, đúng vị trí → gửi lệnh khóa (NGOÀI transaction) → cập nhật theo kết quả.
   * SUCCESS: atomicCompleteReturn · FAILED: recordLockFailure, cho thử lại (Ext 7a) ·
   * UNKNOWN: markPendingVerification + báo Operator (Ext 7b).
   */
  async confirmReturn(requestId: string, studentId: string, tripId: string): Promise<ReturnResult> {
    const trip = operationalRepository.findTripForReturn(tripId);
    if (!trip || !validateTripForReturn(trip, studentId)) {
      throw new AppError("NOT_FOUND", "Không tìm thấy chuyến đi của bạn.");
    }
    // Ext 6b, 2b: gửi lặp hoặc đã trả xong → trả lại kết quả đã ghi, không gửi lệnh khóa lần nữa
    const done = operationalRepository.findProcessedRequest(requestId);
    if (done) {
      if (done.actorId !== studentId || done.operation !== "CONFIRM_RETURN" || done.resultId !== tripId) {
        throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho thao tác khác, vui lòng thử lại.");
      }
      return resultOf(trip, "SUCCESS");
    }
    if (trip.status === "ENDED") return resultOf(trip, "SUCCESS");
    if (trip.status === "PENDING_RECONCILIATION") return resultOf(trip, "UNKNOWN");

    const handover = operationalRepository.findReturnHandoverContext(tripId, studentId);
    if (!handover) throw new AppError("CONFLICT", "Bạn chưa chọn Hub trả xe. Hãy chọn Hub để nhận vị trí đỗ.");

    // Ext 6a: xe đỗ sai Hub hoặc sai vị trí
    const position = vehicleSimulator.readVehiclePosition(handover.vehicleId);
    if (!position || !verifyVehicleHubAndSlot(position, handover.hubId, handover.slotId)) {
      throw new AppError("CONFLICT", "Xe chưa ở đúng vị trí được chỉ định. Vui lòng đưa xe vào đúng vị trí rồi thử lại.");
    }

    operationalRepository.markHandoverInProgress(requestId, tripId, handover.vehicleId, handover.slotId);
    // Mất liên lạc với thiết bị coi như chưa rõ kết quả khóa (Ext 7b)
    const lock = await vehicleSimulator
      .sendLockCommand(handover.vehicleId)
      .catch((): LockResult => ({ status: "UNKNOWN", techStatus: "UNKNOWN" }));

    if (lock.status === "FAILED") {
      operationalRepository.recordLockFailure(requestId, tripId);
      return resultOf(operationalRepository.findTripForReturn(tripId)!, "FAILED");
    }
    if (lock.status === "UNKNOWN") {
      const pending = operationalRepository.markPendingVerification(tripId, handover.vehicleId, handover.slotId);
      await alertOperator({
        alertType: "RETURN_LOCK_UNKNOWN",
        message: "Chưa xác định được kết quả khóa xe khi trả, cần xác minh.",
        tripId,
        vehicleId: handover.vehicleId,
        hubId: handover.hubId,
        slotId: handover.slotId,
      });
      return resultOf(pending, "UNKNOWN");
    }

    const returnedAt = new Date();
    const serviceStatus = determineVehicleServiceStatus(lock.batteryLevel ?? -1, lock.techStatus);
    try {
      const ended = db.transaction(() =>
        operationalRepository.atomicCompleteReturn(
          requestId,
          tripId,
          handover.vehicleId,
          handover.slotId,
          returnedAt,
          handover.bookingId,
          serviceStatus,
        ),
      );
      return resultOf(ended, "SUCCESS");
    } catch (err) {
      // Ext 8a: đã bàn giao nhưng lỗi ghi nhận → lưu để đối soát, báo Operator, không cấp xe cho người khác
      console.error("[UC05] Lỗi ghi nhận trả xe:", err);
      const saved = operationalRepository.saveHandoverForReconciliation(
        tripId,
        handover.vehicleId,
        handover.slotId,
        lock,
      );
      await alertOperator({
        alertType: "RETURN_RECORD_FAILED",
        message: "Xe đã khóa tại vị trí nhưng ghi nhận trả xe lỗi, cần đối soát.",
        tripId,
        vehicleId: handover.vehicleId,
        hubId: handover.hubId,
        slotId: handover.slotId,
      });
      return { ...resultOf(saved, "SUCCESS"), pendingReconciliation: true };
    }
  },

  /** UC05 Ext 5a: sinh viên dừng trước khi bàn giao → giải phóng chỗ mới của lượt trả này, chuyến đi tiếp tục. */
  async abandonReturn(requestId: string, studentId: string, tripId: string): Promise<Trip> {
    const trip = operationalRepository.findTripForReturn(tripId);
    if (!trip || !validateTripForReturn(trip, studentId)) {
      throw new AppError("NOT_FOUND", "Không tìm thấy chuyến đi của bạn.");
    }
    const handover = operationalRepository.findReturnHandoverContext(tripId, studentId);
    if (!handover) {
      const done = operationalRepository.findProcessedRequest(requestId);
      if (done && done.actorId === studentId && done.operation === "ABANDON_RETURN") return trip;
      throw new AppError("CONFLICT", "Không có lượt trả xe đang thực hiện.");
    }
    db.transaction(() => operationalRepository.releaseNewReturnAllocation(requestId, handover.allocationId));
    return operationalRepository.findTripForReturn(tripId)!;
  },

  /** Thêm ngoài sơ đồ: chuyến đi chưa kết thúc của sinh viên, để trang Chuyến đi hiển thị và trả xe. */
  async getCurrentTrip(studentId: string): Promise<CurrentTripInfo | undefined> {
    const trip = findCurrentTrip(studentId);
    if (!trip) return undefined;
    const vehicle = hubRepository.listVehicles().find((v) => v.id === trip.vehicleId);
    const slot = trip.returnSlotId ? hubRepository.listSlots().find((s) => s.id === trip.returnSlotId) : undefined;
    const hub = trip.returnHubId ? hubRepository.findById(trip.returnHubId) : undefined;
    return {
      trip,
      vehicleCode: vehicle?.code ?? "",
      vehicleType: vehicle?.type ?? "E_BIKE",
      batteryLevel: vehicle?.batteryLevel ?? 0,
      returnHubName: hub?.name,
      returnSlotCode: slot?.code,
    };
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. Ext 2a: chuyến đi phải thuộc sinh viên. */
function validateTripForReturn(tripInfo: Trip, studentId: string): boolean {
  return tripInfo.studentId === studentId;
}

/** private (–) trong class diagram. Bước 4: ưu tiên đặt chỗ đã xác nhận, nếu không thì vị trí trống đầu tiên. */
function selectReturnSlot(hubReturnContext: HubReturnContext): ReturnSlotPlan {
  if (hubReturnContext.confirmedBooking) {
    return { slotId: hubReturnContext.confirmedBooking.slotId, bookingId: hubReturnContext.confirmedBooking.id };
  }
  return { slotId: hubReturnContext.availableSlots[0]!.id };
}

/** private (–) trong class diagram. Bước 6: thiết bị báo xe đang ở đúng Hub và đúng vị trí. */
function verifyVehicleHubAndSlot(vehiclePosition: VehiclePosition, hubId: string, slotId: string): boolean {
  return vehiclePosition.hubId === hubId && vehiclePosition.slotId === slotId;
}

/**
 * private (–) trong class diagram. Bước 9, Ext 9a: xe lỗi → UNDER_MAINTENANCE; chưa rõ tình trạng → PENDING_VERIFICATION;
 * pin dưới ngưỡng cho đặt → UNDER_MAINTENANCE (cần sạc); còn lại AVAILABLE.
 */
function determineVehicleServiceStatus(batteryLevel: number, techStatus: VehicleTechStatus): VehicleStatus {
  if (techStatus === "FAULT") return "UNDER_MAINTENANCE";
  if (techStatus === "UNKNOWN" || batteryLevel < 0) return "PENDING_VERIFICATION";
  if (batteryLevel < systemConfig.reservableBatteryThreshold) return "UNDER_MAINTENANCE";
  return "AVAILABLE";
}

// ---------- Hàm hỗ trợ (không có trong sơ đồ) ----------

function resultOf(trip: Trip, outcome: ReturnResult["outcome"]): ReturnResult {
  return {
    outcome,
    trip,
    returnedAt: trip.endedAt ?? undefined,
    hubId: trip.returnHubId ?? "",
    slotId: trip.returnSlotId ?? "",
    pendingReconciliation: trip.status === "PENDING_RECONCILIATION" ? true : undefined,
  };
}

/** Báo Operator; NotificationService chưa sẵn sàng thì ghi log, không làm hỏng việc trả xe. */
async function alertOperator(alert: OperatorAlert): Promise<void> {
  try {
    await notificationService.notifyOperator(alert);
  } catch {
    console.warn(`[UC05] Chưa gửi được thông báo cho Operator: ${alert.message} (trip ${alert.tripId})`);
  }
}
