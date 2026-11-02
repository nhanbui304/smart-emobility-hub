// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { idParams } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { redistributionService } from "../services/RedistributionService";

export const createOrderSchema = z
  .object({
    sourceHubId: z.string().min(1),
    targetHubId: z.string().min(1),
    vehicleIds: z.array(z.string().min(1)).min(1, "Chọn ít nhất một xe."),
    eta: z.coerce.date().nullable().default(null),
  })
  .refine((b) => b.sourceHubId !== b.targetHubId, { message: "Hub nguồn và Hub đích phải khác nhau." });

const itemParams = z.object({ id: z.string().min(1), vehicleId: z.string().min(1) });

export const redistributionController = {
  /** POST /api/redistribution-orders */
  async create(req: Request, res: Response): Promise<void> {
    const { sourceHubId, targetHubId, vehicleIds, eta } = req.body;
    sendOk(
      res,
      await redistributionService.createOrder(sourceHubId, targetHubId, vehicleIds, eta, currentUser(req).id),
      201,
    );
  },

  /** POST /api/redistribution-orders/:id/items/:vehicleId/depart */
  async depart(req: Request, res: Response): Promise<void> {
    const { id, vehicleId } = parseOrThrow(itemParams, req.params);
    sendOk(res, await redistributionService.confirmDeparture(id, vehicleId, currentUser(req).id));
  },

  /** POST /api/redistribution-orders/:id/items/:vehicleId/arrive */
  async arrive(req: Request, res: Response): Promise<void> {
    const { id, vehicleId } = parseOrThrow(itemParams, req.params);
    sendOk(res, await redistributionService.confirmArrival(id, vehicleId, currentUser(req).id));
  },

  /** POST /api/redistribution-orders/:id/cancel-pending */
  async cancelPending(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await redistributionService.cancelPendingItems(id, currentUser(req).id));
  },
};
