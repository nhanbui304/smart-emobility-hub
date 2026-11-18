// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Gọi API của ReturnController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { ReturnPreparation, ReturnResult, Trip } from "../types";
import { api } from "./client";

export const returnApi = {
  /** POST /api/trips/:tripId/return/prepare */
  prepareReturn: (requestId: string, tripId: string, hubId: string) =>
    api.post<ReturnPreparation>(`/trips/${tripId}/return/prepare`, { requestId, hubId }),
  /** POST /api/trips/:tripId/return/confirm */
  confirmReturn: (requestId: string, tripId: string) =>
    api.post<ReturnResult>(`/trips/${tripId}/return/confirm`, { requestId }),
  /** POST /api/trips/:tripId/return/abandon */
  abandonReturn: (requestId: string, tripId: string) =>
    api.post<Trip>(`/trips/${tripId}/return/abandon`, { requestId }),
};
