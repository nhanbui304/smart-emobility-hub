// Owner: Lê Quốc Linh – View My Reservations
import { Router } from "express";
import { Role } from "@hub/shared";
import { myReservationsController } from "../controllers/MyReservationsController";
import { requireAuth, requireRole } from "../middleware/auth";

export const myReservationsRoutes = Router();

myReservationsRoutes.get("/reservations", requireAuth, requireRole(Role.STUDENT), myReservationsController.list);
