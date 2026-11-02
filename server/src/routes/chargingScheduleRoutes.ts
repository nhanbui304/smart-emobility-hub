// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import { Router } from "express";
import {
  applyPlanSchema,
  chargingScheduleController as c,
  proposalSchema,
  validatePlanSchema,
} from "../controllers/ChargingScheduleController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const chargingScheduleRoutes = Router();
chargingScheduleRoutes.use(requireAuth, requireRole("OPERATOR"));

chargingScheduleRoutes.get("/context", c.context);
chargingScheduleRoutes.post("/proposals", validateBody(proposalSchema), c.propose);
chargingScheduleRoutes.post("/proposals/:planDraftId/validate", validateBody(validatePlanSchema), c.validate);
chargingScheduleRoutes.post("/apply", validateBody(applyPlanSchema), c.apply);
