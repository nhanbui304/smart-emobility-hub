// Owner: Ngô Minh Triết – UC08 (findChargingSlots, confirmChargingReservation, validateChargingRequest); Nguyễn Hoàng Nhân – UC09 (các method còn lại)
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC09.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingReservation } from "../db/schema";
import { AppError } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import { operationalRepository } from "../repositories/OperationalRepository";
import {
  findAlternativeHubSuggestions,
  findProcessedReservationCreateResult,
  getStoredSlotOptionEntry,
  hasConflictingImmediateChargingRequest,
} from "../repositories/operational/chargingReservationOps";
import {
  checkVehicleAndHubCompatibility,
  getPortAndHubInfo,
  hasActiveChargingSession,
  loadReservationFullContext,
  queryAvailableChargingSlotsForReschedule,
} from "../repositories/operational/rescheduleOps";
import type {
  CancellationCheck,
  CancellationResult,
  ChargingNeed,
  ChargingSlotOption,
  CreateResult,
  RescheduleForm,
  ReservationDetail,
  SlotQueryResult,
  UpdatedReservation,
} from "../types/dto";

function explainNotModifiableOrCancellable(
  reservation: ChargingReservation,
  now: Date,
  actionLabel: "đổi lịch" | "hủy lịch",
): string {
  if (reservation.status === "CANCELLED") {
    return `Lịch sạc đã bị hủy trước đó nên không thể ${actionLabel}.`;
  }
  if (reservation.status === "CHARGING") {
    return `Lịch sạc đang trong quá trình sạc nên không thể ${actionLabel}.`;
  }
  if (reservation.status === "AWAITING_DISCONNECT") {
    return `Phiên sạc đã hoàn tất và đang chờ rút sạc nên không thể ${actionLabel}.`;
  }
  if (reservation.status === "COMPLETED") {
    return `Lịch sạc đã hoàn tất nên không thể ${actionLabel}.`;
  }
  if (reservation.status === "EXPIRED") {
    return `Lịch sạc đã hết hạn nên không thể ${actionLabel}.`;
  }
  if (hasActiveChargingSession(reservation.id)) {
    return `Hệ thống đang xử lý phiên sạc cho lịch này nên không thể ${actionLabel}.`;
  }
  if (reservation.startTime.getTime() <= now.getTime()) {
    return `Đã đến hoặc quá giờ bắt đầu khung sạc đã đặt nên không thể ${actionLabel}.`;
  }
  return `Lịch sạc không còn đủ điều kiện để ${actionLabel}.`;
}

