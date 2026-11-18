// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import { Router } from "express";
import { prepareOperationalHandoffBody, prepareSimulationBody, runSimulationBody, simulationController, submitScenarioBody } from "../controllers/SimulationController";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

export const simulationRoutes = Router();
simulationRoutes.use(requireAuth, requireRole("OPERATOR"));

simulationRoutes.post("/snapshots", validateBody(prepareSimulationBody), simulationController.prepareSimulation);
simulationRoutes.post("/snapshots/:snapshotId/accept-stale", simulationController.acceptStaleSnapshot);
simulationRoutes.post("/scenarios", validateBody(submitScenarioBody), simulationController.submitScenario);
simulationRoutes.post("/runs", validateBody(runSimulationBody), simulationController.runSimulation);
simulationRoutes.post("/runs/:runId/stop", simulationController.stopRun);
simulationRoutes.get("/runs/:runId", simulationController.getRunResult);
simulationRoutes.post("/runs/:runId/retry-save", simulationController.retrySaveRun);
simulationRoutes.post("/handoffs", validateBody(prepareOperationalHandoffBody), simulationController.prepareOperationalHandoff);
