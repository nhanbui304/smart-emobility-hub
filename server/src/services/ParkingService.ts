// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
// Chữ ký method UC06 theo Sequence Submission #2 (Hình 2.26–2.29). Cancel Parking Reservation không có sequence.
import type { ParkingAllocation, ParkingSlot } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

/** UC06 bước 9: booking(bookingId, hubId, slotId, timeRange, arrivalConditions). */
export interface ParkingBooking {
  allocation: ParkingAllocation;
  hubId: string;
  slotCode: string;
  /** Điều kiện khi đến: giờ đến sớm nhất / muộn nhất, quy định Hub. */
  arrivalConditions: string;
}

/** UC06 Ext 7b (getActiveHold): lượt giữ còn hiệu lực của sinh viên. */
export interface ActiveHold {
  hold: ParkingAllocation;
  /** Số giây còn lại tới holdExpiresAt (không tính lại thời hạn). */
  remainingSeconds: number;
}

export const parkingService = {
  /**
   * UC06 bước 1–3: kiểm tra quyền với xe (findVehicleRight, Ext 2b), Hub có tiếp nhận loại xe
   * (queryHubAcceptance, Ext 2c), tìm vị trí trống trong khung giờ (findAvailableSlots).
   */
  async searchAvailableSlots(
    studentId: string,
    hubId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingSlot[]> {
    throw notImplemented("ParkingService.searchAvailableSlots (UC06)");
  },

  /**
   * UC06 bước 4–6: kiểm tra gửi lặp, kiểm tra lại điều kiện (recheckReservationConditions, Ext 5c),
   * tính hạn giữ (computeHoldDeadline: min(now + parkingHoldMinutes, startTime)),
   * giữ trong một thao tác (atomicCheckAndHold): đã có lượt giữ → CONFLICT kèm lượt giữ cũ (Ext 5b),
   * vị trí vừa bị giữ / bị hạn chế → CONFLICT kèm danh sách mới (Ext 5a). holdToken = id.
   */
  async holdSlot(
    requestId: string,
    studentId: string,
    slotId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.holdSlot (UC06)");
  },

  /** UC06 bước 7–9: xác nhận trong một thao tác (atomicConfirmHold): kiểm tra gửi lặp, chủ sở hữu, hạn giữ, sự cố. */
  async confirmReservation(requestId: string, studentId: string, holdToken: string): Promise<ParkingBooking> {
    throw notImplemented("ParkingService.confirmReservation (UC06)");
  },

  /** UC06 Ext 7a: sinh viên bỏ giữ tạm (atomicReleaseHold). */
  async cancelHold(requestId: string, studentId: string, holdToken: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.cancelHold (UC06)");
  },

  /** UC06 Ext 7b: sinh viên quay lại sau khi mất kết nối, xem lượt giữ còn hiệu lực (findActiveHold). */
  async getActiveHold(studentId: string): Promise<ActiveHold | null> {
    throw notImplemented("ParkingService.getActiveHold (UC06)");
  },

  /**
   * UC06 Ext 7c / Mục 2.3.1 (gọi từ HoldExpiryScheduler): đánh dấu hết hạn và giải phóng các lượt giữ
   * đã quá hạn (atomicExpireHolds), báo sinh viên. Trả về số lượt đã giải phóng.
   */
  expireDueHolds(now: Date): number {
    throw notImplemented("ParkingService.expireDueHolds (2.3.1)");
  },

  /** Cancel Parking Reservation: hủy đặt chỗ đã xác nhận (trước giờ bắt đầu). */
  async cancelBooking(studentId: string, bookingId: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.cancelBooking (Cancel Parking Reservation)");
  },
};
