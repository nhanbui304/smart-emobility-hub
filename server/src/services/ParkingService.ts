// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import type { ParkingAllocation, ParkingSlot } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

export const parkingService = {
  /** UC06 bước 2–3: tìm vị trí trống phù hợp loại xe trong khung giờ. */
  async searchAvailableSlots(
    studentId: string,
    hubId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingSlot[]> {
    throw notImplemented("ParkingService.searchAvailableSlots (UC06)");
  },

  /** UC06 bước 4: giữ tạm vị trí trong parkingHoldMinutes. holdToken = id của ParkingAllocation. */
  async holdSlot(
    studentId: string,
    slotId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.holdSlot (UC06)");
  },

  /** UC06 bước 5–6: xác nhận đặt chỗ từ bản giữ tạm. */
  async confirmReservation(studentId: string, holdToken: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.confirmReservation (UC06)");
  },

  /** UC06 luồng thay thế: sinh viên bỏ giữ tạm. */
  async cancelHold(studentId: string, holdToken: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.cancelHold (UC06)");
  },

  /** Cancel Parking Reservation: hủy đặt chỗ đã xác nhận (trước giờ bắt đầu). */
  async cancelBooking(studentId: string, bookingId: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.cancelBooking (Cancel Parking Reservation)");
  },
};
