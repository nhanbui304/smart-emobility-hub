// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { SCENARIO_TYPES } from "../constants";
import { sendOk } from "../lib/response";
import { requestIdField, timeRangeSchema } from "../lib/schemas";
import { parseOrThrow } from "../middleware/validate";
import { simulationService } from "../services/SimulationService";

export const prepareSimulationBody = z.object({ hubIds: z.array(z.string().min(1)), timeRange: timeRangeSchema });
export const submitScenarioBody = z.object({
  snapshotId: z.string().min(1),
  scenarioType: z.enum(SCENARIO_TYPES),
  assumptions: z.object({ hubId: z.string().min(1).optional(), demandMultiplier: z.number().optional(), additionalChargers: z.number().int().optional(), additionalVehicles: z.number().int().optional() }),
});
export const runSimulationBody = z.object({ requestId: requestIdField, scenarioDraftId: z.string().min(1) });
export const prepareOperationalHandoffBody = z.object({ recommendationId: z.string().min(1) });
export const simulateActionImpactBody = z.object({
  recommendationId: z.string().min(1).optional(),
  actionType: z.enum(["REDISTRIBUTE_VEHICLES", "PRIORITIZE_LOW_BATTERY_CHARGING"]),
  sourceHubId: z.string().min(1).optional(),
  targetHubId: z.string().min(1).optional(),
  vehicleCount: z.number().int().min(0).max(50).optional(),
  hubId: z.string().min(1).optional(),
  priorityTurnaroundVehicles: z.number().int().min(0).max(20).optional(),
});

export const simulationController = {
  /** POST /api/simulations/snapshots */
  async prepareSimulation(req: Request, res: Response): Promise<void> {
    const { hubIds, timeRange } = req.body as z.infer<typeof prepareSimulationBody>;
    sendOk(res, await simulationService.captureStateSnapshot(hubIds, timeRange));
  },

  /** POST /api/simulations/snapshots/:snapshotId/accept-stale */
  async acceptStaleSnapshot(req: Request, res: Response): Promise<void> {
    const { snapshotId } = parseOrThrow(z.object({ snapshotId: z.string().min(1) }), req.params);
    sendOk(res, await simulationService.recordStaleDataAcceptance(snapshotId));
  },

  /** POST /api/simulations/scenarios */
  async submitScenario(req: Request, res: Response): Promise<void> {
    const { snapshotId, scenarioType, assumptions } = req.body as z.infer<typeof submitScenarioBody>;
    sendOk(res, await simulationService.prepareScenario(snapshotId, scenarioType, assumptions));
  },

  /** POST /api/simulations/runs */
  async runSimulation(req: Request, res: Response): Promise<void> {
    const { requestId, scenarioDraftId } = req.body as z.infer<typeof runSimulationBody>;
    sendOk(res, await simulationService.startRun(requestId, scenarioDraftId));
  },

  /** POST /api/simulations/runs/:runId/stop */
  async stopRun(req: Request, res: Response): Promise<void> {
    const { runId } = parseOrThrow(z.object({ runId: z.string().min(1) }), req.params);
    sendOk(res, await simulationService.stopRun(runId));
  },

  /** GET /api/simulations/runs */
  async listRuns(_req: Request, res: Response): Promise<void> {
    sendOk(res, await simulationService.listRuns());
  },

  /** GET /api/simulations/runs/:runId */
  async getRunResult(req: Request, res: Response): Promise<void> {
    const { runId } = parseOrThrow(z.object({ runId: z.string().min(1) }), req.params);
    sendOk(res, await simulationService.getRunResult(runId));
  },

  /** POST /api/simulations/runs/:runId/simulate-action */
  async simulateActionImpact(req: Request, res: Response): Promise<void> {
    const { runId } = parseOrThrow(z.object({ runId: z.string().min(1) }), req.params);
    const body = req.body as z.infer<typeof simulateActionImpactBody>;
    sendOk(res, await simulationService.simulateActionImpact(runId, body));
  },

  /** POST /api/simulations/runs/:runId/retry-save */
  async retrySaveRun(req: Request, res: Response): Promise<void> {
    const { runId } = parseOrThrow(z.object({ runId: z.string().min(1) }), req.params);
    sendOk(res, await simulationService.retrySaveRun(runId));
  },

  /** POST /api/simulations/handoffs (UC14 Ext 9b: Chuyển sang nghiệp vụ điều phối UC12 / UC13) */
  async prepareOperationalHandoff(req: Request, res: Response): Promise<void> {
    const { recommendationId } = req.body as z.infer<typeof prepareOperationalHandoffBody>;
    sendOk(res, simulationService.prepareOperationalHandoff(recommendationId));
  },

  /**
   * Không có route HTTP: SimulationService gọi khi lần chạy kết thúc (Sequence Sub #2).
   * Hệ thống không dùng WebSocket nên client nhận kết quả bằng cách gọi lại getRunResult mỗi 3 giây.
   */
  publishRunFinished(runId: string): void {
    console.log(`[simulation] Lần chạy mô phỏng ${runId} đã hoàn tất.`);
  },
};
