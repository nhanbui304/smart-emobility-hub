// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Gọi API của SimulationController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type {
  ActionImpactRequest,
  ActionImpactResult,
  RunCancelled,
  RunOutcome,
  RunStarted,
  SaveStatus,
  ScenarioAssumptions,
  ScenarioType,
  SimulationPreview,
  SimulationRunHistoryItem,
  SnapshotInfo,
  SnapshotReady,
  TargetWorkflow,
  TimeRange,
} from "../types";
import { api } from "./client";

export const simulationApi = {
  /** POST /api/simulations/snapshots */
  prepareSimulation: (hubIds: string[], timeRange: TimeRange) =>
    api.post<SnapshotInfo>("/simulations/snapshots", { hubIds, timeRange }),
  /** POST /api/simulations/snapshots/:snapshotId/accept-stale */
  acceptStaleSnapshot: (snapshotId: string) =>
    api.post<SnapshotReady>(`/simulations/snapshots/${snapshotId}/accept-stale`, {}),
  /** POST /api/simulations/scenarios */
  submitScenario: (snapshotId: string, scenarioType: ScenarioType, assumptions: ScenarioAssumptions) =>
    api.post<SimulationPreview>("/simulations/scenarios", { snapshotId, scenarioType, assumptions }),
  /** GET /api/simulations/runs */
  listRuns: () =>
    api.get<SimulationRunHistoryItem[]>("/simulations/runs"),
  /** POST /api/simulations/runs */
  runSimulation: (requestId: string, scenarioDraftId: string) =>
    api.post<RunStarted>("/simulations/runs", { requestId, scenarioDraftId }),
  /** POST /api/simulations/runs/:runId/stop */
  stopRun: (runId: string) =>
    api.post<RunCancelled>(`/simulations/runs/${runId}/stop`, {}),
  /** GET /api/simulations/runs/:runId */
  getRunResult: (runId: string) =>
    api.get<RunOutcome>(`/simulations/runs/${runId}`),
  /** POST /api/simulations/runs/:runId/simulate-action */
  simulateActionImpact: (runId: string, payload: ActionImpactRequest) =>
    api.post<ActionImpactResult>(`/simulations/runs/${runId}/simulate-action`, payload),
  /** POST /api/simulations/runs/:runId/retry-save */
  retrySaveRun: (runId: string) =>
    api.post<SaveStatus>(`/simulations/runs/${runId}/retry-save`, {}),
  /** POST /api/simulations/handoffs */
  prepareOperationalHandoff: (recommendationId: string) =>
    api.post<TargetWorkflow>("/simulations/handoffs", { recommendationId }),
};
