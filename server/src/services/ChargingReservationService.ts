// Owner: Ngô Minh Triết – UC08 (findChargingSlots, confirmChargingReservation, validateChargingRequest); Nguyễn Hoàng Nhân – UC09 (các method còn lại)
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingReservation } from "../db/schema";
import type { TimeRange } from "../lib/schemas";
import type { CancellationCheck, CancellationResult, ChargingNeed, ChargingSlotOption, CreateResult, RescheduleForm, ReservationDetail, SlotQueryResult, UpdatedReservation } from "../types/dto";
import { notImplemented } from "../lib/errors";

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
    throw notImplemented("ChargingReservationService.findChargingSlots");
  },

  /**
   * UC08 bước 7–9: tra lại phương án (findSlotOption), kiểm tra lại điều kiện và tạo lịch CONFIRMED
   * trong một thao tác (atomicCreateReservation). Gửi lặp cùng requestId → trả lịch đã tạo (Ext 8d).
   */
  async confirmChargingReservation(requestId: string, studentId: string, slotOptionId: string): Promise<CreateResult> {
    throw notImplemented("ChargingReservationService.confirmChargingReservation");
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

/** private (–) trong class diagram. */
function validateChargingRequest(date: Date, timeRange: TimeRange, chargingNeed: ChargingNeed): boolean {
  throw notImplemented("ChargingReservationService.validateChargingRequest");
}
