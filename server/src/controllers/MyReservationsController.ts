// Owner: Lê Quốc Linh – View My Reservations
import type { Request, Response } from "express";
import { sendOk } from "../lib/response";
import { currentUser } from "../middleware/auth";
import { myReservationsService } from "../services/MyReservationsService";

export const myReservationsController = {
  /** GET /api/me/reservations */
  async list(req: Request, res: Response): Promise<void> {
    sendOk(res, await myReservationsService.getMyReservations(currentUser(req).id));
  },
};
