// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { chargingNeedSchema, requestIdField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { chargingRequestService } from "../services/ChargingRequestService";

export const prepareChargingRequestBody = z.object({
  hubId: z.string().min(1),
  vehicleId: z.string().min(1),
  chargingNeed: chargingNeedSchema,
});
export const submitChargingRequestBody = z.object({
  requestId: requestIdField,
  hubId: z.string().min(1),
  vehicleId: z.string().min(1),
  chargingNeed: chargingNeedSchema,
});
export const cancelChargingRequestBody = z.object({ requestId: requestIdField });

export const chargingRequestController = {
  /** POST /api/charging-requests/prepare */
  async prepareChargingRequest(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { hubId, vehicleId, chargingNeed } = req.body as z.infer<typeof prepareChargingRequestBody>;
    sendOk(res, await chargingRequestService.prepareChargingRequest(user.id, hubId, vehicleId, chargingNeed));
  },

  /** POST /api/charging-requests */
  async submitChargingRequest(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId, hubId, vehicleId, chargingNeed } = req.body as z.infer<typeof submitChargingRequestBody>;
    sendOk(res, await chargingRequestService.submitChargingRequest(requestId, user.id, hubId, vehicleId, chargingNeed));
  },

  /** POST /api/charging-requests/:chargingRequestId/cancel */
  async cancelChargingRequest(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { chargingRequestId } = parseOrThrow(z.object({ chargingRequestId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof cancelChargingRequestBody>;
    sendOk(res, await chargingRequestService.cancelChargingRequest(requestId, user.id, chargingRequestId));
  },
};
