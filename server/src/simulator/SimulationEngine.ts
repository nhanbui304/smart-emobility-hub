// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC14.drawio). Đổi chữ ký thì sửa cả sơ đồ.
/**
 * Chạy mô phỏng trên snapshot đã chụp (bảng simulation_snapshots), KHÔNG đọc/ghi bảng vận hành
 * (xe, chỗ đỗ, lịch sạc...) – đảm bảo cách ly dữ liệu mô phỏng (Dependability, Sub #3 mục 1.4 & TC-UC14-01).
 * Chạy nền bất đồng bộ: runBaselineAndScenario trả về ngay; xong thì gọi simulationService.runCompleted / runFailed.
 */
import { systemConfig } from "../config/systemConfig";
import { findSnapshotById } from "../repositories/SimulationRunRepository";
import { simulationService } from "../services/SimulationService";
import type {
  ActionImpactRequest,
  ActionImpactResult,
  OperationalState,
  RawSimulationResult,
  Scenario,
  SimulationMetrics,
} from "../types/dto";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const abortedRunIds = new Set<string>();

/**
 * Tính chỉ số Phương án cơ sở (Baseline) hoàn toàn từ dữ liệu trong bản chụp OperationalState.
 * Thuật toán tất định (deterministic) để đảm bảo yêu cầu NFR "Tái lập kiểm thử".
 */
export function computeBaselineMetrics(state: OperationalState): SimulationMetrics {
  let unavailableVehicles = 0;
  let totalWaitWeighted = 0;
  let overloadedHubCount = 0;

  for (const h of state.hubs) {
    // Nhu cầu cơ sở ước tính tại mỗi Hub trong khung giờ đánh giá
    const baselineDemand = Math.max(6, Math.round(h.totalVehicles * 0.85));
    const deficit = Math.max(0, baselineDemand - h.availableVehicles);
    unavailableVehicles += deficit;

    // Thời gian chờ cơ sở phụ thuộc vào số xe đang bận/sạc so với số cổng sạc rảnh và xe sẵn sàng
    const busyVehicles = Math.max(1, h.totalVehicles - h.availableVehicles);
    const effectivePorts = Math.max(1, h.freeChargingPorts + Math.round(h.totalChargingPorts * 0.5));
    const hubWaitMinutes = (busyVehicles / effectivePorts) * 4.5 + deficit * 2.5;
    totalWaitWeighted += hubWaitMinutes;

    const isOverloaded =
      deficit > 0 ||
      h.availableVehicles < systemConfig.lowVehicleThreshold ||
      h.freeSlots <= systemConfig.nearFullThreshold;
    if (isOverloaded) {
      overloadedHubCount++;
    }
  }

  const hubCount = Math.max(1, state.hubs.length);
  const waitingTimeMinutes = Math.round((totalWaitWeighted / hubCount) * 10) / 10;

  return {
    unavailableVehicles,
    waitingTimeMinutes,
    overloadedHubCount,
  };
}

/**
 * Tính chỉ số Kịch bản giả định (Scenario) trên cùng bản chụp OperationalState và cùng điều kiện so sánh.
 */
