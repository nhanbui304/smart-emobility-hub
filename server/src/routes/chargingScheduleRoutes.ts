// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import { Router } from "express";
import { applyChargingScheduleBody, chargingScheduleController, generateProposedScheduleBody, validatePlanBody } from "../controllers/ChargingScheduleController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const chargingScheduleRoutes = Router();
chargingScheduleRoutes.use(requireAuth, requireRole("OPERATOR"));

chargingScheduleRoutes.get("/context", chargingScheduleController.loadChargingContext);
chargingScheduleRoutes.post("/proposals", validateBody(generateProposedScheduleBody), chargingScheduleController.generateProposedSchedule);
chargingScheduleRoutes.post("/proposals/:planDraftId/validate", validateBody(validatePlanBody), chargingScheduleController.validatePlan);
chargingScheduleRoutes.post("/apply", validateBody(applyChargingScheduleBody), chargingScheduleController.applyChargingSchedule);
