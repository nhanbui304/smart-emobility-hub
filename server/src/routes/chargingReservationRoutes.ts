// Owner: Ngô Minh Triết – UC08 Schedule Charging Session; Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
import { Router } from "express";
import { cancelReservationBody, chargingReservationController, confirmChargingReservationBody, confirmRescheduleBody, findChargingSlotsBody, findRescheduleOptionsBody } from "../controllers/ChargingReservationController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const chargingReservationRoutes = Router();
chargingReservationRoutes.use(requireAuth, requireRole("STUDENT"));

chargingReservationRoutes.post("/search", validateBody(findChargingSlotsBody), chargingReservationController.findChargingSlots);
chargingReservationRoutes.post("/", validateBody(confirmChargingReservationBody), chargingReservationController.confirmChargingReservation);
chargingReservationRoutes.get("/:reservationId", chargingReservationController.getReservationDetail);
chargingReservationRoutes.post("/:reservationId/reschedule/start", chargingReservationController.startReschedule);
chargingReservationRoutes.post("/:reservationId/reschedule/options", validateBody(findRescheduleOptionsBody), chargingReservationController.findRescheduleOptions);
chargingReservationRoutes.post("/:reservationId/reschedule/confirm", validateBody(confirmRescheduleBody), chargingReservationController.confirmReschedule);
chargingReservationRoutes.get("/:reservationId/cancellation-check", chargingReservationController.checkCancellation);
chargingReservationRoutes.post("/:reservationId/cancel", validateBody(cancelReservationBody), chargingReservationController.cancelReservation);