export function computeScenarioMetrics(state: OperationalState, scenario: Scenario): SimulationMetrics {
  const { scenarioType, assumptions } = scenario;
  const targetHubId = assumptions.hubId;

  let unavailableVehicles = 0;
  let totalWaitWeighted = 0;
  let overloadedHubCount = 0;

  for (const h of state.hubs) {
    const isTarget = !targetHubId || h.id === targetHubId;
    let availVehicles = h.availableVehicles;
    let freePorts = h.freeChargingPorts;
    let totalPorts = h.totalChargingPorts;
    let freeSlots = h.freeSlots;
    let demand = Math.max(6, Math.round(h.totalVehicles * 0.85));

    if (scenarioType === "DEMAND_SURGE" && isTarget) {
      const mult = assumptions.demandMultiplier ?? 1.5;
      demand = Math.round(demand * mult);
    } else if (scenarioType === "HUB_CLOSURE") {
      if (isTarget) {
        // Hub bị đóng: toàn bộ xe tại Hub này không thể cho mượn, chỗ đỗ ngừng tiếp nhận
        availVehicles = 0;
        freeSlots = 0;
        freePorts = 0;
      } else {
        // Nhu cầu từ Hub đóng dồn sang các Hub lân cận
        demand = Math.round(demand * 1.35);
      }
    } else if (scenarioType === "ADD_CHARGERS" && isTarget) {
      const addChargers = Math.max(0, assumptions.additionalChargers ?? 2);
      freePorts += addChargers;
      totalPorts += addChargers;
      // Thêm cổng sạc giúp xe đang sạc hoàn tất nhanh hơn, tăng số xe sẵn sàng phục vụ
      availVehicles = Math.min(h.totalVehicles, availVehicles + Math.ceil(addChargers * 0.75));
    } else if (scenarioType === "ADD_VEHICLES" && isTarget) {
      const addVehicles = Math.max(0, assumptions.additionalVehicles ?? 4);
      availVehicles += addVehicles;
    }

    const deficit = Math.max(0, demand - availVehicles);
    unavailableVehicles += deficit;

    const busyVehicles = Math.max(1, h.totalVehicles - Math.min(h.totalVehicles, availVehicles));
    const effectivePorts = Math.max(1, freePorts + Math.round(totalPorts * 0.5));
    const hubWaitMinutes = (busyVehicles / effectivePorts) * 4.5 + deficit * 2.5;
    totalWaitWeighted += hubWaitMinutes;

    const isOverloaded =
      deficit > 0 ||
      availVehicles < systemConfig.lowVehicleThreshold ||
      freeSlots <= systemConfig.nearFullThreshold;
    if (isOverloaded) {
      overloadedHubCount++;
    }
  }

  const hubCount = Math.max(1, state.hubs.length);
  const waitingTimeMinutes = Math.round((totalWaitWeighted / hubCount) * 10) / 10;

  return {
    unavailableVehicles,
    waitingTimeMinutes,
    overloadedHubCount,
  };
}

/**
 * Dự đoán tác động của một hành động điều phối (UC12 / UC13) HOÀN TOÀN trên bản chụp OperationalState
 * và kịch bản đã chạy. Không đọc/ghi bất kỳ bảng vận hành thật nào.
 */
