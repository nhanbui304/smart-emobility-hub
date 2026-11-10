// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { returnService } from "../services/ReturnService";

const tripParams = z.object({ tripId: z.string().min(1) });
export const prepareReturnSchema = z.object({ requestId: requestIdField, hubId: z.string().min(1) });
export const returnRequestSchema = z.object({ requestId: requestIdField });

export const returnController = {
  /** POST /api/trips/:tripId/return/prepare – Sequence: prepareReturn(requestId, tripId, hubId) */
  async prepare(req: Request, res: Response): Promise<void> {
    const { tripId } = parseOrThrow(tripParams, req.params);
    const { requestId, hubId } = req.body;
    sendOk(res, await returnService.prepareReturn(requestId, currentUser(req).id, tripId, hubId));
  },

  /** POST /api/trips/:tripId/return/confirm – Sequence: confirmReturn(requestId, tripId) */
  async confirm(req: Request, res: Response): Promise<void> {
    const { tripId } = parseOrThrow(tripParams, req.params);
    sendOk(res, await returnService.confirmReturn(req.body.requestId, currentUser(req).id, tripId));
  },

  /** POST /api/trips/:tripId/return/abandon – Sequence: abandonReturn(requestId, tripId) */
  async abandon(req: Request, res: Response): Promise<void> {
    const { tripId } = parseOrThrow(tripParams, req.params);
    sendOk(res, await returnService.abandonReturn(req.body.requestId, currentUser(req).id, tripId));
  },
};
