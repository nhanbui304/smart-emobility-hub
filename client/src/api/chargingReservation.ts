// Owner: Ngô Minh Triết – UC08 Schedule Charging Session; Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
// Gọi API của ChargingReservationController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { CancellationCheck, CancellationResult, ChargingNeed, ChargingSlotOption, CreateResult, RescheduleForm, ReservationDetail, SlotQueryResult, TimeRange, UpdatedReservation } from "../types";
import { api } from "./client";

export const chargingReservationApi = {
  /** POST /api/charging-reservations/search */
  findChargingSlots: (
    vehicleId: string,
    hubId: string,
    date: string,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
  ) =>
    api.post<SlotQueryResult>("/charging-reservations/search", { vehicleId, hubId, date, timeRange, chargingNeed }),
  /** POST /api/charging-reservations */
  confirmChargingReservation: (requestId: string, slotOptionId: string) =>
    api.post<CreateResult>("/charging-reservations", { requestId, slotOptionId }),
  /** GET /api/charging-reservations/:reservationId */
  getReservationDetail: (reservationId: string) =>
    api.get<ReservationDetail>(`/charging-reservations/${reservationId}`),
  /** POST /api/charging-reservations/:reservationId/reschedule/start */
  startReschedule: (reservationId: string) =>
    api.post<RescheduleForm>(`/charging-reservations/${reservationId}/reschedule/start`, {}),
  /** POST /api/charging-reservations/:reservationId/reschedule/options */
  findRescheduleOptions: (reservationId: string, hubId: string, timeRange: TimeRange, chargingNeed: ChargingNeed) =>
    api.post<ChargingSlotOption[]>(`/charging-reservations/${reservationId}/reschedule/options`, { hubId, timeRange, chargingNeed }),
  /** POST /api/charging-reservations/:reservationId/reschedule/confirm */
  confirmReschedule: (requestId: string, reservationId: string, optionId: string, expectedVersion: number) =>
    api.post<UpdatedReservation>(`/charging-reservations/${reservationId}/reschedule/confirm`, { requestId, optionId, expectedVersion }),
  /** GET /api/charging-reservations/:reservationId/cancellation-check */
  checkCancellation: (reservationId: string) =>
    api.get<CancellationCheck>(`/charging-reservations/${reservationId}/cancellation-check`),
  /** POST /api/charging-reservations/:reservationId/cancel */
  cancelReservation: (requestId: string, reservationId: string, expectedVersion: number) =>
    api.post<CancellationResult>(`/charging-reservations/${reservationId}/cancel`, { requestId, expectedVersion }),
};
