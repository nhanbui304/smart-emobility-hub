// Owner: Lê Quốc Linh – View My Reservations
import { Router } from "express";
import { myReservationsController } from "../controllers/MyReservationsController";
import { requireAuth, requireRole } from "../middleware/auth";

export const myReservationsRoutes = Router();

myReservationsRoutes.get("/reservations", requireAuth, requireRole("STUDENT"), myReservationsController.list);
