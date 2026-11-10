// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
// Chữ ký method UC02 theo Sequence Submission #2 (Hình 2.10–2.11). UC03 không có sequence.
import type { SharedVehicle, VehicleReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface ReservationPreview {
  hubId: string;
  vehicle: SharedVehicle;
  /** Thời gian giữ xe (phút) – systemConfig.pickupDeadlineMinutes. */
  pickupDeadlineMinutes: number;
  pickupDeadline: Date;
}

/** UC02 Ext 8a (getReservationResult): kết quả của một requestId đã gửi. */
export interface ReservationRequestResult {
  /** PROCESSED: đã đặt xong · NOT_FOUND: yêu cầu chưa được ghi nhận, sinh viên gửi lại. */
  status: "PROCESSED" | "NOT_FOUND";
  reservation?: VehicleReservation;
}

export const reservationService = {
  /** UC02 bước 1–2: danh sách xe có thể đặt tại Hub (queryReservableVehicles). */
  async getReservableVehicles(studentId: string, hubId: string): Promise<SharedVehicle[]> {
    throw notImplemented("ReservationService.getReservableVehicles (UC02)");
  },

  /** UC02 bước 3–4: kiểm tra sơ bộ (loadReservationContext) và hiển thị thông tin xác nhận (chưa ghi dữ liệu). */
  async prepareReservation(studentId: string, hubId: string, vehicleId: string): Promise<ReservationPreview> {
    throw notImplemented("ReservationService.prepareReservation (UC02)");
  },

  /**
   * UC02 bước 5–7: xác nhận đặt xe trong một thao tác (atomicReserveVehicle): kiểm tra gửi lặp,
   * xe còn AVAILABLE, sinh viên chưa có đặt xe khác; tạo VehicleReservation RESERVED.
   */
  async confirmReservation(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
  ): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.confirmReservation (UC02)");
  },

  /** UC02 Ext 8a: mất kết nối sau khi gửi xác nhận → tra lại kết quả theo requestId. */
  async getReservationResult(studentId: string, requestId: string): Promise<ReservationRequestResult> {
    throw notImplemented("ReservationService.getReservationResult (UC02)");
  },

  /** UC03: hủy đặt xe trước khi nhận. */
  async cancelReservation(studentId: string, reservationId: string): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.cancelReservation (UC03)");
  },
};
