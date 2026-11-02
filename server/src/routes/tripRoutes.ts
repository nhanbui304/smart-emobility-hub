// Owner: Lê Quốc Linh (UC04 Pick Up Shared Vehicle), Bùi Quang Nhân (UC05 Return Shared Vehicle)
import { Router } from "express";
import { confirmPickUpSchema, pickUpController, preparePickUpSchema } from "../controllers/PickUpController";
import { prepareReturnSchema, returnController } from "../controllers/ReturnController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const tripRoutes = Router();
tripRoutes.use(requireAuth, requireRole("STUDENT"));

// UC04
tripRoutes.post("/pickup/prepare", validateBody(preparePickUpSchema), pickUpController.prepare);
tripRoutes.post("/pickup/confirm", validateBody(confirmPickUpSchema), pickUpController.confirm);
// UC05
tripRoutes.post("/:tripId/return/prepare", validateBody(prepareReturnSchema), returnController.prepare);
tripRoutes.post("/:tripId/return/confirm", returnController.confirm);
tripRoutes.post("/:tripId/return/abandon", returnController.abandon);
