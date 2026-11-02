// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import { Router } from "express";
import { holdSchema, parkingController } from "../controllers/ParkingController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const parkingRoutes = Router();
parkingRoutes.use(requireAuth, requireRole("STUDENT"));

parkingRoutes.get("/slots", parkingController.search);
parkingRoutes.post("/holds", validateBody(holdSchema), parkingController.hold);
parkingRoutes.post("/holds/:holdToken/confirm", parkingController.confirm);
parkingRoutes.post("/holds/:holdToken/cancel", parkingController.cancelHold);
parkingRoutes.post("/bookings/:bookingId/cancel", parkingController.cancelBooking);
