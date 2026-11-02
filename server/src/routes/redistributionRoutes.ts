// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import { Router } from "express";
import { Role } from "@hub/shared";
import {
  createOrderSchema,
  redistributionController as c,
  redistributionWriteSchema,
} from "../controllers/RedistributionController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const redistributionRoutes = Router();
redistributionRoutes.use(requireAuth, requireRole(Role.OPERATOR));

redistributionRoutes.post("/", validateBody(createOrderSchema), c.create);
redistributionRoutes.post("/:id/items/:vehicleId/depart", validateBody(redistributionWriteSchema), c.depart);
redistributionRoutes.post("/:id/items/:vehicleId/arrive", validateBody(redistributionWriteSchema), c.arrive);
redistributionRoutes.post("/:id/cancel-pending", validateBody(redistributionWriteSchema), c.cancelPending);
