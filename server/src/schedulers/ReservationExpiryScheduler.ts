// Owner: Lê Quốc Linh – Mục 2.3.2 Tự động giải phóng xe khi quá hạn nhận
import { and, eq, lte } from "drizzle-orm";
import { vehicleReservations, type VehicleReservation } from "../db/schema";
import { db } from "../lib/db";
import { pickUpRepository } from "../repositories/PickUpRepository";

export const reservationExpiryScheduler = {
  /**
   * Tìm đặt xe RESERVED đã quá pickupDeadline → EXPIRED, trả xe về AVAILABLE,
   * gửi NOTIFICATION cho sinh viên. Trả về số đặt xe đã giải phóng.
   * Mỗi đặt xe xử lý trong một transaction riêng (pickUpRepository.expireReservation kiểm tra lại trạng thái trước khi ghi).
   * Đặt xe đang HANDING_OVER / PENDING_VERIFICATION không bị giải phóng.
   */
  expireDueReservations(now: Date): number {
    const due = db
      .select({ id: vehicleReservations.id })
      .from(vehicleReservations)
      .where(and(eq(vehicleReservations.status, "RESERVED"), lte(vehicleReservations.pickupDeadline, now)))
      .all();

    let released = 0;
    for (const { id } of due) {
      try {
        const reservation = pickUpRepository.expireReservation(id, now);
        if (reservation.status === "EXPIRED") {
          released++;
          notifyStudentExpired(reservation);
        }
      } catch (err) {
        console.error(`[scheduler] Không giải phóng được đặt xe ${id}:`, err);
      }
    }
    return released;
  },
};

/**
 * Thông báo cho sinh viên: NotificationService (Hoàng Nhân) chưa có method gửi cho sinh viên,
 * nên MVP ghi log; sinh viên thấy đặt xe biến mất khỏi "Chuyến đi" và "Đặt chỗ của tôi".
 */
function notifyStudentExpired(reservation: VehicleReservation): void {
  console.log(`[notify] Sinh viên ${reservation.studentId}: đặt xe ${reservation.id} đã hết hạn nhận xe.`);
}
