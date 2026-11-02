// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import type { HubStatus } from "@hub/shared";
import type { SimulationRun } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

export interface StateSnapshot {
  snapshotId: string;
  capturedAt: string;
  hubIds: string[];
  timeRange: TimeRange;
  hubs: HubStatus[];
  /** Ghi chú giới hạn dữ liệu (thiếu lịch sử, dữ liệu cũ...). */
  dataLimitation?: string;
}

export type ScenarioType = "DEMAND_SURGE" | "HUB_CLOSURE" | "ADD_CHARGERS" | "ADD_VEHICLES";

export interface Scenario {
  scenarioDraftId: string;
  snapshotId: string;
  scenarioType: ScenarioType;
  assumptions: Record<string, number | string | boolean>;
}

export interface SimulationResult {
  baseline: Record<string, number>;
  scenario: Record<string, number>;
  notes: string[];
}

export const simulationService = {
  /** UC14 bước 1–2: chụp trạng thái hiện tại thành snapshot (chỉ đọc). */
  async captureStateSnapshot(hubIds: string[], timeRange: TimeRange): Promise<StateSnapshot> {
    throw notImplemented("SimulationService.captureStateSnapshot (UC14)");
  },

  /** UC14 bước 3: chuẩn bị kịch bản giả định trên snapshot. */
  async prepareScenario(
    snapshotId: string,
    scenarioType: ScenarioType,
    assumptions: Scenario["assumptions"],
  ): Promise<Scenario> {
    throw notImplemented("SimulationService.prepareScenario (UC14)");
  },

  /**
   * UC14 bước 4–5: tạo SimulationRun RUNNING, chạy simulationEngine ở nền,
   * xong thì cập nhật kết quả và emitToOperators(SIMULATION_FINISHED).
   */
  async startRun(requestId: string, scenarioDraftId: string, operatorId: string): Promise<SimulationRun> {
    throw notImplemented("SimulationService.startRun (UC14)");
  },

  /** UC14 luồng thay thế: dừng lần chạy đang chạy → CANCELLED. */
  async stopRun(runId: string): Promise<SimulationRun> {
    throw notImplemented("SimulationService.stopRun (UC14)");
  },

  /** UC14 bước 6: xem kết quả so sánh. */
  async getRunResult(runId: string): Promise<SimulationRun> {
    throw notImplemented("SimulationService.getRunResult (UC14)");
  },
};
