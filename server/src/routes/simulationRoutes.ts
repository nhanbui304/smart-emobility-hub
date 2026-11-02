// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import { Router } from "express";
import { Role } from "@hub/shared";
import { scenarioSchema, simulationController as c, snapshotSchema, startRunSchema } from "../controllers/SimulationController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const simulationRoutes = Router();
simulationRoutes.use(requireAuth, requireRole(Role.OPERATOR));

simulationRoutes.post("/snapshots", validateBody(snapshotSchema), c.snapshot);
simulationRoutes.post("/scenarios", validateBody(scenarioSchema), c.scenario);
simulationRoutes.post("/runs", validateBody(startRunSchema), c.start);
simulationRoutes.post("/runs/:id/stop", c.stop);
simulationRoutes.get("/runs/:id", c.result);
