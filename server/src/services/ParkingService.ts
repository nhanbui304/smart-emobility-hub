// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation, mục 2.3.1
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ParkingAllocation, ParkingSlot } from "../db/schema";
import type { TimeRange } from "../lib/schemas";
import type { ActiveHold, ParkingBooking } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const parkingService = {
  /** UC06 bước 2–3: tìm vị trí trống phù hợp loại xe trong khung giờ. */
  async searchAvailableSlots(
    studentId: string,
    hubId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingSlot[]> {
    throw notImplemented("ParkingService.searchAvailableSlots");
  },

  /** UC06 bước 4: giữ tạm tới min(now + parkingHoldMinutes, startTime); mỗi sinh viên một lượt giữ còn hạn. holdToken = id. */
  async holdSlot(
    requestId: string,
    studentId: string,
    slotId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.holdSlot");
  },

  /** UC06 bước 5–6: xác nhận đặt chỗ từ bản giữ tạm. */
  async confirmReservation(requestId: string, studentId: string, holdToken: string): Promise<ParkingBooking> {
    throw notImplemented("ParkingService.confirmReservation");
  },

  /** UC06 luồng thay thế: sinh viên bỏ giữ tạm. */
  async cancelHold(requestId: string, studentId: string, holdToken: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.cancelHold");
  },

  async getActiveHold(studentId: string): Promise<ActiveHold | undefined> {
    throw notImplemented("ParkingService.getActiveHold");
  },

  expireDueHolds(now: Date): number {
    throw notImplemented("ParkingService.expireDueHolds");
  },

  /** Cancel Parking Reservation: hủy đặt chỗ đã xác nhận (trước giờ bắt đầu). */
  async cancelBooking(studentId: string, bookingId: string): Promise<ParkingAllocation> {
    throw notImplemented("ParkingService.cancelBooking");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function validateSearchRequest(hubId: string, vehicleId: string, timeRange: TimeRange): boolean {
  throw notImplemented("ParkingService.validateSearchRequest");
}

/** private (–) trong class diagram. */
function recheckReservationConditions(
  studentId: string,
  vehicleId: string,
  slotId: string,
  timeRange: TimeRange,
  now: Date,
): boolean {
  throw notImplemented("ParkingService.recheckReservationConditions");
}

/** private (–) trong class diagram. */
function computeHoldDeadline(now: Date, start: Date): Date {
  throw notImplemented("ParkingService.computeHoldDeadline");
}
