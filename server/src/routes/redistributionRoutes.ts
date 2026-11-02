// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import { Router } from "express";
import { createOrderSchema, redistributionController as c } from "../controllers/RedistributionController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const redistributionRoutes = Router();
redistributionRoutes.use(requireAuth, requireRole("OPERATOR"));

redistributionRoutes.post("/", validateBody(createOrderSchema), c.create);
redistributionRoutes.post("/:id/items/:vehicleId/depart", c.depart);
redistributionRoutes.post("/:id/items/:vehicleId/arrive", c.arrive);
redistributionRoutes.post("/:id/cancel-pending", c.cancelPending);
