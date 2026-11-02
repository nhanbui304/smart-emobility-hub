// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
import { Router } from "express";
import { monitoringController } from "../controllers/MonitoringController";
import { requireAuth, requireRole } from "../middleware/auth";

export const monitoringRoutes = Router();
monitoringRoutes.use(requireAuth, requireRole("OPERATOR"));

monitoringRoutes.get("/overview", monitoringController.overview);
monitoringRoutes.get("/hubs/:hubId", monitoringController.hubDetail);
