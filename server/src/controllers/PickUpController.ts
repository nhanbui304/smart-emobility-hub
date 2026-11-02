// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";

import { currentUser } from "../middleware/auth";
import { pickUpService } from "../services/PickUpService";

export const preparePickUpSchema = z.object({ reservationId: z.string().min(1) });
export const confirmPickUpSchema = preparePickUpSchema;

export const pickUpController = {
  /** POST /api/trips/pickup/prepare */
  async prepare(req: Request, res: Response): Promise<void> {
    sendOk(res, await pickUpService.preparePickUp(currentUser(req).id, req.body.reservationId));
  },

  /** POST /api/trips/pickup/confirm */
  async confirm(req: Request, res: Response): Promise<void> {
    const { reservationId } = req.body;
    sendOk(res, await pickUpService.confirmPickUp(currentUser(req).id, reservationId));
  },
};
