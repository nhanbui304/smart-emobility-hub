// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
// Gọi API của ReservationController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { CancellationPreview, ReservationPreview, SharedVehicle, VehicleReservation } from "../types";
import { api } from "./client";

export const reservationApi = {
  /** GET /api/vehicle-reservations/reservable */
  getReservableVehicles: (hubId: string) =>
    api.get<SharedVehicle[]>("/vehicle-reservations/reservable", { hubId }),
  /** POST /api/vehicle-reservations/prepare */
  prepareReservation: (hubId: string, vehicleId: string) =>
    api.post<ReservationPreview>("/vehicle-reservations/prepare", { hubId, vehicleId }),
  /** POST /api/vehicle-reservations */
  confirmReservation: (requestId: string, hubId: string, vehicleId: string) =>
    api.post<VehicleReservation>("/vehicle-reservations", { requestId, hubId, vehicleId }),
  /** GET /api/vehicle-reservations/results/:requestId */
  getReservationResult: (requestId: string) =>
    api.get<VehicleReservation>(`/vehicle-reservations/results/${requestId}`),
  /** GET /api/vehicle-reservations/mine */
  getMyReservations: () =>
    api.get<VehicleReservation[]>("/vehicle-reservations/mine"),
  /** GET /api/vehicle-reservations/cancellations/results/:requestId */
  getCancellationResult: (requestId: string) =>
    api.get<VehicleReservation>(`/vehicle-reservations/cancellations/results/${requestId}`),
  /** POST /api/vehicle-reservations/:reservationId/cancel/prepare */
  prepareCancellation: (reservationId: string) =>
    api.post<CancellationPreview>(`/vehicle-reservations/${reservationId}/cancel/prepare`, {}),
  /** POST /api/vehicle-reservations/:reservationId/cancel */
  confirmCancellation: (requestId: string, reservationId: string) =>
    api.post<VehicleReservation>(`/vehicle-reservations/${reservationId}/cancel`, { requestId }),
};
