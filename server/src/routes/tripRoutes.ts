// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle · Bùi Quang Nhân – UC05 Return Shared Vehicle
import { Router } from "express";
import { confirmPickUpBody, pickUpController, preparePickUpBody } from "../controllers/PickUpController";
import { abandonReturnBody, confirmReturnBody, prepareReturnBody, returnController } from "../controllers/ReturnController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const tripRoutes = Router();
tripRoutes.use(requireAuth, requireRole("STUDENT"));

// PickUpController
tripRoutes.post("/pickup/prepare", validateBody(preparePickUpBody), pickUpController.preparePickUp);
tripRoutes.post("/pickup/confirm", validateBody(confirmPickUpBody), pickUpController.confirmPickUp);
tripRoutes.get("/pickup/results/:requestId", pickUpController.getPickUpResult);

// ReturnController
tripRoutes.get("/current", returnController.getCurrentTrip); // thêm ngoài sơ đồ
tripRoutes.post("/:tripId/return/prepare", validateBody(prepareReturnBody), returnController.prepareReturn);
tripRoutes.post("/:tripId/return/confirm", validateBody(confirmReturnBody), returnController.confirmReturn);
tripRoutes.post("/:tripId/return/abandon", validateBody(abandonReturnBody), returnController.abandonReturn);
