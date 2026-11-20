// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import { Router } from "express";
import { cancelPendingItemsBody, closeOrderBody, confirmArrivalBody, confirmDepartureBody, createOrderBody, getRedistributionOptionsBody, redistributionController } from "../controllers/RedistributionController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const redistributionRoutes = Router();
redistributionRoutes.use(requireAuth, requireRole("OPERATOR"));

redistributionRoutes.get("/", redistributionController.listOrders);
redistributionRoutes.post("/options", validateBody(getRedistributionOptionsBody), redistributionController.getRedistributionOptions);
redistributionRoutes.post("/", validateBody(createOrderBody), redistributionController.createOrder);
redistributionRoutes.post("/:orderId/items/:vehicleId/depart", validateBody(confirmDepartureBody), redistributionController.confirmDeparture);
redistributionRoutes.post("/:orderId/items/:vehicleId/arrive", validateBody(confirmArrivalBody), redistributionController.confirmArrival);
redistributionRoutes.post("/:orderId/cancel-pending", validateBody(cancelPendingItemsBody), redistributionController.cancelPendingItems);
redistributionRoutes.post("/:orderId/close", validateBody(closeOrderBody), redistributionController.closeOrder);
