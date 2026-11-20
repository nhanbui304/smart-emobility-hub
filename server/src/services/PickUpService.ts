// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import type { DeviceCommandResult } from "../constants";
import type { Hub, SharedVehicle, VehicleReservation } from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import { pickUpRepository } from "../repositories/PickUpRepository";
import { vehicleSimulator } from "../simulator/VehicleSimulator";
import type { OperatorAlert, PickUpContext, PickUpPreview, PickUpResult } from "../types/dto";
import { notificationService } from "./NotificationService";

export const pickUpService = {
  /** UC04 bước 2–3: kiểm tra đặt xe, hiển thị thông tin xe trước khi mở khóa. */
  async preparePickUp(studentId: string, reservationId: string): Promise<PickUpPreview> {
    const now = new Date();
    const context = pickUpRepository.loadPickUpContext(reservationId, now);
    assertReservationPickable(context.reservation, studentId, now);
    await assertVehicleReady(context);
    return {
      reservation: context.reservation,
      vehicleCode: context.vehicle.code,
      batteryLevel: context.vehicle.batteryLevel,
      pickupDeadline: context.reservation.pickupDeadline,
    };
  },

  /**
   * UC04 bước 4–7: atomicBeginHandover → vehicleSimulator.requestUnlock (NGOÀI transaction)
   * → SUCCESS: atomicStartTrip · FAILED: trả về RESERVED · UNKNOWN: markPendingVerification.
   */
  async confirmPickUp(requestId: string, studentId: string, reservationId: string): Promise<PickUpResult> {
    const now = new Date();

    // 6b: gửi lặp → trả lại kết quả cũ, không mở khóa / không tạo chuyến đi lần nữa.
    const done = pickUpRepository.findProcessedRequest(requestId);
    if (done) {
      if (done.actorId !== studentId) throw new AppError("FORBIDDEN", "Mã yêu cầu không thuộc về bạn.");
      if (done.operation !== "CONFIRM_PICKUP") throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho một thao tác khác.");
      return buildRecordedResult(done.resultId);
    }

    const context = pickUpRepository.loadPickUpContext(reservationId, now);
    assertReservationPickable(context.reservation, studentId, now);
    await assertVehicleReady(context);

    // Bước 6: ghi nhận "đang bàn giao" (kiểm tra lại điều kiện trong transaction) TRƯỚC khi gọi thiết bị.
    db.transaction(() => pickUpRepository.atomicBeginHandover(requestId, studentId, reservationId, now));

    // Gọi thiết bị NGOÀI transaction.
    const unlock: DeviceCommandResult = await vehicleSimulator.requestUnlock(context.vehicle.id);
    const finishedAt = new Date();

    if (unlock === "SUCCESS") {
      try {
        const trip = db.transaction(() =>
          pickUpRepository.atomicStartTrip(requestId, reservationId, context.vehicle.id, finishedAt),
        );
        const reservation = pickUpRepository.loadPickUpContext(reservationId, finishedAt).reservation;
        return { outcome: "SUCCESS", trip, reservation };
      } catch (err) {
        // 8a: đã mở khóa nhưng ghi nhận chuyến đi lỗi → chờ đối soát, báo Operator.
        console.error("[pickup] Ghi nhận chuyến đi lỗi:", err);
        const reservation = pickUpRepository.markReconciliationRequired(reservationId, context.vehicle.id, unlock);
        await alertOperator({
          alertType: "PICKUP_RECONCILIATION_REQUIRED",
          message: `Xe ${context.vehicle.code} đã mở khóa nhưng ghi nhận chuyến đi bị lỗi, cần đối soát.`,
          vehicleId: context.vehicle.id,
          reservationId,
          hubId: context.hub.id,
        });
        return { outcome: "UNKNOWN", reservation };
      }
    }

    if (unlock === "FAILED") {
      // 7a: mở khóa thất bại → về RESERVED nếu còn hạn, hết hạn thì xử lý hết hạn.
      const reservation = pickUpRepository.endHandoverAndResolveHold(reservationId, finishedAt);
      return { outcome: "FAILED", reservation };
    }

    // 7b: chưa xác định được kết quả → chờ xác minh, báo Operator, không cấp xe cho người khác.
    const reservation = pickUpRepository.markPendingVerification(reservationId, context.vehicle.id, finishedAt);
    await alertOperator({
      alertType: "PICKUP_PENDING_VERIFICATION",
      message: `Chưa xác định được kết quả mở khóa xe ${context.vehicle.code}, cần Operator xác minh.`,
      vehicleId: context.vehicle.id,
      reservationId,
      hubId: context.hub.id,
    });
    return { outcome: "UNKNOWN", reservation };
  },

  /** UC04 bước 9a: lấy lại kết quả nhận xe khi mất kết nối. */
  async getPickUpResult(requestId: string, studentId: string): Promise<PickUpResult> {
    const done = pickUpRepository.findProcessedRequest(requestId);
    if (!done || done.operation !== "CONFIRM_PICKUP") {
      throw new AppError("NOT_FOUND", "Chưa có kết quả cho yêu cầu nhận xe này.");
    }
    if (done.actorId !== studentId) throw new AppError("FORBIDDEN", "Mã yêu cầu không thuộc về bạn.");
    return buildRecordedResult(done.resultId);
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram: xe đang nằm ở Hub nhận theo đặt xe. */
function checkVehicleAtPickupHub(vehicle: SharedVehicle, hub: Hub): boolean {
  return vehicle.hubId === hub.id;
}

/** private (–) trong class diagram: xe còn được giữ cho đặt xe (chưa hỏng/bảo trì) và đủ pin để nhận. */
function checkVehicleServiceability(vehicle: SharedVehicle): boolean {
  return vehicle.status === "RESERVED" && vehicle.batteryLevel >= systemConfig.pickupBatteryThreshold;
}

// ---------- Hàm phụ (không có trong sơ đồ) ----------

/**
 * UC04 bước 2–3 và mục 2.3.2: đặt xe thuộc sinh viên và còn nhận được.
 * Quá hạn mà tác vụ định kỳ chưa chạy vẫn bị từ chối, đồng thời ghi nhận hết hạn ngay.
 */
function assertReservationPickable(reservation: VehicleReservation, studentId: string, now: Date): void {
  if (reservation.studentId !== studentId) throw new AppError("FORBIDDEN", "Đặt xe này không thuộc về bạn.");
  switch (reservation.status) {
    case "CANCELLED":
      throw new AppError("CONFLICT", "Đặt xe đã bị hủy nên không thể nhận xe.");
    case "EXPIRED":
      throw new AppError("CONFLICT", "Đặt xe đã hết hạn nhận xe. Vui lòng đặt lại.");
    case "USED":
      throw new AppError("CONFLICT", "Đặt xe đã được sử dụng. Xem chuyến đi hiện tại ở tab Chuyến đi.");
    case "HANDING_OVER":
    case "PENDING_VERIFICATION":
      throw new AppError(
        "CONFLICT",
        "Đặt xe đang bàn giao hoặc chờ xác minh kết quả mở khóa, không thể nhận xe lúc này.",
      );
    case "RESERVED":
      if (reservation.pickupDeadline.getTime() <= now.getTime()) {
        pickUpRepository.expireReservation(reservation.id, now);
        throw new AppError("CONFLICT", "Đặt xe đã quá hạn nhận xe và được giải phóng. Vui lòng đặt lại.");
      }
  }
}

/** UC04 bước 4: đúng xe tại Hub nhận, còn phục vụ được và đủ pin (4a, 4b). */
async function assertVehicleReady(context: PickUpContext): Promise<void> {
  if (!checkVehicleAtPickupHub(context.vehicle, context.hub)) {
    throw new AppError(
      "CONFLICT",
      `Xe ${context.vehicle.code} không ở Hub nhận theo đặt xe (${context.hub.name}). Vui lòng kiểm tra lại.`,
    );
  }
  if (!checkVehicleServiceability(context.vehicle)) {
    pickUpRepository.markReservationAffected(context.reservation.id);
    await alertOperator({
      alertType: "PICKUP_VEHICLE_UNSERVICEABLE",
      message: `Xe ${context.vehicle.code} không đủ điều kiện bàn giao (sự cố hoặc pin thấp).`,
      vehicleId: context.vehicle.id,
      reservationId: context.reservation.id,
      hubId: context.hub.id,
    });
    throw new AppError(
      "CONFLICT",
      "Xe gặp sự cố hoặc không đủ pin để bàn giao. Đặt xe bị ảnh hưởng và đã được báo cho Operator; vui lòng đặt xe khác.",
    );
  }
}

/** Dựng lại kết quả đã ghi nhận của một lần nhận xe từ trạng thái hiện tại của đặt xe. */
function buildRecordedResult(reservationId: string): PickUpResult {
  const { reservation } = pickUpRepository.loadPickUpContext(reservationId, new Date());
  const trip = pickUpRepository.findTripByReservation(reservationId);
  if (trip) return { outcome: "SUCCESS", trip, reservation };
  const stillOpen = reservation.status === "HANDING_OVER" || reservation.status === "PENDING_VERIFICATION";
  return { outcome: stillOpen ? "UNKNOWN" : "FAILED", reservation };
}

/** Báo Operator (best-effort): NotificationService do Hoàng Nhân hiện thực; lỗi hoặc chưa có thì bỏ qua, không chặn UC04. */
async function alertOperator(alert: OperatorAlert): Promise<void> {
  try {
    await notificationService.notifyOperator(alert);
  } catch {
    console.warn(`[pickup] Chưa gửi được cảnh báo Operator: ${alert.message}`);
  }
}
