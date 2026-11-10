// Owner: Bùi Quang Nhân (UC06), Ngô Minh Triết (UC07, UC08), Nguyễn Hoàng Nhân (UC09)
import { api } from "./client";

type TimeRange = { startTime: string; endTime: string };

export const parkingApi = {
  searchSlots: (params: { hubId: string; vehicleId: string } & TimeRange) => api.get<unknown>("/parking/slots", params),
  hold: (slotId: string, vehicleId: string, timeRange: TimeRange) =>
    api.post<unknown>("/parking/holds", { slotId, vehicleId, timeRange }),
  confirm: (holdToken: string) => api.post<unknown>(`/parking/holds/${holdToken}/confirm`, {}),
  cancelHold: (holdToken: string) => api.post<unknown>(`/parking/holds/${holdToken}/cancel`, {}),
  cancelBooking: (bookingId: string) => api.post<unknown>(`/parking/bookings/${bookingId}/cancel`, {}),
};

export const chargingApi = {
  submitRequest: (body: {
    hubId: string;
    vehicleRef: string;
    need: { currentBattery: number; targetBattery: number };
  }) => api.post<unknown>("/charging-requests", body),
  cancelRequest: (id: string) => api.post<unknown>(`/charging-requests/${id}/cancel`, {}),
  searchSlots: (body: Record<string, unknown>) => api.post<unknown>("/charging-reservations/search", body),
  /** requestId: crypto.randomUUID() sinh một lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã. */
  confirmReservation: (requestId: string, slotOptionId: string) =>
    api.post<unknown>("/charging-reservations", { requestId, slotOptionId }),
  reservationDetail: (id: string) => api.get<unknown>(`/charging-reservations/${id}`),
  startReschedule: (id: string) => api.post<unknown>(`/charging-reservations/${id}/reschedule/start`, {}),
  rescheduleOptions: (
    id: string,
    body: { hubId: string; timeRange: TimeRange; need: { currentBattery: number; targetBattery: number } },
  ) => api.post<unknown>(`/charging-reservations/${id}/reschedule/options`, body),
  confirmReschedule: (id: string, requestId: string, optionId: string, expectedVersion: number) =>
    api.post<unknown>(`/charging-reservations/${id}/reschedule/confirm`, { requestId, optionId, expectedVersion }),
  checkCancellation: (id: string) => api.get<unknown>(`/charging-reservations/${id}/cancellation-check`),
  cancelReservation: (id: string, requestId: string, expectedVersion: number) =>
    api.post<unknown>(`/charging-reservations/${id}/cancel`, { requestId, expectedVersion }),
};