function formatDateTimeVi(date: Date): string {
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const chargingReservationService = {
  /** UC09 bước 1–3 (BTL1 Bảng 2.9, BTL2 Sequence 1/4): xem chi tiết lịch sạc (chỉ của chính sinh viên) và các thao tác được phép. */
  async getReservationDetail(studentId: string, reservationId: string): Promise<ReservationDetail> {
    const reservation = operationalRepository.findReservation(reservationId);
    if (!reservation) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc yêu cầu.");
    }
    if (reservation.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền truy cập lịch sạc của sinh viên khác.");
    }

    const full = loadReservationFullContext(reservation);
    if (!full) {
      throw new AppError("INTERNAL_ERROR", "Không truy xuất được đầy đủ thông tin phương tiện hoặc cổng sạc của lịch này.");
    }

    const now = new Date();
    const allowedActions = determineAllowedActions(full.reservation, now);

    return {
      vehicle: full.vehicle,
      hubId: full.hub.id,
      portId: full.port.id,
      timeRange: {
        startTime: full.reservation.startTime,
        endTime: full.reservation.endTime,
      },
      status: full.reservation.status,
      allowedActions,
    };
  },

  /** UC09 bước 4–5 (BTL1 Ext 5a, BTL2 Sequence 2/4): kiểm tra lịch còn đổi được (CONFIRMED, chưa tới giờ, chưa bắt đầu sạc). */
  async startReschedule(studentId: string, reservationId: string): Promise<RescheduleForm> {
    const reservation = operationalRepository.findReservation(reservationId);
    if (!reservation) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc yêu cầu.");
    }
    if (reservation.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền đổi lịch sạc của sinh viên khác.");
    }

    const now = new Date();
    if (!checkModifiable(reservation, now)) {
      throw new AppError("CONFLICT", explainNotModifiableOrCancellable(reservation, now, "đổi lịch"), {
        reason: "NOT_MODIFIABLE",
        reservation,
      });
    }

    return { reservation };
  },

  /**
   * UC09 bước 6–8 (BTL1 Ext 7a/7b/7c, BTL2 Sequence 2/4):
   * Sinh viên chọn Hub, khung giờ và nhu cầu sạc mới; tìm phương án mới,
   * bỏ qua chính lịch hiện tại khi kiểm tra chồng lấn. Lịch cũ vẫn giữ nguyên.
   */
  async findRescheduleOptions(
    studentId: string,
    reservationId: string,
    hubId: string,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
  ): Promise<ChargingSlotOption[]> {
    const reservation = operationalRepository.findReservation(reservationId);
    if (!reservation) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc cần đổi.");
    }
    if (reservation.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền đổi lịch sạc của sinh viên khác.");
    }

    const now = new Date();
    if (!checkModifiable(reservation, now)) {
      throw new AppError("CONFLICT", explainNotModifiableOrCancellable(reservation, now, "đổi lịch"), {
        reason: "NOT_MODIFIABLE",
        reservation,
      });
    }

    // Bước 7 & Ext 7a: kiểm tra tính hợp lệ và tương thích của tiêu chí mới
    if (!validateNewCriteria(reservation.privateVehicleId, hubId, timeRange, chargingNeed)) {
      const reason =
        timeRange.startTime.getTime() <= now.getTime()
          ? "Thời điểm bắt đầu khung giờ mới phải ở trong tương lai (sau thời điểm hiện tại)."
          : timeRange.endTime.getTime() <= timeRange.startTime.getTime()
            ? "Thời điểm kết thúc phải sau thời điểm bắt đầu."
            : !Number.isInteger(chargingNeed.currentBattery) ||
                !Number.isInteger(chargingNeed.targetBattery) ||
                chargingNeed.currentBattery < 0 ||
                chargingNeed.targetBattery > 100 ||
                chargingNeed.targetBattery <= chargingNeed.currentBattery
              ? "Nhu cầu pin sạc không hợp lệ (mức pin mục tiêu phải lớn hơn mức pin hiện tại và trong khoảng 0–100%)."
              : (checkVehicleAndHubCompatibility(reservation.privateVehicleId, hubId).reason ??
                "Tiêu chí đổi lịch không hợp lệ.");
      throw new AppError("VALIDATION_ERROR", reason);
    }

    // Bước 7: truy vấn cổng sạc khả dụng (loại trừ tài nguyên sự cố UC11, bỏ qua chính reservationId)
    const slotQuery = queryAvailableChargingSlotsForReschedule(
      hubId,
      reservation.privateVehicleId,
      timeRange,
      chargingNeed,
      now,
      reservationId,
      studentId,
    );

    if (!slotQuery.verified) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Không xác minh được khả dụng của tài nguyên sạc tại Hub. Lịch cũ vẫn giữ nguyên; vui lòng thử lại.",
      );
    }

    if (slotQuery.options.length === 0) {
      throw new AppError(
        "CONFLICT",
        "Không có cổng sạc phù hợp tại Hub và khung giờ mới (hoặc xe đã có lịch khác trùng giờ). Lịch cũ của bạn vẫn được giữ nguyên.",
        { reason: "NO_SUITABLE_OPTION" },
      );
    }

    return slotQuery.options;
  },

  /**
   * UC09 bước 9–11 (BTL1 Ext 10a/10b/10c/10d, BTL3 TC-UC09-01):
   * Xác nhận đổi trong một thao tác nhất quán (atomicReschedule): kiểm tra gửi lặp,
   * khả dụng phương án mới (kể cả sự cố UC11), expectedVersion, điều kiện sửa;
   * giữ tài nguyên mới và giải phóng tài nguyên cũ.
   */
  async confirmReschedule(
    requestId: string,
    studentId: string,
    reservationId: string,
    optionId: string,
    expectedVersion: number,
  ): Promise<UpdatedReservation> {
    const result = operationalRepository.atomicReschedule(
      requestId,
      studentId,
      reservationId,
      optionId,
      expectedVersion,
    );

    const updated = result.reservation;
    const portInfo = getPortAndHubInfo(updated.portId);
    const hubId = portInfo?.hubId ?? "";
    const hubLabel = portInfo ? `${portInfo.hubName} (vị trí ${portInfo.slotCode})` : `cổng ${updated.portId}`;

    return {
      reservationId: updated.id,
      hubId,
      portId: updated.portId,
      timeRange: {
        startTime: updated.startTime,
        endTime: updated.endTime,
      },
      usageGuide:
        `Vui lòng đưa xe đến ${hubLabel} trước ${formatDateTimeVi(updated.startTime)} ` +
        `và hoàn tất sạc trước ${formatDateTimeVi(updated.endTime)}. ` +
        `Phiên bản lịch hiện tại: v${updated.version}.`,
    };
  },

  /** UC09 Ext 4b & 4b.3 (BTL2 Sequence 4/4): kiểm tra lịch có được hủy không trước khi hỏi xác nhận. */
  async checkCancellation(studentId: string, reservationId: string): Promise<CancellationCheck> {
    const reservation = operationalRepository.findReservation(reservationId);
    if (!reservation) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc yêu cầu.");
    }
    if (reservation.studentId !== studentId) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền thao tác lịch sạc của sinh viên khác.");
    }

    const now = new Date();
    if (!checkCancellable(reservation, now)) {
      return {
        canCancel: false,
        reason: explainNotModifiableOrCancellable(reservation, now, "hủy lịch"),
        version: reservation.version,
      };
    }

    return {
      canCancel: true,
      version: reservation.version,
    };
  },

  /** UC09 Ext 4b.1 (BTL2 Sequence 4/4): hủy trong một thao tác: kiểm tra gửi lặp, expectedVersion; CONFIRMED → CANCELLED. */
  async cancelReservation(
    requestId: string,
    studentId: string,
    reservationId: string,
    expectedVersion: number,
  ): Promise<CancellationResult> {
    return operationalRepository.atomicCancelReservation(
      requestId,
      studentId,
      reservationId,
      expectedVersion,
      new Date(),
    );
  },

  /**
   * UC08 bước 4–5: kiểm tra yêu cầu, quyền với xe, Hub hỗ trợ, xung đột; tìm khung giờ phù hợp.
   * Không có khung giờ phù hợp → AppError CONFLICT, details = gợi ý thời gian / Hub khác (Ext 5a).
   */
  async findChargingSlots(
    studentId: string,
    vehicleId: string,
    hubId: string,
    date: Date,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
  ): Promise<SlotQueryResult> {
    if (!validateChargingRequest(date, timeRange, chargingNeed)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Thông tin đặt lịch sạc không hợp lệ (khung giờ phải ở tương lai, giờ kết thúc sau giờ bắt đầu và pin mục tiêu lớn hơn pin hiện tại).",
      );
    }

    if (!operationalRepository.findVehicleChargingRight(studentId, vehicleId)) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền đặt lịch sạc cho phương tiện này.");
    }

    if (!operationalRepository.queryHubChargingSupport(hubId, vehicleId)) {
      throw new AppError(
        "CONFLICT",
        "Hub đã chọn không có cổng sạc hoạt động tương thích với đầu cắm của xe cá nhân.",
      );
    }

    const now = new Date();
    const conflicts = operationalRepository.findConflictingRequestsOrSchedules(
      studentId,
      vehicleId,
      date,
      timeRange,
    );
    if (conflicts.length > 0 || hasConflictingImmediateChargingRequest(vehicleId, timeRange, now)) {
      throw new AppError(
        "CONFLICT",
        "Xe của bạn đã có yêu cầu sạc hoặc lịch sạc khác trùng khung giờ này. Vui lòng chọn khung giờ khác.",
      );
    }

    const result = operationalRepository.queryAvailableChargingSlots(
      hubId,
      vehicleId,
      date,
      timeRange,
      chargingNeed,
      now,
    );

    if (result.options.length === 0) {
      const suggestedHubs = findAlternativeHubSuggestions(hubId, vehicleId, timeRange, now);
      const durationMs = timeRange.endTime.getTime() - timeRange.startTime.getTime();
      const shiftedStart = new Date(timeRange.endTime.getTime());
      const shiftedEnd = new Date(shiftedStart.getTime() + durationMs);
      throw new AppError(
        "CONFLICT",
        "Không có cổng sạc trống phù hợp tại Hub và khung giờ đã chọn. Vui lòng tham khảo gợi ý Hub hoặc khung giờ khác.",
        {
          suggestedHubs,
          suggestedTimeRange: { startTime: shiftedStart, endTime: shiftedEnd },
        },
      );
    }

    return result;
  },

  /**
   * UC08 bước 7–9: tra lại phương án (findSlotOption), kiểm tra lại điều kiện và tạo lịch CONFIRMED
   * trong một thao tác (atomicCreateReservation). Gửi lặp cùng requestId → trả lịch đã tạo (Ext 8d).
   */
  async confirmChargingReservation(requestId: string, studentId: string, slotOptionId: string): Promise<CreateResult> {
    const existingResult = findProcessedReservationCreateResult(requestId, studentId);
    if (existingResult) {
      return existingResult;
    }

    const option = operationalRepository.findSlotOption(slotOptionId, studentId);
    const entry = getStoredSlotOptionEntry(slotOptionId, studentId);
    if (!option || !entry) {
      throw new AppError(
        "CONFLICT",
        "Phương án khung giờ sạc không tồn tại hoặc đã hết hiệu lực. Vui lòng tìm kiếm lại.",
      );
    }

    return operationalRepository.atomicCreateReservation(
      requestId,
      studentId,
      entry.vehicleId,
      option.hubId,
      option.portId,
      { startTime: option.startTime, endTime: option.endTime },
      entry.chargingNeed,
    );
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram UC09: xác định các thao tác sinh viên được phép thực hiện trên lịch. */
function determineAllowedActions(reservation: ChargingReservation, now: Date): string[] {
  const actions: string[] = ["VIEW"];
  if (checkModifiable(reservation, now)) {
    actions.push("RESCHEDULE");
  }
  if (checkCancellable(reservation, now)) {
    actions.push("CANCEL");
  }
  return actions;
}

/** private (–) trong class diagram UC09: lịch chỉ được sửa khi CONFIRMED, chưa tới giờ bắt đầu và chưa có phiên sạc đang chạy. */
function checkModifiable(reservation: ChargingReservation, now: Date): boolean {
  if (reservation.status !== "CONFIRMED") return false;
  if (reservation.startTime.getTime() <= now.getTime()) return false;
  if (hasActiveChargingSession(reservation.id)) return false;
  return true;
}

/** private (–) trong class diagram UC09: kiểm tra tính hợp lệ của Hub, khung giờ, nhu cầu pin và tương thích đầu sạc. */
function validateNewCriteria(
  vehicleId: string,
  hubId: string,
  timeRange: TimeRange,
  chargingNeed: ChargingNeed,
): boolean {
  const now = new Date();
  if (!hubId || !vehicleId) return false;
  if (!(timeRange.startTime instanceof Date) || !(timeRange.endTime instanceof Date)) return false;
  if (Number.isNaN(timeRange.startTime.getTime()) || Number.isNaN(timeRange.endTime.getTime())) return false;
  if (timeRange.startTime.getTime() <= now.getTime()) return false;
  if (timeRange.endTime.getTime() <= timeRange.startTime.getTime()) return false;

  if (
    !Number.isInteger(chargingNeed.currentBattery) ||
    !Number.isInteger(chargingNeed.targetBattery) ||
    chargingNeed.currentBattery < 0 ||
    chargingNeed.targetBattery > 100 ||
    chargingNeed.targetBattery <= chargingNeed.currentBattery
  ) {
    return false;
  }

  const compat = checkVehicleAndHubCompatibility(vehicleId, hubId);
  return compat.valid;
}

/** private (–) trong class diagram UC09: lịch chỉ được hủy khi CONFIRMED, chưa tới giờ bắt đầu và chưa có phiên sạc đang chạy. */
function checkCancellable(reservation: ChargingReservation, now: Date): boolean {
  if (reservation.status !== "CONFIRMED") return false;
  if (reservation.startTime.getTime() <= now.getTime()) return false;
  if (hasActiveChargingSession(reservation.id)) return false;
  return true;
}

/** private (–) trong class diagram UC08: kiểm tra ngày, khung giờ tương lai và nhu cầu pin hợp lệ. */
function validateChargingRequest(date: Date, timeRange: TimeRange, chargingNeed: ChargingNeed): boolean {
  const now = new Date();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  if (!(timeRange.startTime instanceof Date) || !(timeRange.endTime instanceof Date)) return false;
  if (Number.isNaN(timeRange.startTime.getTime()) || Number.isNaN(timeRange.endTime.getTime())) return false;
  if (timeRange.startTime.getTime() <= now.getTime()) return false;
  if (timeRange.endTime.getTime() <= timeRange.startTime.getTime()) return false;

  return (
    Number.isInteger(chargingNeed.currentBattery) &&
    Number.isInteger(chargingNeed.targetBattery) &&
    chargingNeed.currentBattery >= 0 &&
    chargingNeed.targetBattery <= 100 &&
    chargingNeed.targetBattery > chargingNeed.currentBattery
  );
}