export function computeActionImpactOnScenario(
  runId: string,
  snapshotId: string,
  state: OperationalState,
  scenario: Scenario,
  req: ActionImpactRequest,
): ActionImpactResult {
  const beforeAction = computeScenarioMetrics(state, scenario);
  const clonedHubs = state.hubs.map((h) => ({ ...h }));
  const clonedState: OperationalState = {
    hubIds: [...state.hubIds],
    timeRange: { ...state.timeRange },
    hubs: clonedHubs,
  };

  const assumptionsUsed: string[] = [];
  const unavailableKpis: string[] = [];
  const limitations: string[] = [
    "Tính toán hoàn toàn trên bản chụp và kịch bản mô phỏng; không tạo lệnh vận hành hay thay đổi tài nguyên thật.",
  ];

  if (req.actionType === "REDISTRIBUTE_VEHICLES") {
    // Tìm Hub thiếu nhiều nhất (ưu tiên target của kịch bản) và Hub dư nhiều nhất làm mặc định nếu chưa chỉ định
    const targetHub =
      (req.targetHubId ? clonedHubs.find((h) => h.id === req.targetHubId) : undefined) ??
      (scenario.assumptions.hubId && scenario.scenarioType !== "HUB_CLOSURE"
        ? clonedHubs.find((h) => h.id === scenario.assumptions.hubId)
        : undefined) ??
      [...clonedHubs].sort((a, b) => a.availableVehicles - b.availableVehicles)[0];

    const sourceHub =
      (req.sourceHubId ? clonedHubs.find((h) => h.id === req.sourceHubId) : undefined) ??
      [...clonedHubs]
        .filter((h) => h.id !== targetHub?.id)
        .sort((a, b) => b.availableVehicles - a.availableVehicles)[0];

    if (!targetHub || !sourceHub || sourceHub.id === targetHub.id) {
      unavailableKpis.push(
        "Cần ít nhất 2 Mobility Hub khác nhau trong phạm vi bản chụp để mô phỏng điều chuyển xe.",
      );
      return {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: ["Chưa đủ Hub nguồn và Hub đích khác nhau trong bản chụp."],
        unavailableKpis,
        limitations,
        appliedParams: {
          sourceHubId: sourceHub?.id,
          targetHubId: targetHub?.id,
          vehicleCount: 0,
        },
      };
    }

    const maxFromSource = Math.max(0, sourceHub.availableVehicles - systemConfig.lowVehicleThreshold);
    const maxIntoTarget = Math.max(0, targetHub.freeSlots);
    const maxMovable = Math.min(maxFromSource, maxIntoTarget);
    const requested = req.vehicleCount !== undefined ? Math.max(0, Math.floor(req.vehicleCount)) : Math.min(3, maxMovable || sourceHub.availableVehicles);
    const actualMoved = Math.min(requested, sourceHub.availableVehicles, Math.max(0, targetHub.freeSlots));

    if (actualMoved <= 0) {
      unavailableKpis.push(
        `Không thể chuyển xe từ ${sourceHub.name} (còn ${sourceHub.availableVehicles} xe) sang ${targetHub.name} (còn ${targetHub.freeSlots} chỗ trống) với tham số hiện tại.`,
      );
      return {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [
          `Hub nguồn: ${sourceHub.name} (${sourceHub.availableVehicles} xe khả dụng)`,
          `Hub đích: ${targetHub.name} (${targetHub.freeSlots} chỗ trống)`,
        ],
        unavailableKpis,
        limitations,
        appliedParams: {
          sourceHubId: sourceHub.id,
          targetHubId: targetHub.id,
          vehicleCount: 0,
        },
      };
    }

    sourceHub.availableVehicles -= actualMoved;
    sourceHub.totalVehicles = Math.max(sourceHub.availableVehicles, sourceHub.totalVehicles - actualMoved);
    sourceHub.freeSlots += actualMoved;

    targetHub.availableVehicles += actualMoved;
    targetHub.totalVehicles += actualMoved;
    targetHub.freeSlots = Math.max(0, targetHub.freeSlots - actualMoved);

    assumptionsUsed.push(
      `Điều chuyển mô phỏng ${actualMoved} xe từ ${sourceHub.name} → ${targetHub.name} trên cùng bản chụp & kịch bản đang xem.`,
    );
    if (requested > actualMoved) {
      assumptionsUsed.push(
        `Giới hạn thực tế bản chụp: chỉ chuyển tối đa ${actualMoved}/${requested} xe do số xe khả dụng ở Hub nguồn hoặc chỗ trống ở Hub đích.`,
      );
    }
    limitations.push("Mô hình chưa tính thời gian di chuyển vật lý giữa hai Hub trong lúc xe đang quá cảnh.");

    const afterAction = computeScenarioMetrics(clonedState, scenario);
    return {
      runId,
      snapshotId,
      actionType: req.actionType,
      beforeAction,
      afterAction,
      assumptionsUsed,
      unavailableKpis,
      limitations,
      appliedParams: {
        sourceHubId: sourceHub.id,
        targetHubId: targetHub.id,
        vehicleCount: actualMoved,
      },
    };
  }

  // Hành động 2: PRIORITIZE_LOW_BATTERY_CHARGING (UC13 — Ưu tiên sạc xe pin thấp < 25%)
  const focusHub =
    (req.hubId ? clonedHubs.find((h) => h.id === req.hubId) : undefined) ??
    (scenario.assumptions.hubId ? clonedHubs.find((h) => h.id === scenario.assumptions.hubId) : undefined) ??
    clonedHubs[0];

  if (!focusHub) {
    unavailableKpis.push("Không tìm thấy Hub hợp lệ trong bản chụp để mô phỏng ưu tiên lịch sạc.");
    return {
      runId,
      snapshotId,
      actionType: req.actionType,
      beforeAction,
      afterAction: beforeAction,
      assumptionsUsed: [],
      unavailableKpis,
      limitations,
      appliedParams: {},
    };
  }

  const busyAtHub = Math.max(0, focusHub.totalVehicles - focusHub.availableVehicles);
  const maxTurnaround = Math.min(focusHub.totalChargingPorts, busyAtHub);
  const requestedTurnaround =
    req.priorityTurnaroundVehicles !== undefined
      ? Math.max(0, Math.floor(req.priorityTurnaroundVehicles))
      : Math.min(maxTurnaround, Math.max(1, Math.ceil(focusHub.totalChargingPorts * 0.5)));
  const actualTurnaround = Math.min(requestedTurnaround, maxTurnaround);

  // Ghi nhận trung thực những KPI mô hình chưa đủ dữ liệu chi tiết để tính
  unavailableKpis.push(
    "Phân bổ công suất chi tiết từng cổng (kW) và thời điểm đầy pin từng xe: bản chụp chỉ lưu tổng hợp theo Hub (pin trung bình, số cổng), chưa có mức pin riêng từng xe.",
  );

  if (maxTurnaround <= 0) {
    unavailableKpis.push(
      `Tại ${focusHub.name} hiện không có cổng sạc hoặc xe đang chờ/đang sạc trong bản chụp (cổng sạc: ${focusHub.totalChargingPorts}, xe bận: ${busyAtHub}) nên không thể tính mức giảm chờ sạc.`,
    );
    return {
      runId,
      snapshotId,
      actionType: req.actionType,
      beforeAction,
      afterAction: beforeAction,
      assumptionsUsed: [`Hub áp dụng: ${focusHub.name} (cổng sạc: ${focusHub.totalChargingPorts}, xe bận: ${busyAtHub})`],
      unavailableKpis,
      limitations,
      appliedParams: {
        hubId: focusHub.id,
        priorityTurnaroundVehicles: 0,
      },
    };
  }

  // Ưu tiên sạc xe pin thấp giúp giải phóng sớm `actualTurnaround` xe quay lại phục vụ & tối ưu cổng rảnh
  focusHub.availableVehicles = Math.min(focusHub.totalVehicles, focusHub.availableVehicles + actualTurnaround);
  focusHub.freeChargingPorts = Math.min(
    focusHub.totalChargingPorts,
    focusHub.freeChargingPorts + Math.ceil(actualTurnaround * 0.5),
  );

  assumptionsUsed.push(
    `Ưu tiên sạc xe pin thấp (< 25%) tại ${focusHub.name}: giả định ${actualTurnaround} xe (tối đa ${maxTurnaround} xe theo số cổng sạc & xe đang bận trong bản chụp) quay vòng sẵn sàng sớm hơn trong khung đánh giá.`,
  );
  limitations.push(
    "Số liệu dự kiến dựa trên trạng thái tổng hợp của bản chụp (pin TB & số cổng sạc của Hub), không thay đổi lịch sạc CONFIRMED hay phiên đang sạc thật.",
  );

  const afterAction = computeScenarioMetrics(clonedState, scenario);
  return {
    runId,
    snapshotId,
    actionType: req.actionType,
    beforeAction,
    afterAction,
    assumptionsUsed,
    unavailableKpis,
    limitations,
    appliedParams: {
      hubId: focusHub.id,
      priorityTurnaroundVehicles: actualTurnaround,
    },
  };
}

