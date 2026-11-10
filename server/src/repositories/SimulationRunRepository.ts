// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// CHỈ ghi vào bảng simulation_snapshots, simulation_runs (và processed_requests). KHÔNG bao giờ ghi vào bảng vận hành.
import type { SimulationRun, SimulationSnapshot } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import type { HubStatus } from "../types/dto";
import type { Scenario, SimulationResult } from "../services/SimulationService";

/** Nháp kịch bản lưu tạm trong bộ nhớ theo scenarioDraftId (mất khi khởi động lại server thì cấu hình lại). */
const scenarioDraftStore = new Map<string, Scenario>();
/** Kết quả đã chạy xong nhưng lưu thất bại, chờ retrySaveRun (Ext 9a). */
const unsavedResultStore = new Map<string, SimulationResult>();

export const simulationRunRepository = {
  /** UC14 bước 2 (storeSnapshot). */
  storeSnapshot(input: {
    operatorId: string;
    hubIds: string[];
    timeRange: TimeRange;
    capturedAt: Date;
    hubs: HubStatus[];
    sources: string[];
    completeness: number;
    isStale: boolean;
    dataLimitation?: string;
  }): SimulationSnapshot {
    throw notImplemented("SimulationRunRepository.storeSnapshot (UC14)");
  },

  findSnapshot(snapshotId: string): SimulationSnapshot | undefined {
    throw notImplemented("SimulationRunRepository.findSnapshot (UC14)");
  },

  /** UC14 Ext 2b (markStaleAccepted): staleAccepted = true, lưu dataLimitation. */
  markStaleAccepted(snapshotId: string, dataLimitation: string): SimulationSnapshot {
    throw notImplemented("SimulationRunRepository.markStaleAccepted (UC14)");
  },

  saveScenarioDraft(scenario: Scenario): void {
    throw notImplemented("SimulationRunRepository.saveScenarioDraft (UC14)");
  },

  findScenarioDraft(scenarioDraftId: string): Scenario | undefined {
    throw notImplemented("SimulationRunRepository.findScenarioDraft (UC14)");
  },

  /**
   * UC14 bước 6 (createRun) – trong db.transaction: requestId đã xử lý → trả lần chạy cũ;
   * tạo SimulationRun RUNNING; ghi processed_requests.
   */
  createRun(input: {
    requestId: string;
    operatorId: string;
    snapshotId: string;
    scenario: Scenario;
    dataLimitation?: string;
  }): SimulationRun {
    throw notImplemented("SimulationRunRepository.createRun (UC14)");
  },

  findById(runId: string): SimulationRun | undefined {
    throw notImplemented("SimulationRunRepository.findById (UC14)");
  },

  /** UC14 Ext 7b: RUNNING → CANCELLED. */
  markRunCancelled(runId: string): SimulationRun {
    throw notImplemented("SimulationRunRepository.markRunCancelled (UC14)");
  },

  /** UC14 Ext 7a: RUNNING → FAILED, lưu lý do. */
  markRunFailed(runId: string, reason: string): SimulationRun {
    throw notImplemented("SimulationRunRepository.markRunFailed (UC14)");
  },

  /** UC14 bước 9: RUNNING → COMPLETED, lưu kết quả cùng giả định và giới hạn dữ liệu. */
  storeRunResult(runId: string, result: SimulationResult, dataLimitation?: string): SimulationRun {
    throw notImplemented("SimulationRunRepository.storeRunResult (UC14)");
  },

  /** UC14 Ext 9a: giữ kết quả chưa lưu được để thử lại. */
  holdUnsavedResult(runId: string, result: SimulationResult): void {
    throw notImplemented("SimulationRunRepository.holdUnsavedResult (UC14)");
  },

  findUnsavedResult(runId: string): SimulationResult | undefined {
    throw notImplemented("SimulationRunRepository.findUnsavedResult (UC14)");
  },
};
