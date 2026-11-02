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
  confirmReservation: (slotOptionId: string) => api.post<unknown>("/charging-reservations", { slotOptionId }),
  reservationDetail: (id: string) => api.get<unknown>(`/charging-reservations/${id}`),
  cancelReservation: (id: string, expectedVersion: number) =>
    api.post<unknown>(`/charging-reservations/${id}/cancel`, { expectedVersion }),
};
