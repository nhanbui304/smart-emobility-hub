// Owner: Lê Quốc Linh – View My Reservations
// Gọi API của MyReservationsController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { MyReservationsResult } from "../types";
import { api } from "./client";

export const myReservationsApi = {
  /** GET /api/me/reservations */
  list: () =>
    api.get<MyReservationsResult>("/me/reservations"),
};
