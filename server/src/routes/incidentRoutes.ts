// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import { Router } from "express";
import {
  handlingPlanSchema,
  incidentController,
  reportIncidentSchema,
  verifyResolutionSchema,
} from "../controllers/IncidentController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const incidentRoutes = Router();
incidentRoutes.use(requireAuth, requireRole("OPERATOR"));

incidentRoutes.get("/context", incidentController.context);
incidentRoutes.get("/:id", incidentController.detail);
incidentRoutes.post("/", validateBody(reportIncidentSchema), incidentController.report);
incidentRoutes.post("/:id/handling-plan", validateBody(handlingPlanSchema), incidentController.handlingPlan);
incidentRoutes.post("/:id/verify", validateBody(verifyResolutionSchema), incidentController.verify);
