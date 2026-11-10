// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import { Router } from "express";
import { holdSchema, parkingController, parkingRequestSchema } from "../controllers/ParkingController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const parkingRoutes = Router();
parkingRoutes.use(requireAuth, requireRole("STUDENT"));

parkingRoutes.get("/slots", parkingController.search);
parkingRoutes.get("/holds/active", parkingController.activeHold);
parkingRoutes.post("/holds", validateBody(holdSchema), parkingController.hold);
parkingRoutes.post("/holds/:holdToken/confirm", validateBody(parkingRequestSchema), parkingController.confirm);
parkingRoutes.post("/holds/:holdToken/cancel", validateBody(parkingRequestSchema), parkingController.cancelHold);
parkingRoutes.post("/bookings/:bookingId/cancel", parkingController.cancelBooking);
