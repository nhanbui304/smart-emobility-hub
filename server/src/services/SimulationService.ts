// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method theo Sequence Submission #2 (Hình 2.61–2.62).
import type { HubStatus } from "../types/dto";
import type { SimulationRun } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

/** Bản chụp dữ liệu vận hành (UC14 bước 2: snapshotInfo). Lưu bằng simulationRunRepository.storeSnapshot. */
export interface StateSnapshot {
  snapshotId: string;
  capturedAt: Date;
  hubIds: string[];
  timeRange: TimeRange;
  hubs: HubStatus[];
  /** Nguồn dữ liệu đã đọc. */
  sources: string[];
  /** Mức độ đầy đủ, 0–1. */
  completeness: number;
  /** Dữ liệu đã cũ (Ext 2b): chỉ chạy được khi Operator chấp nhận. */
  isStale: boolean;
  staleAccepted: boolean;
  /** Ghi chú giới hạn dữ liệu (thiếu lịch sử, dữ liệu cũ...), đưa vào kết quả. */
  dataLimitation?: string;
}

export type ScenarioType = "DEMAND_SURGE" | "HUB_CLOSURE" | "ADD_CHARGERS" | "ADD_VEHICLES";

export interface Scenario {
  scenarioDraftId: string;
  snapshotId: string;
  scenarioType: ScenarioType;
  assumptions: Record<string, number | string | boolean>;
}

/** Bản xem trước trước khi chạy (UC14 bước 5: preview(scenarioDraftId, baseline, scenario, kpis)). */
export interface ScenarioPreview extends Scenario {
  baselineKpis: Record<string, number>;
  scenarioKpis: Record<string, number>;
}

export interface SimulationRecommendation {
  recommendationId: string;
  description: string;
  /** Căn cứ: chỉ số nào cải thiện bao nhiêu. */
  rationale: string;
  /** Nghiệp vụ điều phối có thể mở để áp dụng (Ext 9b). */
  targetUseCase: "UC12" | "UC13";
  feasible: boolean;
}

/** Kết quả mô phỏng (UC14 bước 8). */
export interface SimulationResult {
  baseline: Record<string, number>;
  scenario: Record<string, number>;
  /** Chênh lệch scenario so với baseline theo từng KPI. */
  comparison: Record<string, number>;
  recommendations: SimulationRecommendation[];
  /** Ràng buộc / giới hạn áp dụng (Ext 8b: không có khuyến nghị khả thi thì nêu ràng buộc). */
  constraints: string[];
  notes: string[];
}

export type SaveStatus = "SAVED" | "SAVE_FAILED" | "NOT_FINISHED";

/** Thông tin lần chạy trả về cho UI (UC14 bước 8: simulationResult(comparison, recommendations, constraints, saveStatus)). */
export interface SimulationRunView {
  run: SimulationRun;
  result?: SimulationResult;
  saveStatus: SaveStatus;
  failureReason?: string;
}

/** Ngữ cảnh mở nghiệp vụ điều phối từ khuyến nghị (Ext 9b). */
export interface OperationalHandoff {
  targetUseCase: "UC12" | "UC13";
  /** Đường dẫn màn hình phía client cần mở. */
  targetPath: string;
  context: Record<string, unknown>;
}

export const simulationService = {
  /**
   * UC14 bước 1–2: đọc trạng thái vận hành (chỉ đọc, qua hubService), đánh giá dữ liệu (assessSnapshotData),
   * lưu bản chụp (storeSnapshot). Thiếu dữ liệu bắt buộc → AppError CONFLICT (Ext 2a).
   */
  async captureStateSnapshot(operatorId: string, hubIds: string[], timeRange: TimeRange): Promise<StateSnapshot> {
    throw notImplemented("SimulationService.captureStateSnapshot (UC14)");
  },

  /** UC14 Ext 2b: Operator chấp nhận dùng dữ liệu cũ; ghi nhận và lưu giới hạn dữ liệu. */
  async recordStaleDataAcceptance(snapshotId: string, operatorId: string): Promise<StateSnapshot> {
    throw notImplemented("SimulationService.recordStaleDataAcceptance (UC14)");
  },

  /**
   * UC14 bước 3–5: kiểm tra tham số (Ext 4a), kiểm tra mô hình hỗ trợ (Ext 4b),
   * dựng bản xem trước baseline / kịch bản / KPI; lưu nháp kịch bản.
   */
  async prepareScenario(
    snapshotId: string,
    scenarioType: ScenarioType,
    assumptions: Scenario["assumptions"],
  ): Promise<ScenarioPreview> {
    throw notImplemented("SimulationService.prepareScenario (UC14)");
  },

  /**
   * UC14 bước 6–7: tạo SimulationRun RUNNING (createRun, chống gửi lặp bằng requestId), gọi
   * simulationEngine.runBaselineAndScenario ở nền (không await), trả về ngay. Kết thúc thì engine
   * gọi runCompleted / runFailed. UI hỏi định kỳ getRunResult (không có WebSocket).
   */
  async startRun(requestId: string, scenarioDraftId: string, operatorId: string): Promise<SimulationRun> {
    throw notImplemented("SimulationService.startRun (UC14)");
  },

  /**
   * UC14 bước 8–9 (runCompleted): so sánh với baseline, sinh khuyến nghị, tự lưu kết quả (storeRunResult).
   * Lưu thất bại → giữ kết quả tạm (holdUnsavedResult) để retrySaveRun (Ext 9a).
   */
  async runCompleted(runId: string, rawResults: SimulationResult): Promise<void> {
    throw notImplemented("SimulationService.runCompleted (UC14)");
  },

  /** UC14 Ext 7a (runFailed): ghi lần chạy FAILED; không trình bày kết quả dở dang. */
  async runFailed(runId: string, reason: string): Promise<void> {
    throw notImplemented("SimulationService.runFailed (UC14)");
  },

  /** UC14 Ext 7b: dừng lần chạy đang chạy (simulationEngine.abort) → CANCELLED. */
  async stopRun(runId: string): Promise<SimulationRun> {
    throw notImplemented("SimulationService.stopRun (UC14)");
  },

  /** UC14 bước 8: kết quả so sánh, khuyến nghị, ràng buộc và trạng thái lưu. */
  async getRunResult(runId: string): Promise<SimulationRunView> {
    throw notImplemented("SimulationService.getRunResult (UC14)");
  },

  /** UC14 Ext 9a: lưu lại kết quả đang giữ tạm. */
  async retrySaveRun(runId: string): Promise<SimulationRunView> {
    throw notImplemented("SimulationService.retrySaveRun (UC14)");
  },

  /** UC14 Ext 9b: chuẩn bị ngữ cảnh mở UC12 / UC13 từ một khuyến nghị khả thi. Không ghi dữ liệu vận hành. */
  async prepareOperationalHandoff(runId: string, recommendationId: string): Promise<OperationalHandoff> {
    throw notImplemented("SimulationService.prepareOperationalHandoff (UC14)");
  },
};
