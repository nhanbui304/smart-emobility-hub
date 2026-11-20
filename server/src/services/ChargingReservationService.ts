// Owner: Ngô Minh Triết – UC08 (findChargingSlots, confirmChargingReservation, validateChargingRequest); Nguyễn Hoàng Nhân – UC09 (các method còn lại)
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingReservation } from "../db/schema";
import { AppError, notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import { operationalRepository } from "../repositories/OperationalRepository";
import {
  findAlternativeHubSuggestions,
  findProcessedReservationCreateResult,
  getStoredSlotOptionEntry,
} from "../repositories/operational/chargingReservationOps";
import type { CancellationCheck, CancellationResult, ChargingNeed, ChargingSlotOption, CreateResult, RescheduleForm, ReservationDetail, SlotQueryResult, UpdatedReservation } from "../types/dto";

export const chargingReservationService = {
  /** UC09 bước 1–3: xem chi tiết lịch sạc (chỉ của chính sinh viên) và các thao tác được phép. */
  async getReservationDetail(studentId: string, reservationId: string): Promise<ReservationDetail> {
    throw notImplemented("ChargingReservationService.getReservationDetail");
  },

  /** UC09 bước 4–5: kiểm tra lịch còn đổi được (CONFIRMED, chưa tới giờ, chưa bắt đầu sạc). */
  async startReschedule(studentId: string, reservationId: string): Promise<RescheduleForm> {
    throw notImplemented("ChargingReservationService.startReschedule");
  },

  /**
   * UC09 bước 6–8: sinh viên chọn Hub, khung giờ và nhu cầu sạc mới; tìm phương án mới,
   * bỏ qua chính lịch hiện tại khi kiểm tra chồng lấn. Lịch cũ vẫn giữ nguyên.
   */
  async findRescheduleOptions(
    studentId: string,
    reservationId: string,
    hubId: string,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
  ): Promise<ChargingSlotOption[]> {
    throw notImplemented("ChargingReservationService.findRescheduleOptions");
  },

  /**
   * UC09 bước 9–11: xác nhận đổi trong một thao tác (atomicReschedule): kiểm tra gửi lặp,
   * expectedVersion, điều kiện sửa; giữ tài nguyên mới, giải phóng tài nguyên cũ.
   */
  async confirmReschedule(
    requestId: string,
    studentId: string,
    reservationId: string,
    optionId: string,
    expectedVersion: number,
  ): Promise<UpdatedReservation> {
    throw notImplemented("ChargingReservationService.confirmReschedule");
  },

  /** UC09 Ext 4b: kiểm tra lịch có được hủy không trước khi hỏi xác nhận. */
  async checkCancellation(studentId: string, reservationId: string): Promise<CancellationCheck> {
    throw notImplemented("ChargingReservationService.checkCancellation");
  },

  /** UC09 Ext 4b.1: hủy trong một thao tác: kiểm tra gửi lặp, expectedVersion; CONFIRMED → CANCELLED. */
  async cancelReservation(
    requestId: string,
    studentId: string,
    reservationId: string,
    expectedVersion: number,
  ): Promise<CancellationResult> {
    throw notImplemented("ChargingReservationService.cancelReservation");
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

    const conflicts = operationalRepository.findConflictingRequestsOrSchedules(
      studentId,
      vehicleId,
      date,
      timeRange,
    );
    if (conflicts.length > 0) {
      throw new AppError(
        "CONFLICT",
        "Xe của bạn đã có một lịch sạc khác trùng khung giờ này. Vui lòng chọn khung giờ khác.",
      );
    }

    const now = new Date();
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

/** private (–) trong class diagram. */
function determineAllowedActions(reservation: ChargingReservation, now: Date): string[] {
  throw notImplemented("ChargingReservationService.determineAllowedActions");
}

/** private (–) trong class diagram. */
function checkModifiable(reservation: ChargingReservation, now: Date): boolean {
  throw notImplemented("ChargingReservationService.checkModifiable");
}

/** private (–) trong class diagram. */
function validateNewCriteria(
  vehicleId: string,
  hubId: string,
  timeRange: TimeRange,
  chargingNeed: ChargingNeed,
): boolean {
  throw notImplemented("ChargingReservationService.validateNewCriteria");
}

/** private (–) trong class diagram. */
function checkCancellable(reservation: ChargingReservation, now: Date): boolean {
  throw notImplemented("ChargingReservationService.checkCancellable");
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
