// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm)
import { Router } from "express";
import { hubController } from "../controllers/HubController";
import { requireAuth } from "../middleware/auth";

/** Student và Operator đều xem được trạng thái Hub. */
export const hubRoutes = Router();

hubRoutes.get("/", requireAuth, hubController.list);
hubRoutes.get("/:id", requireAuth, hubController.detail);
