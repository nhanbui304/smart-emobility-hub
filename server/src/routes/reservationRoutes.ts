// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
import { Router } from "express";
import { confirmCancellationBody, confirmReservationBody, prepareReservationBody, reservationController } from "../controllers/ReservationController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const reservationRoutes = Router();
reservationRoutes.use(requireAuth, requireRole("STUDENT"));

reservationRoutes.get("/reservable", reservationController.getReservableVehicles);
reservationRoutes.post("/prepare", validateBody(prepareReservationBody), reservationController.prepareReservation);
reservationRoutes.post("/", validateBody(confirmReservationBody), reservationController.confirmReservation);
reservationRoutes.get("/results/:requestId", reservationController.getReservationResult);
reservationRoutes.get("/mine", reservationController.getMyReservations);
reservationRoutes.get("/cancellations/results/:requestId", reservationController.getCancellationResult);
reservationRoutes.post("/:reservationId/cancel/prepare", reservationController.prepareCancellation);
reservationRoutes.post("/:reservationId/cancel", validateBody(confirmCancellationBody), reservationController.confirmCancellation);
