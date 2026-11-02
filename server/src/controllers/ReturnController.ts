// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField, writeBody } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { returnService } from "../services/ReturnService";

const tripParams = z.object({ tripId: z.string().min(1) });
export const prepareReturnSchema = z.object({ requestId: requestIdField, hubId: z.string().min(1) });
export const returnWriteSchema = writeBody;

export const returnController = {
  /** POST /api/trips/:tripId/return/prepare */
  async prepare(req: Request, res: Response): Promise<void> {
    const { tripId } = parseOrThrow(tripParams, req.params);
    const { requestId, hubId } = req.body;
    sendOk(res, await returnService.prepareReturn(requestId, currentUser(req).id, tripId, hubId));
  },

  /** POST /api/trips/:tripId/return/confirm */
  async confirm(req: Request, res: Response): Promise<void> {
    const { tripId } = parseOrThrow(tripParams, req.params);
    sendOk(res, await returnService.confirmReturn(req.body.requestId, currentUser(req).id, tripId));
  },

  /** POST /api/trips/:tripId/return/abandon */
  async abandon(req: Request, res: Response): Promise<void> {
    const { tripId } = parseOrThrow(tripParams, req.params);
    sendOk(res, await returnService.abandonReturn(req.body.requestId, currentUser(req).id, tripId));
  },
};
