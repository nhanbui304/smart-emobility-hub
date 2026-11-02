// Owner: Ngô Minh Triết (UC08 Schedule Charging Session), Nguyễn Hoàng Nhân (UC09 Manage Scheduled Charging Session)
import { Router } from "express";
import { Role } from "@hub/shared";
import {
  cancelChargingSchema,
  chargingReservationController as c,
  confirmChargingSchema,
  confirmRescheduleSchema,
  findSlotsSchema,
  rescheduleOptionsSchema,
} from "../controllers/ChargingReservationController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const chargingReservationRoutes = Router();
chargingReservationRoutes.use(requireAuth, requireRole(Role.STUDENT));

// UC08
chargingReservationRoutes.post("/search", validateBody(findSlotsSchema), c.search);
chargingReservationRoutes.post("/", validateBody(confirmChargingSchema), c.confirm);
// UC09
chargingReservationRoutes.get("/:id", c.detail);
chargingReservationRoutes.post("/:id/reschedule/start", c.startReschedule);
chargingReservationRoutes.post("/:id/reschedule/options", validateBody(rescheduleOptionsSchema), c.rescheduleOptions);
chargingReservationRoutes.post("/:id/reschedule/confirm", validateBody(confirmRescheduleSchema), c.confirmReschedule);
chargingReservationRoutes.get("/:id/cancellation-check", c.checkCancellation);
chargingReservationRoutes.post("/:id/cancel", validateBody(cancelChargingSchema), c.cancel);
