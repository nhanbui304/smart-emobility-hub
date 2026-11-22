// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC14.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import { SCENARIO_TYPES, type ScenarioType } from "../constants";
import { AppError } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import { operationalRepository } from "../repositories/OperationalRepository";
import {
  findRunById,
  findSnapshotById,
  getFailedRunReason,
  getRecommendationById,
  getScenarioDraft,
  getUnsavedRunResult,
  listSimulationRuns,
  saveScenarioDraft,
  setUnsavedRunResult,
  simulationRunRepository,
} from "../repositories/SimulationRunRepository";
import {
  buildHubBreakdowns,
  computeActionImpactOnScenario,
  computeBaselineMetrics,
  simulationEngine,
} from "../simulator/SimulationEngine";
import type {
  ActionImpactRequest,
  ActionImpactResult,
  OperationalState,
  RawSimulationResult,
  Recommendation,
  RunCancelled,
  RunOutcome,
  RunStarted,
  SaveStatus,
  Scenario,
  ScenarioAssumptions,
  SimulationComparison,
  SimulationPreview,
  SimulationRunHistoryItem,
  SnapshotDataAssessment,
  SnapshotInfo,
  SnapshotReady,
  TargetWorkflow,
} from "../types/dto";

export const simulationService = {
  prepareOperationalHandoff(recommendationId: string): TargetWorkflow {
    const recommendation = getRecommendationById(recommendationId);
    if (!recommendation) {
      throw new AppError("NOT_FOUND", "Không tìm thấy khuyến nghị điều phối.");
    }
    return { targetUseCase: recommendation.targetUseCase, recommendationContext: recommendation };
  },

  /**
   * UC14 bước 1–2: Đọc trạng thái vận hành (chỉ đọc, qua operationalRepository.readOperationalState),
   * đánh giá dữ liệu (assessSnapshotData), lưu bản chụp (storeSnapshot).
   * Thiếu dữ liệu bắt buộc → AppError CONFLICT (Ext 2a).
   */
  async captureStateSnapshot(hubIds: string[], timeRange: TimeRange): Promise<SnapshotInfo> {
    if (!Array.isArray(hubIds) || hubIds.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Vui lòng chọn ít nhất một Mobility Hub trong phạm vi đánh giá.",
      );
    }

    const operationalState = operationalRepository.readOperationalState(hubIds, timeRange);
    const assessment = assessSnapshotData(operationalState);

    if (assessment.missingFields.length > 0 || assessment.completeness < 1) {
      throw new AppError(
        "CONFLICT",
        `Không đủ dữ liệu bắt buộc để tạo bản chụp mô phỏng: ${assessment.missingFields.join(", ")}.`,
        { missingFields: assessment.missingFields },
      );
    }

    const sources = ["hubs", "shared_vehicles", "parking_slots", "charging_ports"];
    return simulationRunRepository.storeSnapshot(operationalState, new Date(), sources);
  },

  /** UC14 Ext 2b: Operator chấp nhận dùng dữ liệu đã cũ; ghi nhận và lưu giới hạn dữ liệu vào kết quả. */
  async recordStaleDataAcceptance(snapshotId: string): Promise<SnapshotReady> {
    const snapshot = findSnapshotById(snapshotId);
    if (!snapshot) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản chụp dữ liệu (Snapshot).");
    }

    simulationRunRepository.markStaleAccepted(
      snapshotId,
      `Đã chấp nhận sử dụng bản chụp có dữ liệu cũ hơn ${systemConfig.dataStaleSeconds} giây.`,
    );

    return { snapshotId };
  },

  /**
   * UC14 bước 3–5: Kiểm tra tham số (Ext 4a), kiểm tra khả năng hỗ trợ của mô hình (Ext 4b),
   * dựng bản xem trước baseline / kịch bản / các chỉ số KPI; lưu nháp kịch bản.
   */
  async prepareScenario(
    snapshotId: string,
    scenarioType: ScenarioType,
    assumptions: ScenarioAssumptions,
  ): Promise<SimulationPreview> {
    const snapshot = findSnapshotById(snapshotId);
    if (!snapshot) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản chụp dữ liệu (Snapshot).");
    }

    // UC14 Ext 2b: Nếu dữ liệu đã cũ mà Operator chưa xác nhận chấp nhận thì không cho tiếp tục
    if (snapshot.isStale && !snapshot.staleAccepted) {
      throw new AppError(
        "CONFLICT",
        "Bản chụp chứa dữ liệu đã cũ. Vui lòng xác nhận chấp nhận giới hạn của dữ liệu hoặc tạo bản chụp mới trước khi cấu hình kịch bản.",
      );
    }

    // UC14 Ext 4a: Kiểm tra tham số thiếu hoặc không hợp lệ
    const invalidFields = validateScenarioParameters(scenarioType, assumptions);
    if (invalidFields.length > 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Tham số kịch bản thiếu hoặc không hợp lệ: ${invalidFields.join(", ")}.`,
        { fields: invalidFields },
      );
    }

    // UC14 Ext 4b: Kiểm tra kịch bản có nằm trong khả năng hỗ trợ của mô hình không
    if (!checkModelSupport(scenarioType, assumptions)) {
      throw new AppError(
        "CONFLICT",
        "Kịch bản nằm ngoài giới hạn hỗ trợ của mô hình mô phỏng hiện tại (Hệ số nhu cầu tối đa x5.0, thêm cổng sạc tối đa +20 cổng, thêm xe tối đa +50 xe).",
      );
    }

    if (assumptions.hubId && !snapshot.hubIds.includes(assumptions.hubId)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Hub được chọn trong giả định kịch bản không nằm trong phạm vi các Hub của bản chụp dữ liệu.",
      );
    }

    const scenario: Scenario = {
      scenarioDraftId: crypto.randomUUID(),
      snapshotId,
      scenarioType,
      assumptions,
    };
    saveScenarioDraft(scenario);

    return buildBaselineAndScenarioPreview(snapshotId, scenario);
  },

  /**
   * UC14 bước 6–7: Tạo SimulationRun RUNNING (createRun, chống gửi lặp bằng requestId),
   * gọi simulationEngine.runBaselineAndScenario chạy nền (không await), trả về ngay.
   */
  async startRun(requestId: string, scenarioDraftId: string): Promise<RunStarted> {
    const scenario = getScenarioDraft(scenarioDraftId);
    if (!scenario) {
      throw new AppError(
        "NOT_FOUND",
        "Không tìm thấy cấu hình kịch bản nháp. Vui lòng cấu hình lại kịch bản.",
      );
    }

    const { runId, created } = simulationRunRepository.createRun(
      requestId,
      scenario.snapshotId,
      scenario,
    );

    if (created) {
      simulationEngine.runBaselineAndScenario(runId, scenario.snapshotId, scenario);
    }

    return { runId };
  },

  /** UC14 Ext 7b: Dừng lần chạy đang thực thi (simulationEngine.abort) → CANCELLED. */
  async stopRun(runId: string): Promise<RunCancelled> {
    simulationEngine.abort(runId);
    return simulationRunRepository.markRunCancelled(runId);
  },

  /** UC14 Ext 7a (runFailed): Ghi nhận lần chạy FAILED; không trình bày kết quả dở dang như hoàn chỉnh. */
  async runFailed(runId: string, reason: string): Promise<void> {
    simulationRunRepository.markRunFailed(runId, reason);
  },

  /**
   * UC14 bước 8–9 (runCompleted): So sánh với phương án cơ sở (compareWithBaseline),
   * sinh khuyến nghị điều phối (generateRecommendations), tự lưu kết quả (storeRunResult).
   * Lưu thất bại → giữ kết quả tạm trong bộ nhớ để retrySaveRun lưu lại (Ext 9a).
   */
  async runCompleted(runId: string, rawResults: RawSimulationResult): Promise<void> {
    const run = findRunById(runId);
    if (!run || run.status === "CANCELLED") return;

    const snapshot = findSnapshotById(run.snapshotId);
    const dataLimitation = snapshot?.dataLimitation ?? "";
    const comparison = compareWithBaseline(rawResults);
    const recommendations = generateRecommendations(comparison, snapshot?.operationalState, run.scenario);

    try {
      const { saveStatus } = simulationRunRepository.storeRunResult(
        runId,
        run.scenario.assumptions,
        dataLimitation,
        comparison,
        recommendations,
      );
      if (!saveStatus.saved) {
        setUnsavedRunResult(runId, {
          assumptions: run.scenario.assumptions,
          dataLimitation,
          comparison,
          recommendations,
        });
      }
    } catch {
      // UC14 Ext 9a: Lưu kết quả thất bại -> giữ tạm trong bộ nhớ để cho phép thử lưu lại
      setUnsavedRunResult(runId, {
        assumptions: run.scenario.assumptions,
        dataLimitation,
        comparison,
        recommendations,
      });
    }
  },

  /** UC14 bước 8: Lấy trạng thái và kết quả so sánh, khuyến nghị, ràng buộc và trạng thái lưu. */
  async getRunResult(runId: string): Promise<RunOutcome> {
    const run = findRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lần chạy mô phỏng.");
    }

    const snapshot = findSnapshotById(run.snapshotId);
    const hubBreakdowns = snapshot
      ? buildHubBreakdowns(snapshot.operationalState, run.scenario)
      : undefined;
    const meta = {
      runId: run.id,
      snapshotId: run.snapshotId,
      scenario: run.scenario,
      hubIds: snapshot?.hubIds ?? [],
      hubNames: snapshot?.operationalState?.hubs?.map((h) => h.name) ?? [],
      timeRange: snapshot?.timeRange,
      createdAt: run.createdAt,
      hubBreakdowns,
    };

    if (run.status === "FAILED") {
      return {
        ...meta,
        status: "FAILED",
        failureReason: getFailedRunReason(runId) ?? "Mô phỏng gặp lỗi hoặc vượt giới hạn xử lý.",
      };
    }

    if (run.status === "CANCELLED") {
      return { ...meta, status: "CANCELLED" };
    }

    const unsaved = getUnsavedRunResult(runId);
    if (unsaved) {
      return {
        ...meta,
        status: "COMPLETED",
        result: {
          comparison: unsaved.comparison,
          recommendations: unsaved.recommendations,
          constraints: unsaved.dataLimitation ? [unsaved.dataLimitation] : [],
          saveStatus: {
            saved: false,
            reason: "Chưa lưu được kết quả vào cơ sở dữ liệu. Vui lòng bấm Thử lưu lại.",
          },
        },
      };
    }

    return {
      ...meta,
      status: run.status,
      result: run.result ?? undefined,
    };
  },

  /** Liệt kê lịch sử các lượt mô phỏng đã lưu (mới nhất lên đầu). */
  async listRuns(): Promise<SimulationRunHistoryItem[]> {
    return listSimulationRuns();
  },

  /** Mô phỏng dự đoán tác động của một hành động đề xuất (UC12 / UC13) trên cùng bản chụp & kịch bản, KHÔNG sửa dữ liệu vận hành thật. */
  async simulateActionImpact(runId: string, req: ActionImpactRequest): Promise<ActionImpactResult> {
    const run = findRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lần chạy mô phỏng để dự đoán tác động.");
    }
    const snapshot = findSnapshotById(run.snapshotId);
    if (!snapshot) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản chụp dữ liệu của lần chạy mô phỏng này.");
    }
    return computeActionImpactOnScenario(run.id, snapshot.id, snapshot.operationalState, run.scenario, req);
  },

  /** UC14 Ext 9a: Thử lưu lại kết quả đang giữ tạm trong bộ nhớ. */
  async retrySaveRun(runId: string): Promise<SaveStatus> {
    const unsaved = getUnsavedRunResult(runId);
    if (unsaved) {
      const { saveStatus } = simulationRunRepository.storeRunResult(
        runId,
        unsaved.assumptions,
        unsaved.dataLimitation,
        unsaved.comparison,
        unsaved.recommendations,
      );
      return saveStatus;
    }

    const run = findRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lần chạy mô phỏng.");
    }
    if (run.status === "COMPLETED" && run.result) {
      return run.result.saveStatus;
    }
    if (run.status === "RUNNING") {
      return { saved: false, reason: "Lần chạy mô phỏng đang thực thi, chưa có kết quả để lưu." };
    }
    if (run.status === "FAILED") {
      return { saved: false, reason: "Lần chạy mô phỏng đã thất bại, không có kết quả hợp lệ để lưu." };
    }
    if (run.status === "CANCELLED") {
      return { saved: false, reason: "Lần chạy mô phỏng đã bị hủy, không có kết quả để lưu." };
    }
    return { saved: false, reason: "Không tìm thấy kết quả mô phỏng cần lưu." };
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram UC14.drawio) ----------

/**
 * UC14 bước 2 (private "–" trong class diagram):
 * Đánh giá mức độ đầy đủ và tính mới của dữ liệu trong bản chụp OperationalState.
 */
function assessSnapshotData(operationalState: OperationalState): SnapshotDataAssessment {
  const missingFields: string[] = [];

  if (!operationalState.hubIds || operationalState.hubIds.length === 0) {
    missingFields.push("hubIds");
  }
  if (!operationalState.hubs || operationalState.hubs.length === 0) {
    missingFields.push("hubs");
  } else if (operationalState.hubs.length < operationalState.hubIds.length) {
    missingFields.push("Một số Hub được chọn không tồn tại trong hệ thống");
  }

  const requested = operationalState.hubIds?.length || 1;
  const actual = operationalState.hubs?.length || 0;
  const completeness = missingFields.length === 0 ? Math.min(1, actual / requested) : 0;

  const now = Date.now();
  const isStale = (operationalState.hubs ?? []).some((h) => {
    const ageSec = Math.floor((now - new Date(h.lastUpdatedAt).getTime()) / 1000);
    return ageSec > systemConfig.dataStaleSeconds;
  });

  return {
    missingFields,
    completeness,
    isStale,
  };
}

/**
 * UC14 bước 4 / Ext 4a (private "–" trong class diagram):
 * Kiểm tra tính đầy đủ và hợp lệ của tham số kịch bản giả định. Trả về danh sách trường lỗi.
 */
function validateScenarioParameters(
  scenarioType: ScenarioType,
  assumptions: ScenarioAssumptions,
): string[] {
  const errors: string[] = [];

  if (!(SCENARIO_TYPES as readonly string[]).includes(scenarioType)) {
    errors.push("scenarioType không hợp lệ");
    return errors;
  }

  if (scenarioType === "DEMAND_SURGE") {
    if (
      assumptions.demandMultiplier === undefined ||
      Number.isNaN(assumptions.demandMultiplier) ||
      assumptions.demandMultiplier <= 1.0
    ) {
      errors.push("demandMultiplier (hệ số tăng nhu cầu phải > 1.0)");
    }
  } else if (scenarioType === "HUB_CLOSURE") {
    if (!assumptions.hubId || assumptions.hubId.trim().length === 0) {
      errors.push("hubId (cần chọn Hub giả định đóng cửa)");
    }
  } else if (scenarioType === "ADD_CHARGERS") {
    if (
      assumptions.additionalChargers === undefined ||
      !Number.isInteger(assumptions.additionalChargers) ||
      assumptions.additionalChargers <= 0
    ) {
      errors.push("additionalChargers (số cổng sạc thêm phải là số nguyên > 0)");
    }
  } else if (scenarioType === "ADD_VEHICLES") {
    if (
      assumptions.additionalVehicles === undefined ||
      !Number.isInteger(assumptions.additionalVehicles) ||
      assumptions.additionalVehicles <= 0
    ) {
      errors.push("additionalVehicles (số xe thêm phải là số nguyên > 0)");
    }
  }

  return errors;
}

/**
 * UC14 bước 4 / Ext 4b (private "–" trong class diagram):
 * Kiểm tra kịch bản có nằm trong giới hạn hỗ trợ của mô hình mô phỏng hay không.
 */
function checkModelSupport(
  scenarioType: ScenarioType,
  assumptions: ScenarioAssumptions,
): boolean {
  if (scenarioType === "DEMAND_SURGE") {
    return (assumptions.demandMultiplier ?? 0) <= 5.0;
  }
  if (scenarioType === "ADD_CHARGERS") {
    return (assumptions.additionalChargers ?? 0) <= 20;
  }
  if (scenarioType === "ADD_VEHICLES") {
    return (assumptions.additionalVehicles ?? 0) <= 50;
  }
  return true;
}

/**
 * UC14 bước 5 (private "–" trong class diagram):
 * Dựng thông tin xem trước gồm Phương án cơ sở (Baseline), Kịch bản giả định và danh sách chỉ số KPI cần so sánh.
 */
function buildBaselineAndScenarioPreview(
  snapshotId: string,
  scenario: Scenario,
): SimulationPreview {
  const snapshot = findSnapshotById(snapshotId);
  if (!snapshot) {
    throw new AppError("NOT_FOUND", "Không tìm thấy bản chụp dữ liệu.");
  }

  const baseline = computeBaselineMetrics(snapshot.operationalState);
  return {
    scenarioDraftId: scenario.scenarioDraftId,
    baseline,
    scenario,
    kpis: [
      "Số phương tiện thiếu hụt không đáp ứng kịp nhu cầu (unavailableVehicles)",
      "Thời gian chờ phục vụ / sạc trung bình dự kiến (waitingTimeMinutes)",
      "Số lượng Mobility Hub bị quá tải hoặc thiếu tài nguyên (overloadedHubCount)",
    ],
  };
}

/**
 * UC14 bước 8 (private "–" trong class diagram):
 * Đối chiếu kết quả mô phỏng của Kịch bản giả định với Phương án cơ sở trên cùng điều kiện đầu vào.
 */
function compareWithBaseline(rawResults: RawSimulationResult): SimulationComparison {
  return {
    baseline: rawResults.baseline,
    scenario: rawResults.scenario,
  };
}

/**
 * UC14 bước 8 (private "–" trong class diagram):
 * Sinh danh sách khuyến nghị điều phối dựa trên sự chênh lệch giữa kịch bản và phương án cơ sở,
 * kèm căn cứ và giới hạn áp dụng (UC14 bước 8 & Ext 8a, 8b).
 */
function generateRecommendations(
  comparison: SimulationComparison,
  state?: OperationalState,
  scenarioInfo?: Scenario,
): Recommendation[] {
  const { baseline, scenario } = comparison;
  const recommendations: Recommendation[] = [];

  const vehicleDelta = scenario.unavailableVehicles - baseline.unavailableVehicles;
  const waitDelta = Math.round((scenario.waitingTimeMinutes - baseline.waitingTimeMinutes) * 10) / 10;

  const breakdowns =
    state && scenarioInfo ? buildHubBreakdowns(state, scenarioInfo) : [];
  const openHubs = breakdowns.filter((b) => !b.closed);
  const topSource = [...openHubs].sort((a, b) => b.scenarioSurplus - a.scenarioSurplus)[0];
  const topTarget = [...openHubs].sort((a, b) => b.scenarioDeficit - a.scenarioDeficit)[0];
  const nearFullHub = openHubs.find((b) => (b.scenarioFreeSlots ?? 10) <= 2 && b.scenarioSurplus > 0);
  const scenarioType = scenarioInfo?.scenarioType;

  // 1. Điều chuyển phương tiện: Chỉ đề xuất khi không phải kịch bản ADD_CHARGERS và thực sự có Hub thiếu xe hoặc đầy bãi đỗ
  if (scenarioType !== "ADD_CHARGERS" && (scenario.unavailableVehicles > 0 || nearFullHub)) {
    let reason = "";
    const closedHub = breakdowns.find((b) => b.closed);
    const replacementHub = [...openHubs]
      .filter((b) => b.scenarioDeficit === 0 && (b.scenarioFreeSlots ?? 10) > 2)
      .sort((a, b) => b.scenarioAvailable - a.scenarioAvailable)[0];

    if (scenarioType === "HUB_CLOSURE" && closedHub && replacementHub) {
      const otherSource = [...openHubs]
        .filter((b) => b.hubId !== replacementHub.hubId)
        .sort((a, b) => b.scenarioAvailable - a.scenarioAvailable)[0];
      reason = `Điều chuyển xe từ ${otherSource?.hubName ?? "Hub lân cận"} tiếp ứng cho ${replacementHub.hubName} để đón ${closedHub.scenarioDemand} khách từ ${closedHub.hubName}`;
    } else if (nearFullHub && topTarget && topTarget.scenarioDeficit > 0) {
      const moveCount = Math.min(nearFullHub.scenarioSurplus, topTarget.scenarioDeficit);
      reason = `Giải tỏa bãi đỗ: Chuyển ${moveCount} xe từ ${nearFullHub.hubName} (còn ${nearFullHub.scenarioFreeSlots} chỗ trống) → ${topTarget.hubName} (thiếu ${topTarget.scenarioDeficit} xe)`;
    } else if (nearFullHub) {
      const dest = openHubs.find((b) => b.hubId !== nearFullHub.hubId && (b.scenarioFreeSlots ?? 0) > 4);
      reason = `Giải tỏa tập trung xe tại ${nearFullHub.hubName} (còn ${nearFullHub.scenarioFreeSlots} chỗ trống) sang ${dest?.hubName ?? "Hub lân cận"}`;
    } else if (topSource && topTarget && topSource.hubId !== topTarget.hubId && topTarget.scenarioDeficit > 0) {
      const focusTarget =
        (scenarioInfo?.assumptions.hubId
          ? openHubs.find((b) => b.hubId === scenarioInfo.assumptions.hubId && b.scenarioDeficit > 0)
          : undefined) ?? topTarget;
      const canMove = Math.max(1, Math.min(topSource.scenarioSurplus || 2, focusTarget.scenarioDeficit));
      reason = `Chuyển ${canMove} xe từ ${topSource.hubName} (dư ${topSource.scenarioSurplus} xe) sang ${focusTarget.hubName} (thiếu ${focusTarget.scenarioDeficit} xe)`;
    } else {
      reason =
        vehicleDelta > 0
          ? `Thiếu ${scenario.unavailableVehicles} xe (+${vehicleDelta} xe) · Điều chuyển xe từ Hub dư sang Hub thiếu`
          : `Còn thiếu ${scenario.unavailableVehicles} xe · Điều chuyển cân bằng xe giữa các Hub`;
    }

    recommendations.push({
      recommendationId: crypto.randomUUID(),
      targetUseCase: "UC12",
      reason,
      constraints: [
        "Kiểm tra sức chứa Hub đích trước khi tạo lệnh.",
        "Không chuyển xe đang giữ chỗ, đang sạc hoặc gặp sự cố.",
      ],
    });
  }

  // 2. Thay đổi lịch sạc:
  // - Không đề xuất khi đang chạy kịch bản ADD_VEHICLES (trừ khi thời gian chờ tăng cao hơn cơ sở)
  // - Đề xuất khi chạy ADD_CHARGERS, hoặc khi DEMAND_SURGE / HUB_CLOSURE làm tăng thời gian chờ sạc
  const shouldRecommendCharging =
    scenarioType === "ADD_CHARGERS" ||
    (scenarioType !== "ADD_VEHICLES" && (waitDelta > 0 || scenario.waitingTimeMinutes >= 6.0));

  if (shouldRecommendCharging) {
    const closedHub = breakdowns.find((b) => b.closed);
    const replacementHub = [...openHubs]
      .filter((b) => b.scenarioDeficit === 0 && (b.scenarioFreeSlots ?? 10) > 2)
      .sort((a, b) => b.scenarioAvailable - a.scenarioAvailable)[0];
    const focusHub =
      (scenarioInfo?.assumptions.hubId
        ? openHubs.find((b) => b.hubId === scenarioInfo.assumptions.hubId)
        : undefined) ??
      replacementHub ??
      topTarget ??
      openHubs[0];
    const inUse = focusHub?.inUseChargingPorts ?? 2;

    let reason = "";
    if (scenarioType === "ADD_CHARGERS") {
      reason = `Đã thêm cổng sạc tại ${focusHub?.hubName ?? "Hub"} (chờ giảm ${Math.abs(waitDelta)} phút) · Xếp lại lịch sạc ưu tiên xe pin < 25%`;
    } else if (scenarioType === "HUB_CLOSURE") {
      reason = `Đẩy nhanh sạc ${inUse} xe đang cắm sạc tại ${replacementHub?.hubName ?? focusHub?.hubName ?? "Hub thay thế"} để phục vụ khách từ ${closedHub?.hubName ?? "Hub đóng cửa"}`;
    } else if (focusHub && inUse > 0) {
      reason = `Ưu tiên sạc nhanh ${inUse} xe đang cắm sạc tại ${focusHub.hubName} (pin < 25%) để quay vòng xe sớm`;
    } else {
      reason = `Thời gian chờ ${scenario.waitingTimeMinutes} phút · Ưu tiên sạc xe pin < 25%`;
    }

    recommendations.push({
      recommendationId: crypto.randomUUID(),
      targetUseCase: "UC13",
      reason,
      constraints: [
        "Không vượt giới hạn công suất điện của Hub.",
        "Không đổi lịch sạc đã CONFIRMED hoặc phiên đang sạc.",
      ],
    });
  }

  return recommendations;
}
