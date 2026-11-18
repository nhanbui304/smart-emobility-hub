// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
// Gọi API của ParkingController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { ActiveHold, ParkingAllocation, ParkingBooking, ParkingSlot, TimeRange } from "../types";
import { api } from "./client";

export const parkingApi = {
  /** GET /api/parking/slots */
  searchAvailableSlots: (hubId: string, vehicleId: string, timeRange: TimeRange) =>
    api.get<ParkingSlot[]>("/parking/slots", { hubId, vehicleId, startTime: timeRange.startTime, endTime: timeRange.endTime }),
  /** POST /api/parking/holds */
  holdSlot: (requestId: string, slotId: string, vehicleId: string, timeRange: TimeRange) =>
    api.post<ParkingAllocation>("/parking/holds", { requestId, slotId, vehicleId, timeRange }),
  /** GET /api/parking/holds/active */
  getActiveHold: () =>
    api.get<ActiveHold | undefined>("/parking/holds/active"),
  /** POST /api/parking/holds/:holdToken/confirm */
  confirmReservation: (requestId: string, holdToken: string) =>
    api.post<ParkingBooking>(`/parking/holds/${holdToken}/confirm`, { requestId }),
  /** POST /api/parking/holds/:holdToken/cancel */
  cancelHold: (requestId: string, holdToken: string) =>
    api.post<ParkingAllocation>(`/parking/holds/${holdToken}/cancel`, { requestId }),
  /** POST /api/parking/bookings/:bookingId/cancel */
  cancelBooking: (bookingId: string) =>
    api.post<ParkingAllocation>(`/parking/bookings/${bookingId}/cancel`, {}),
};
