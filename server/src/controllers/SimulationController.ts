// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { idParams, requestIdField, timeRangeSchema } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { simulationService } from "../services/SimulationService";

export const snapshotSchema = z.object({ hubIds: z.array(z.string().min(1)).min(1), timeRange: timeRangeSchema });
export const scenarioSchema = z.object({
  snapshotId: z.string().min(1),
  scenarioType: z.enum(["DEMAND_SURGE", "HUB_CLOSURE", "ADD_CHARGERS", "ADD_VEHICLES"]),
  assumptions: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});
export const startRunSchema = z.object({ requestId: requestIdField, scenarioDraftId: z.string().min(1) });
export const handoffSchema = z.object({ recommendationId: z.string().min(1) });

export const simulationController = {
  /** POST /api/simulations/snapshots – Sequence: prepareSimulation */
  async snapshot(req: Request, res: Response): Promise<void> {
    const { hubIds, timeRange } = req.body;
    sendOk(res, await simulationService.captureStateSnapshot(currentUser(req).id, hubIds, timeRange), 201);
  },

  /** POST /api/simulations/snapshots/:id/accept-stale – Sequence: acceptStaleSnapshot */
  async acceptStale(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.recordStaleDataAcceptance(id, currentUser(req).id));
  },

  /** POST /api/simulations/scenarios – Sequence: submitScenario */
  async scenario(req: Request, res: Response): Promise<void> {
    const { snapshotId, scenarioType, assumptions } = req.body;
    sendOk(res, await simulationService.prepareScenario(snapshotId, scenarioType, assumptions), 201);
  },

  /** POST /api/simulations/runs – Sequence: runSimulation */
  async start(req: Request, res: Response): Promise<void> {
    const { requestId, scenarioDraftId } = req.body;
    sendOk(res, await simulationService.startRun(requestId, scenarioDraftId, currentUser(req).id), 202);
  },

  /** POST /api/simulations/runs/:id/stop – Sequence: stopRun */
  async stop(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.stopRun(id));
  },

  /** GET /api/simulations/runs/:id – Sequence: getRunResult */
  async result(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.getRunResult(id));
  },

  /** POST /api/simulations/runs/:id/retry-save – Sequence: retrySaveRun */
  async retrySave(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.retrySaveRun(id));
  },

  /** POST /api/simulations/runs/:id/handoff – Sequence: prepareOperationalHandoff */
  async handoff(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.prepareOperationalHandoff(id, req.body.recommendationId));
  },
};
