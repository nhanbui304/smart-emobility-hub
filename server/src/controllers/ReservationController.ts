// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { idParams } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { reservationService } from "../services/ReservationService";

export const prepareReservationSchema = z.object({ hubId: z.string().min(1), vehicleId: z.string().min(1) });
export const confirmReservationSchema = prepareReservationSchema;

export const reservationController = {
  /** GET /api/vehicle-reservations/reservable?hubId=... */
  async reservable(req: Request, res: Response): Promise<void> {
    const { hubId } = parseOrThrow(z.object({ hubId: z.string().min(1) }), req.query);
    sendOk(res, await reservationService.getReservableVehicles(currentUser(req).id, hubId));
  },

  /** POST /api/vehicle-reservations/prepare */
  async prepare(req: Request, res: Response): Promise<void> {
    const { hubId, vehicleId } = req.body;
    sendOk(res, await reservationService.prepareReservation(currentUser(req).id, hubId, vehicleId));
  },

  /** POST /api/vehicle-reservations */
  async confirm(req: Request, res: Response): Promise<void> {
    const { hubId, vehicleId } = req.body;
    sendOk(res, await reservationService.confirmReservation(currentUser(req).id, hubId, vehicleId), 201);
  },

  /** POST /api/vehicle-reservations/:id/cancel */
  async cancel(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await reservationService.cancelReservation(currentUser(req).id, id));
  },
};
