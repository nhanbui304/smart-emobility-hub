// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { returnService } from "../services/ReturnService";

export const prepareReturnBody = z.object({ requestId: requestIdField, hubId: z.string().min(1) });
export const confirmReturnBody = z.object({ requestId: requestIdField });
export const abandonReturnBody = z.object({ requestId: requestIdField });

export const returnController = {
  /** POST /api/trips/:tripId/return/prepare */
  async prepareReturn(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { tripId } = parseOrThrow(z.object({ tripId: z.string().min(1) }), req.params);
    const { requestId, hubId } = req.body as z.infer<typeof prepareReturnBody>;
    sendOk(res, await returnService.prepareReturn(requestId, user.id, tripId, hubId));
  },

  /** POST /api/trips/:tripId/return/confirm */
  async confirmReturn(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { tripId } = parseOrThrow(z.object({ tripId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof confirmReturnBody>;
    sendOk(res, await returnService.confirmReturn(requestId, user.id, tripId));
  },

  /** POST /api/trips/:tripId/return/abandon */
  async abandonReturn(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { tripId } = parseOrThrow(z.object({ tripId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof abandonReturnBody>;
    sendOk(res, await returnService.abandonReturn(requestId, user.id, tripId));
  },

  /** GET /api/trips/current – thêm ngoài sơ đồ: chuyến đi chưa kết thúc của sinh viên (trang Chuyến đi). */
  async getCurrentTrip(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    sendOk(res, (await returnService.getCurrentTrip(user.id)) ?? null);
  },
};
