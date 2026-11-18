// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import { Router } from "express";
import { cancelHoldBody, confirmReservationBody, holdSlotBody, parkingController } from "../controllers/ParkingController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const parkingRoutes = Router();
parkingRoutes.use(requireAuth, requireRole("STUDENT"));

parkingRoutes.get("/slots", parkingController.searchAvailableSlots);
parkingRoutes.post("/holds", validateBody(holdSlotBody), parkingController.holdSlot);
parkingRoutes.get("/holds/active", parkingController.getActiveHold);
parkingRoutes.post("/holds/:holdToken/confirm", validateBody(confirmReservationBody), parkingController.confirmReservation);
parkingRoutes.post("/holds/:holdToken/cancel", validateBody(cancelHoldBody), parkingController.cancelHold);
parkingRoutes.post("/bookings/:bookingId/cancel", parkingController.cancelBooking);