export const simulationEngine = {
  /**
   * UC14 bước 7: Chạy phương án cơ sở (baseline) và kịch bản giả định (scenario) trên cùng snapshot,
   * tách biệt hoàn toàn với dữ liệu vận hành thực tế.
   */
  runBaselineAndScenario(runId: string, snapshotId: string, scenario: Scenario): void {
    abortedRunIds.delete(runId);

    const timer = setTimeout(() => {
      activeTimers.delete(runId);
      if (abortedRunIds.has(runId)) {
        abortedRunIds.delete(runId);
        return;
      }

      try {
        const snapshot = findSnapshotById(snapshotId);
        if (!snapshot) {
          void simulationService.runFailed(runId, "Không tìm thấy bản chụp dữ liệu (Snapshot) khi đang chạy mô phỏng.");
          return;
        }

        const state = snapshot.operationalState;
        const baseline = computeBaselineMetrics(state);
        const scenarioMetrics = computeScenarioMetrics(state, scenario);

        const rawResults: RawSimulationResult = {
          baseline,
          scenario: scenarioMetrics,
        };

        void simulationService.runCompleted(runId, rawResults);
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Lỗi xử lý trong động cơ mô phỏng.";
        void simulationService.runFailed(runId, reason);
      }
    }, 80);

    activeTimers.set(runId, timer);
  },

  /** UC14 Ext 7b: Dừng lần chạy mô phỏng đang thực thi. */
  abort(runId: string): void {
    abortedRunIds.add(runId);
    const timer = activeTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(runId);
    }
  },
};
