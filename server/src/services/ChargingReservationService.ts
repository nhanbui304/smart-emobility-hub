// Owner: Ngô Minh Triết (UC08 Schedule Charging Session), Nguyễn Hoàng Nhân (UC09 Manage Scheduled Charging Session)
// Chữ ký method theo Sequence Submission #2 (Hình 2.42–2.43 UC08, Hình 2.47–2.50 UC09).
import type { ChargingReservationStatus } from "../constants";
import type { ChargingReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import type { ChargingNeed } from "./ChargingRequestService";

/**
 * Phương án khung giờ/cổng sạc tạm (chưa giữ tài nguyên). Lưu tạm qua
 * chargingReservationRepository.saveSlotOptions để bước xác nhận tra lại bằng slotOptionId.
 * Dùng chung cho tìm lịch (UC08) và tìm phương án đổi lịch (UC09, khi đó reservationId có giá trị).
 */
export interface ChargingSlotOption {
  slotOptionId: string;
  /** Sinh viên đã tìm phương án này; xác nhận chỉ hợp lệ với đúng sinh viên đó. */
  studentId: string;
  /** Lịch đang được đổi (UC09); undefined nếu là tìm lịch mới (UC08). */
  reservationId?: string;
  vehicleId: string;
  hubId: string;
  portId: string;
  startTime: Date;
  endTime: Date;
  maxPowerKw: number;
  need: ChargingNeed;
  /** Hết hạn thì không xác nhận được nữa, phải tìm lại. */
  expiresAt: Date;
}

/** Thao tác sinh viên còn được làm với lịch (UC09 bước 3: determineAllowedActions). */
export type ReservationAction = "RESCHEDULE" | "CANCEL";

/** Thông tin lịch sạc trả về cho UI (UC08 bước 9, UC09 bước 3 và 11, Ext 4b). */
export interface ChargingReservationDetail {
  reservation: ChargingReservation;
  hubId: string;
  hubName: string;
  /** Mã vị trí đỗ gắn cổng sạc, ví dụ BKU-03. */
  slotCode: string;
  /** Hướng dẫn sử dụng: đến vị trí nào, giờ nào, cắm loại đầu sạc nào. */
  usageGuide: string;
  allowedActions: ReservationAction[];
}

/** Kết quả kiểm tra hủy (UC09 Ext 4b: checkCancellable). */
export interface CancellationCheck {
  canCancel: boolean;
  /** Lịch đã bị hủy trước đó (Ext 4b.3): UI chỉ hiển thị kết quả đã có. */
  alreadyCancelled: boolean;
  status: ChargingReservationStatus;
  reason?: string;
  /** Gửi lại làm expectedVersion khi xác nhận hủy. */
  version: number;
}

export const chargingReservationService = {
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
    need: ChargingNeed,
  ): Promise<ChargingSlotOption[]> {
    throw notImplemented("ChargingReservationService.findChargingSlots (UC08)");
  },

  /**
   * UC08 bước 7–9: tra lại phương án (findSlotOption), kiểm tra lại điều kiện và tạo lịch CONFIRMED
   * trong một thao tác (atomicCreateReservation). Gửi lặp cùng requestId → trả lịch đã tạo (Ext 8d).
   */
  async confirmChargingReservation(
    requestId: string,
    studentId: string,
    slotOptionId: string,
  ): Promise<ChargingReservationDetail> {
    throw notImplemented("ChargingReservationService.confirmChargingReservation (UC08)");
  },

  /** UC09 bước 1–3: xem chi tiết lịch sạc (chỉ của chính sinh viên) và các thao tác được phép. */
  async getReservationDetail(studentId: string, reservationId: string): Promise<ChargingReservationDetail> {
    throw notImplemented("ChargingReservationService.getReservationDetail (UC09)");
  },

  /** UC09 bước 4–5: kiểm tra lịch còn đổi được (CONFIRMED, chưa tới giờ, chưa bắt đầu sạc). */
  async startReschedule(studentId: string, reservationId: string): Promise<ChargingReservationDetail> {
    throw notImplemented("ChargingReservationService.startReschedule (UC09)");
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
    need: ChargingNeed,
  ): Promise<ChargingSlotOption[]> {
    throw notImplemented("ChargingReservationService.findRescheduleOptions (UC09)");
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
  ): Promise<ChargingReservationDetail> {
    throw notImplemented("ChargingReservationService.confirmReschedule (UC09)");
  },

  /** UC09 Ext 4b: kiểm tra lịch có được hủy không trước khi hỏi xác nhận. */
  async checkCancellation(studentId: string, reservationId: string): Promise<CancellationCheck> {
    throw notImplemented("ChargingReservationService.checkCancellation (UC09)");
  },

  /** UC09 Ext 4b.1: hủy trong một thao tác: kiểm tra gửi lặp, expectedVersion; CONFIRMED → CANCELLED. */
  async cancelReservation(
    requestId: string,
    studentId: string,
    reservationId: string,
    expectedVersion: number,
  ): Promise<ChargingReservationDetail> {
    throw notImplemented("ChargingReservationService.cancelReservation (UC09)");
  },
};
