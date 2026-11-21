// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import { Router } from "express";
import { incidentController, submitHandlingPlanBody, submitIncidentBody, submitResolutionResultBody } from "../controllers/IncidentController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const incidentRoutes = Router();
incidentRoutes.use(requireAuth, requireRole("OPERATOR"));

incidentRoutes.get("/", incidentController.listOverview);
incidentRoutes.get("/resources/:resourceId", incidentController.openIncidentManagement);
incidentRoutes.get("/:incidentId", incidentController.openExistingIncident);
incidentRoutes.post("/", validateBody(submitIncidentBody), incidentController.submitIncident);
incidentRoutes.post("/:incidentId/handling-plan", validateBody(submitHandlingPlanBody), incidentController.submitHandlingPlan);
incidentRoutes.post("/:incidentId/resolution", validateBody(submitResolutionResultBody), incidentController.submitResolutionResult);
