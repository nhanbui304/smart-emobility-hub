// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { idParams, timeRangeSchema } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { simulationService } from "../services/SimulationService";

export const snapshotSchema = z.object({ hubIds: z.array(z.string().min(1)).min(1), timeRange: timeRangeSchema });
export const scenarioSchema = z.object({
  snapshotId: z.string().min(1),
  scenarioType: z.enum(["DEMAND_SURGE", "HUB_CLOSURE", "ADD_CHARGERS", "ADD_VEHICLES"]),
  assumptions: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});
export const startRunSchema = z.object({ scenarioDraftId: z.string().min(1) });

export const simulationController = {
  /** POST /api/simulations/snapshots */
  async snapshot(req: Request, res: Response): Promise<void> {
    sendOk(res, await simulationService.captureStateSnapshot(req.body.hubIds, req.body.timeRange), 201);
  },

  /** POST /api/simulations/scenarios */
  async scenario(req: Request, res: Response): Promise<void> {
    const { snapshotId, scenarioType, assumptions } = req.body;
    sendOk(res, await simulationService.prepareScenario(snapshotId, scenarioType, assumptions), 201);
  },

  /** POST /api/simulations/runs */
  async start(req: Request, res: Response): Promise<void> {
    const { scenarioDraftId } = req.body;
    sendOk(res, await simulationService.startRun(scenarioDraftId, currentUser(req).id), 202);
  },

  /** POST /api/simulations/runs/:id/stop */
  async stop(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.stopRun(id));
  },

  /** GET /api/simulations/runs/:id */
  async result(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await simulationService.getRunResult(id));
  },
};
