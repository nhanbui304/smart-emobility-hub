// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { pickUpService } from "../services/PickUpService";

export const preparePickUpBody = z.object({ reservationId: z.string().min(1) });
export const confirmPickUpBody = z.object({ requestId: requestIdField, reservationId: z.string().min(1) });

export const pickUpController = {
  /** POST /api/trips/pickup/prepare */
  async preparePickUp(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = req.body as z.infer<typeof preparePickUpBody>;
    sendOk(res, await pickUpService.preparePickUp(user.id, reservationId));
  },

  /** POST /api/trips/pickup/confirm */
  async confirmPickUp(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId, reservationId } = req.body as z.infer<typeof confirmPickUpBody>;
    sendOk(res, await pickUpService.confirmPickUp(requestId, user.id, reservationId));
  },

  /** GET /api/trips/pickup/results/:requestId */
  async getPickUpResult(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId } = parseOrThrow(z.object({ requestId: z.string().min(1) }), req.params);
    sendOk(res, await pickUpService.getPickUpResult(requestId, user.id));
  },
};
