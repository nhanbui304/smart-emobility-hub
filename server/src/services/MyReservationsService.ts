// Owner: Lê Quốc Linh – View My Reservations
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { MyReservationsResult } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const myReservationsService = {
  /**
   * View My Reservations: gom các đặt chỗ còn hiệu lực của sinh viên (xe, chỗ đỗ, lịch sạc),
   * sắp xếp theo thời gian gần nhất. Chỉ trả dữ liệu của chính sinh viên đang đăng nhập.
   * TODO: gọi 3 hàm của myReservationsRepository và gộp kết quả.
   */
  async getMyReservations(studentId: string): Promise<MyReservationsResult> {
    throw notImplemented("MyReservationsService.getMyReservations");
  },
};
