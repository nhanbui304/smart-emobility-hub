// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { CreateRunResult, OperationalState, Recommendation, RunCancelled, SaveResult, Scenario, ScenarioAssumptions, SimulationComparison, SnapshotInfo } from "../types/dto";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const simulationRunRepository = {
  /** UC14 bước 2 (storeSnapshot). */
  storeSnapshot(operationalState: OperationalState, capturedAt: Date, sources: string[]): SnapshotInfo {
    throw notImplemented("SimulationRunRepository.storeSnapshot");
  },

  /** UC14 Ext 2b (markStaleAccepted): staleAccepted = true, lưu dataLimitation. */
  markStaleAccepted(snapshotId: string, dataLimitation: string): void {
    throw notImplemented("SimulationRunRepository.markStaleAccepted");
  },

  /**
   * UC14 bước 6 (createRun) – trong db.transaction: requestId đã xử lý → trả lần chạy cũ;
   * tạo SimulationRun RUNNING; ghi processed_requests.
   */
  createRun(requestId: string, snapshotId: string, scenario: Scenario): CreateRunResult {
    throw notImplemented("SimulationRunRepository.createRun");
  },

  /** UC14 Ext 7b: RUNNING → CANCELLED. */
  markRunCancelled(runId: string): RunCancelled {
    throw notImplemented("SimulationRunRepository.markRunCancelled");
  },

  /** UC14 Ext 7a: RUNNING → FAILED, lưu lý do. */
  markRunFailed(runId: string, reason: string): void {
    throw notImplemented("SimulationRunRepository.markRunFailed");
  },

  /** UC14 bước 9: RUNNING → COMPLETED, lưu kết quả cùng giả định và giới hạn dữ liệu. */
  storeRunResult(
    runId: string,
    assumptions: ScenarioAssumptions,
    dataLimitation: string,
    comparison: SimulationComparison,
    recommendations: Recommendation[],
  ): SaveResult {
    throw notImplemented("SimulationRunRepository.storeRunResult");
  },
};
