// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import { Router } from "express";
import { cancelChargingRequestBody, chargingRequestController, prepareChargingRequestBody, submitChargingRequestBody } from "../controllers/ChargingRequestController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const chargingRequestRoutes = Router();
chargingRequestRoutes.use(requireAuth, requireRole("STUDENT"));

chargingRequestRoutes.get("/my-context", chargingRequestController.getMyContext);
chargingRequestRoutes.post("/prepare", validateBody(prepareChargingRequestBody), chargingRequestController.prepareChargingRequest);
chargingRequestRoutes.post("/", validateBody(submitChargingRequestBody), chargingRequestController.submitChargingRequest);
chargingRequestRoutes.post("/:chargingRequestId/cancel", validateBody(cancelChargingRequestBody), chargingRequestController.cancelChargingRequest);
