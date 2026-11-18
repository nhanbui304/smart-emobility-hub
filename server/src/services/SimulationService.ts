// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ScenarioType } from "../constants";
import type { TimeRange } from "../lib/schemas";
import type { OperationalState, RawSimulationResult, Recommendation, RunCancelled, RunOutcome, RunStarted, SaveStatus, Scenario, ScenarioAssumptions, SimulationComparison, SimulationPreview, SnapshotDataAssessment, SnapshotInfo, SnapshotReady } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const simulationService = {
  /**
   * UC14 bước 1–2: đọc trạng thái vận hành (chỉ đọc, qua hubService), đánh giá dữ liệu (assessSnapshotData),
   * lưu bản chụp (storeSnapshot). Thiếu dữ liệu bắt buộc → AppError CONFLICT (Ext 2a).
   */
  async captureStateSnapshot(hubIds: string[], timeRange: TimeRange): Promise<SnapshotInfo> {
    throw notImplemented("SimulationService.captureStateSnapshot");
  },

  /** UC14 Ext 2b: Operator chấp nhận dùng dữ liệu cũ; ghi nhận và lưu giới hạn dữ liệu. */
  async recordStaleDataAcceptance(snapshotId: string): Promise<SnapshotReady> {
    throw notImplemented("SimulationService.recordStaleDataAcceptance");
  },

  /**
   * UC14 bước 3–5: kiểm tra tham số (Ext 4a), kiểm tra mô hình hỗ trợ (Ext 4b),
   * dựng bản xem trước baseline / kịch bản / KPI; lưu nháp kịch bản.
   */
  async prepareScenario(
    snapshotId: string,
    scenarioType: ScenarioType,
    assumptions: ScenarioAssumptions,
  ): Promise<SimulationPreview> {
    throw notImplemented("SimulationService.prepareScenario");
  },

  /**
   * UC14 bước 6–7: tạo SimulationRun RUNNING (createRun, chống gửi lặp bằng requestId), gọi
   * simulationEngine.runBaselineAndScenario ở nền (không await), trả về ngay. Kết thúc thì engine
   * gọi runCompleted / runFailed. UI hỏi định kỳ getRunResult (không có WebSocket).
   */
  async startRun(requestId: string, scenarioDraftId: string): Promise<RunStarted> {
    throw notImplemented("SimulationService.startRun");
  },

  /** UC14 Ext 7b: dừng lần chạy đang chạy (simulationEngine.abort) → CANCELLED. */
  async stopRun(runId: string): Promise<RunCancelled> {
    throw notImplemented("SimulationService.stopRun");
  },

  /** UC14 Ext 7a (runFailed): ghi lần chạy FAILED; không trình bày kết quả dở dang. */
  async runFailed(runId: string, reason: string): Promise<void> {
    throw notImplemented("SimulationService.runFailed");
  },

  /**
   * UC14 bước 8–9 (runCompleted): so sánh với baseline, sinh khuyến nghị, tự lưu kết quả (storeRunResult).
   * Lưu thất bại → giữ kết quả tạm trong bộ nhớ để retrySaveRun lưu lại (Ext 9a).
   */
  async runCompleted(runId: string, rawResults: RawSimulationResult): Promise<void> {
    throw notImplemented("SimulationService.runCompleted");
  },

  /** UC14 bước 8: kết quả so sánh, khuyến nghị, ràng buộc và trạng thái lưu. */
  async getRunResult(runId: string): Promise<RunOutcome> {
    throw notImplemented("SimulationService.getRunResult");
  },

  /** UC14 Ext 9a: lưu lại kết quả đang giữ tạm. */
  async retrySaveRun(runId: string): Promise<SaveStatus> {
    throw notImplemented("SimulationService.retrySaveRun");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function assessSnapshotData(operationalState: OperationalState): SnapshotDataAssessment {
  throw notImplemented("SimulationService.assessSnapshotData");
}

/** private (–) trong class diagram. */
function validateScenarioParameters(scenarioType: ScenarioType, assumptions: ScenarioAssumptions): string[] {
  throw notImplemented("SimulationService.validateScenarioParameters");
}

/** private (–) trong class diagram. */
function checkModelSupport(scenarioType: ScenarioType, assumptions: ScenarioAssumptions): boolean {
  throw notImplemented("SimulationService.checkModelSupport");
}

/** private (–) trong class diagram. */
function buildBaselineAndScenarioPreview(snapshotId: string, scenario: Scenario): SimulationPreview {
  throw notImplemented("SimulationService.buildBaselineAndScenarioPreview");
}

/** private (–) trong class diagram. */
function compareWithBaseline(rawResults: RawSimulationResult): SimulationComparison {
  throw notImplemented("SimulationService.compareWithBaseline");
}

/** private (–) trong class diagram. */
function generateRecommendations(comparison: SimulationComparison): Recommendation[] {
  throw notImplemented("SimulationService.generateRecommendations");
}
