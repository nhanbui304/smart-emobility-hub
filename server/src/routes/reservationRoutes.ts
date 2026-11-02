// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
import { Router } from "express";
import {
  confirmReservationSchema,
  prepareReservationSchema,
  reservationController,
} from "../controllers/ReservationController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const reservationRoutes = Router();
reservationRoutes.use(requireAuth, requireRole("STUDENT"));

reservationRoutes.get("/reservable", reservationController.reservable);
reservationRoutes.post("/prepare", validateBody(prepareReservationSchema), reservationController.prepare);
reservationRoutes.post("/", validateBody(confirmReservationSchema), reservationController.confirm);
reservationRoutes.post("/:id/cancel", reservationController.cancel);
