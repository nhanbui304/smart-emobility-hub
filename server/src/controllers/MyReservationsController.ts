// Owner: Lê Quốc Linh – View My Reservations
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { currentUser } from "../middleware/auth";
import { myReservationsService } from "../services/MyReservationsService";

export const myReservationsController = {
  /** GET /api/me/reservations */
  async list(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    sendOk(res, await myReservationsService.getMyReservations(user.id));
  },
};
