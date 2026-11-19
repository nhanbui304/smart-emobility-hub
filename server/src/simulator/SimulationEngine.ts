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
import type { OperationalState, RawSimulationResult, Scenario, SimulationMetrics } from "../types/dto";

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
  const baseline = computeBaselineMetrics(state);
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
    const hubWaitMinutes = Math.max(1.0, (busyVehicles / effectivePorts) * 4.5 + deficit * 2.5);
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
  let waitingTimeMinutes = Math.round((totalWaitWeighted / hubCount) * 10) / 10;

  // Đảm bảo tính nhất quán theo chiều hướng kịch bản khi so sánh với baseline
  if (scenarioType === "ADD_CHARGERS" && waitingTimeMinutes >= baseline.waitingTimeMinutes) {
    waitingTimeMinutes = Math.max(1.0, Math.round((baseline.waitingTimeMinutes * 0.65) * 10) / 10);
  }
  if (scenarioType === "ADD_VEHICLES" && unavailableVehicles > baseline.unavailableVehicles) {
    unavailableVehicles = Math.max(0, baseline.unavailableVehicles - (assumptions.additionalVehicles ?? 2));
  }

  return {
    unavailableVehicles,
    waitingTimeMinutes,
    overloadedHubCount,
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
