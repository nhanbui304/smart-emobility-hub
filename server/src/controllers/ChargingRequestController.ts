// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { idParams, requestIdField, writeBody } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { chargingRequestService } from "../services/ChargingRequestService";

export const submitChargingRequestSchema = z.object({
  requestId: requestIdField,
  hubId: z.string().min(1),
  vehicleRef: z.string().min(1),
  need: z.object({
    currentBattery: z.number().int().min(0).max(100),
    targetBattery: z.number().int().min(1).max(100),
  }),
});
export const cancelChargingRequestSchema = writeBody;

export const chargingRequestController = {
  /** POST /api/charging-requests */
  async submit(req: Request, res: Response): Promise<void> {
    const { requestId, hubId, vehicleRef, need } = req.body;
    sendOk(
      res,
      await chargingRequestService.submitChargingRequest(requestId, currentUser(req).id, hubId, vehicleRef, need),
      201,
    );
  },

  /** POST /api/charging-requests/:id/cancel */
  async cancel(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await chargingRequestService.cancelChargingRequest(req.body.requestId, currentUser(req).id, id));
  },
};
