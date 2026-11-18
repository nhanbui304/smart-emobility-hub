// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Gọi API của PickUpController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { PickUpPreview, PickUpResult } from "../types";
import { api } from "./client";

export const pickUpApi = {
  /** POST /api/trips/pickup/prepare */
  preparePickUp: (reservationId: string) =>
    api.post<PickUpPreview>("/trips/pickup/prepare", { reservationId }),
  /** POST /api/trips/pickup/confirm */
  confirmPickUp: (requestId: string, reservationId: string) =>
    api.post<PickUpResult>("/trips/pickup/confirm", { requestId, reservationId }),
  /** GET /api/trips/pickup/results/:requestId */
  getPickUpResult: (requestId: string) =>
    api.get<PickUpResult>(`/trips/pickup/results/${requestId}`),
};
