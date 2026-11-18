// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { redistributionService } from "../services/RedistributionService";

export const getRedistributionOptionsBody = z.object({
  sourceHubId: z.string().min(1),
  targetHubId: z.string().min(1),
  eta: z.coerce.date(),
});
export const createOrderBody = z.object({
  requestId: requestIdField,
  sourceHubId: z.string().min(1),
  targetHubId: z.string().min(1),
  vehicleIds: z.array(z.string().min(1)),
  eta: z.coerce.date(),
});
export const confirmDepartureBody = z.object({ requestId: requestIdField });
export const confirmArrivalBody = z.object({ requestId: requestIdField });
export const cancelPendingItemsBody = z.object({ requestId: requestIdField });
export const closeOrderBody = z.object({ requestId: requestIdField });

export const redistributionController = {
  /** POST /api/redistribution-orders/options */
  async getRedistributionOptions(req: Request, res: Response): Promise<void> {
    const { sourceHubId, targetHubId, eta } = req.body as z.infer<typeof getRedistributionOptionsBody>;
    sendOk(res, await redistributionService.getRedistributionOptions(sourceHubId, targetHubId, [] /* Controller (Sub #3) không nhận vehicleIds: [] = xét mọi xe ở Hub nguồn */, eta));
  },

  /** POST /api/redistribution-orders */
  async createOrder(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId, sourceHubId, targetHubId, vehicleIds, eta } = req.body as z.infer<typeof createOrderBody>;
    sendOk(res, await redistributionService.createOrder(requestId, sourceHubId, targetHubId, vehicleIds, eta, user.id));
  },

  /** POST /api/redistribution-orders/:orderId/items/:vehicleId/depart */
  async confirmDeparture(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { orderId, vehicleId } = parseOrThrow(z.object({ orderId: z.string().min(1), vehicleId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof confirmDepartureBody>;
    sendOk(res, await redistributionService.confirmDeparture(requestId, orderId, vehicleId, user.id));
  },

  /** POST /api/redistribution-orders/:orderId/items/:vehicleId/arrive */
  async confirmArrival(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { orderId, vehicleId } = parseOrThrow(z.object({ orderId: z.string().min(1), vehicleId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof confirmArrivalBody>;
    sendOk(res, await redistributionService.confirmArrival(requestId, orderId, vehicleId, user.id));
  },

  /** POST /api/redistribution-orders/:orderId/cancel-pending */
  async cancelPendingItems(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { orderId } = parseOrThrow(z.object({ orderId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof cancelPendingItemsBody>;
    sendOk(res, await redistributionService.cancelPendingItems(requestId, orderId, user.id));
  },

  /** POST /api/redistribution-orders/:orderId/close */
  async closeOrder(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { orderId } = parseOrThrow(z.object({ orderId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof closeOrderBody>;
    sendOk(res, await redistributionService.closeOrder(requestId, orderId, user.id));
  },
};
