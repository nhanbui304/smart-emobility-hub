// Owner: Lê Quốc Linh (UC02–UC04), Bùi Quang Nhân (UC05), Ngô Minh Triết (UC01)
import { api } from "./client";

export const vehicleApi = {
  findOptions: (criteria: Record<string, unknown>) => api.post<unknown>("/search/options", criteria),
  reservableVehicles: (hubId: string) => api.get<unknown>("/vehicle-reservations/reservable", { hubId }),
  prepareReservation: (hubId: string, vehicleId: string) =>
    api.post<unknown>("/vehicle-reservations/prepare", { hubId, vehicleId }),
  confirmReservation: (requestId: string, hubId: string, vehicleId: string) =>
    api.post<unknown>("/vehicle-reservations", { requestId, hubId, vehicleId }),
  cancelReservation: (requestId: string, reservationId: string) =>
    api.post<unknown>(`/vehicle-reservations/${reservationId}/cancel`, { requestId }),
  preparePickUp: (reservationId: string) => api.post<unknown>("/trips/pickup/prepare", { reservationId }),
  confirmPickUp: (requestId: string, reservationId: string) =>
    api.post<unknown>("/trips/pickup/confirm", { requestId, reservationId }),
  prepareReturn: (requestId: string, tripId: string, hubId: string) =>
    api.post<unknown>(`/trips/${tripId}/return/prepare`, { requestId, hubId }),
  confirmReturn: (requestId: string, tripId: string) => api.post<unknown>(`/trips/${tripId}/return/confirm`, { requestId }),
};
