// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import { Router } from "express";
import { Role } from "@hub/shared";
import {
  cancelChargingRequestSchema,
  chargingRequestController,
  submitChargingRequestSchema,
} from "../controllers/ChargingRequestController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const chargingRequestRoutes = Router();
chargingRequestRoutes.use(requireAuth, requireRole(Role.STUDENT));

chargingRequestRoutes.post("/", validateBody(submitChargingRequestSchema), chargingRequestController.submit);
chargingRequestRoutes.post("/:id/cancel", validateBody(cancelChargingRequestSchema), chargingRequestController.cancel);
