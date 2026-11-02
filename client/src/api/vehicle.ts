// Owner: Lê Quốc Linh (UC02–UC04), Bùi Quang Nhân (UC05), Ngô Minh Triết (UC01)
import { api } from "./client";

export const vehicleApi = {
  findOptions: (criteria: Record<string, unknown>) => api.post<unknown>("/search/options", criteria),
  reservableVehicles: (hubId: string) => api.get<unknown>("/vehicle-reservations/reservable", { hubId }),
  prepareReservation: (hubId: string, vehicleId: string) =>
    api.post<unknown>("/vehicle-reservations/prepare", { hubId, vehicleId }),
  confirmReservation: (hubId: string, vehicleId: string) =>
    api.post<unknown>("/vehicle-reservations", { hubId, vehicleId }),
  cancelReservation: (reservationId: string) => api.post<unknown>(`/vehicle-reservations/${reservationId}/cancel`, {}),
  preparePickUp: (reservationId: string) => api.post<unknown>("/trips/pickup/prepare", { reservationId }),
  confirmPickUp: (reservationId: string) => api.post<unknown>("/trips/pickup/confirm", { reservationId }),
  prepareReturn: (tripId: string, hubId: string) => api.post<unknown>(`/trips/${tripId}/return/prepare`, { hubId }),
  confirmReturn: (tripId: string) => api.post<unknown>(`/trips/${tripId}/return/confirm`, {}),
};
