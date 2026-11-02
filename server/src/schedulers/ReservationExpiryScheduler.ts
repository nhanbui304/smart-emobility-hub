// Owner: Lê Quốc Linh – Mục 2.3.2 Tự động giải phóng xe khi quá hạn nhận
import { notImplemented } from "../lib/errors";

export const reservationExpiryScheduler = {
  /**
   * Tìm đặt xe RESERVED đã quá pickupDeadline → EXPIRED, trả xe về AVAILABLE,
   * gửi NOTIFICATION cho sinh viên. Trả về số đặt xe đã giải phóng.
   * Mỗi đặt xe xử lý trong một transaction riêng; kiểm tra lại trạng thái trước khi ghi.
   */
  expireDueReservations(now: Date): number {
    throw notImplemented("ReservationExpiryScheduler.expireDueReservations (2.3.2)");
  },
};
