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

function isHubClosedInScenario(hubId: string, scenario: Scenario): boolean {
  if (scenario.scenarioType !== "HUB_CLOSURE") return false;
  return !scenario.assumptions.hubId || scenario.assumptions.hubId === hubId;
}

function getEffectiveHubPostScenario(
  hub: OperationalState["hubs"][number],
  scenario: Scenario,
): {
  closed: boolean;
  availableVehicles: number;
  freeSlots: number;
  totalChargingPorts: number;
  freeChargingPorts: number;
  busyChargingPorts: number;
} {
  const closed = isHubClosedInScenario(hub.id, scenario);
  if (closed) {
    return {
      closed: true,
      availableVehicles: 0,
      freeSlots: 0,
      totalChargingPorts: hub.totalChargingPorts,
      freeChargingPorts: 0,
      busyChargingPorts: 0,
    };
  }
  const isTarget = !scenario.assumptions.hubId || scenario.assumptions.hubId === hub.id;
  let availableVehicles = hub.availableVehicles;
  let freeSlots = hub.freeSlots;
  let totalChargingPorts = hub.totalChargingPorts;
  let freeChargingPorts = hub.freeChargingPorts;

  if (scenario.scenarioType === "ADD_VEHICLES" && isTarget) {
    const added = Math.max(0, scenario.assumptions.additionalVehicles ?? 4);
    availableVehicles += added;
    freeSlots = Math.max(0, freeSlots - added);
  } else if (scenario.scenarioType === "ADD_CHARGERS" && isTarget) {
    const addedChargers = Math.max(0, scenario.assumptions.additionalChargers ?? 2);
    totalChargingPorts += addedChargers;
    freeChargingPorts += addedChargers;
    availableVehicles = Math.min(hub.totalVehicles, availableVehicles + Math.ceil(addedChargers * 0.75));
  }

  const busyChargingPorts = Math.max(0, totalChargingPorts - freeChargingPorts);
  return {
    closed: false,
    availableVehicles,
    freeSlots,
    totalChargingPorts,
    freeChargingPorts,
    busyChargingPorts,
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

  const openHubsInScenario = clonedHubs.filter((h) => !isHubClosedInScenario(h.id, scenario));

  if (req.actionType === "REDISTRIBUTE_VEHICLES") {
    // Tìm Hub thiếu nhiều nhất (ưu tiên target của kịch bản nếu Hub đó không bị đóng) và Hub dư nhiều nhất làm mặc định
    const targetHub =
      (req.targetHubId ? clonedHubs.find((h) => h.id === req.targetHubId) : undefined) ??
      (scenario.assumptions.hubId && !isHubClosedInScenario(scenario.assumptions.hubId, scenario)
        ? clonedHubs.find((h) => h.id === scenario.assumptions.hubId)
        : undefined) ??
      [...openHubsInScenario].sort(
        (a, b) =>
          getEffectiveHubPostScenario(a, scenario).availableVehicles -
          getEffectiveHubPostScenario(b, scenario).availableVehicles,
      )[0];

    const sourceHub =
      (req.sourceHubId ? clonedHubs.find((h) => h.id === req.sourceHubId) : undefined) ??
      [...openHubsInScenario]
        .filter((h) => h.id !== targetHub?.id)
        .sort(
          (a, b) =>
            getEffectiveHubPostScenario(b, scenario).availableVehicles -
            getEffectiveHubPostScenario(a, scenario).availableVehicles,
        )[0];

    if (!targetHub || !sourceHub || sourceHub.id === targetHub.id) {
      unavailableKpis.push(
        "Cần ít nhất 2 Mobility Hub đang hoạt động khác nhau trong phạm vi kịch bản để mô phỏng điều chuyển xe.",
      );
      return {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: ["Chưa đủ Hub nguồn và Hub đích hợp lệ (không bị đóng) trong kịch bản."],
        unavailableKpis,
        limitations,
        appliedParams: {
          sourceHubId: sourceHub?.id,
          targetHubId: targetHub?.id,
          vehicleCount: 0,
        },
      };
    }

    const effectiveSource = getEffectiveHubPostScenario(sourceHub, scenario);
    const effectiveTarget = getEffectiveHubPostScenario(targetHub, scenario);

    if (effectiveSource.closed || effectiveTarget.closed) {
      const closedNames = [
        effectiveSource.closed ? `Hub nguồn ${sourceHub.name}` : null,
        effectiveTarget.closed ? `Hub đích ${targetHub.name}` : null,
      ]
        .filter(Boolean)
        .join(" và ");
      unavailableKpis.push(
        `Không thể mô phỏng điều chuyển xe vì ${closedNames} đang ở trạng thái đóng cửa trong kịch bản hiện tại (0 xe khả dụng / 0 chỗ tiếp nhận). Vui lòng chọn cặp Hub đang hoạt động.`,
      );
      return {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [`Từ chối điều chuyển liên quan tới Hub đã đóng trong kịch bản: ${closedNames}.`],
        unavailableKpis,
        limitations,
        appliedParams: {
          sourceHubId: sourceHub.id,
          targetHubId: targetHub.id,
          vehicleCount: 0,
        },
      };
    }

    const maxFromSource = Math.max(0, effectiveSource.availableVehicles - systemConfig.lowVehicleThreshold);
    const maxIntoTarget = Math.max(0, effectiveTarget.freeSlots);
    const maxMovable = Math.min(maxFromSource, maxIntoTarget);
    const requested =
      req.vehicleCount !== undefined
        ? Math.max(0, Math.floor(req.vehicleCount))
        : Math.min(3, maxMovable || Math.min(effectiveSource.availableVehicles, effectiveTarget.freeSlots));
    const actualMoved = Math.min(requested, effectiveSource.availableVehicles, effectiveTarget.freeSlots);

    if (actualMoved <= 0) {
      unavailableKpis.push(
        `Không thể chuyển xe từ ${sourceHub.name} (còn ${effectiveSource.availableVehicles} xe sau kịch bản) sang ${targetHub.name} (còn ${effectiveTarget.freeSlots} chỗ trống sau kịch bản) với tham số hiện tại.`,
      );
      return {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [
          `Hub nguồn: ${sourceHub.name} (${effectiveSource.availableVehicles} xe khả dụng sau kịch bản)`,
          `Hub đích: ${targetHub.name} (${effectiveTarget.freeSlots} chỗ trống sau kịch bản)`,
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

    sourceHub.availableVehicles = Math.max(0, sourceHub.availableVehicles - actualMoved);
    sourceHub.totalVehicles = Math.max(sourceHub.availableVehicles, sourceHub.totalVehicles - actualMoved);
    sourceHub.freeSlots += actualMoved;

    targetHub.availableVehicles += actualMoved;
    targetHub.totalVehicles += actualMoved;
    targetHub.freeSlots = Math.max(0, targetHub.freeSlots - actualMoved);

    assumptionsUsed.push(
      `Điều chuyển mô phỏng ${actualMoved} xe từ ${sourceHub.name} → ${targetHub.name} sau khi kiểm tra điều kiện mở cửa, xe khả dụng và sức chứa tiếp nhận dưới kịch bản đang xem.`,
    );
    if (requested > actualMoved) {
      assumptionsUsed.push(
        `Giới hạn thực tế sau kịch bản: chỉ chuyển tối đa ${actualMoved}/${requested} xe do số xe khả dụng ở Hub nguồn hoặc chỗ trống ở Hub đích.`,
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
    (scenario.assumptions.hubId && !isHubClosedInScenario(scenario.assumptions.hubId, scenario)
      ? clonedHubs.find((h) => h.id === scenario.assumptions.hubId)
      : undefined) ??
    [...openHubsInScenario].sort(
      (a, b) =>
        getEffectiveHubPostScenario(b, scenario).busyChargingPorts -
        getEffectiveHubPostScenario(a, scenario).busyChargingPorts,
    )[0] ??
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

  const effectiveFocus = getEffectiveHubPostScenario(focusHub, scenario);

  // Ghi nhận trung thực những KPI mô hình chưa đủ dữ liệu chi tiết để tính
  unavailableKpis.push(
    "Phân bổ công suất chi tiết từng cổng (kW), hàng đợi sạc và mức pin từng xe: bản chụp chỉ lưu tổng hợp theo Hub (pin trung bình, số cổng rảnh/tổng), không lưu danh sách xe nào đang chờ sạc.",
  );

  if (effectiveFocus.closed) {
    unavailableKpis.push(
      `Không thể mô phỏng ưu tiên lịch sạc tại ${focusHub.name} vì Hub này đang ở trạng thái đóng cửa trong kịch bản hiện tại.`,
    );
    return {
      runId,
      snapshotId,
      actionType: req.actionType,
      beforeAction,
      afterAction: beforeAction,
      assumptionsUsed: [`Hub ${focusHub.name} bị đóng trong kịch bản hiện tại nên không thể tiếp nhận sạc.`],
      unavailableKpis,
      limitations,
      appliedParams: {
        hubId: focusHub.id,
        priorityTurnaroundVehicles: 0,
      },
    };
  }

  // Chỉ được ước tính quay vòng sạc trên số cổng sạc THỰC SỰ đang bận trong bản chụp/kịch bản.
  // Không coi toàn bộ xe không khả dụng (có thể đang chạy ngoài đường hoặc bảo trì) là xe đang chờ sạc.
  if (effectiveFocus.totalChargingPorts <= 0 || effectiveFocus.busyChargingPorts <= 0) {
    unavailableKpis.push(
      `Chưa đủ dữ liệu để tính mức giảm thời gian chờ sạc tại ${focusHub.name}: sau khi áp kịch bản, cả ${effectiveFocus.freeChargingPorts}/${effectiveFocus.totalChargingPorts} cổng sạc đều đang rảnh (0 cổng đang bận) và bản chụp không có danh sách xe thực sự đang chờ sạc (xe không khả dụng có thể đang được thuê hoặc bảo trì).`,
    );
    return {
      runId,
      snapshotId,
      actionType: req.actionType,
      beforeAction,
      afterAction: beforeAction,
      assumptionsUsed: [
        `Hub áp dụng: ${focusHub.name} (${effectiveFocus.freeChargingPorts}/${effectiveFocus.totalChargingPorts} cổng sạc rảnh sau kịch bản, 0 cổng đang bận).`,
      ],
      unavailableKpis,
      limitations,
      appliedParams: {
        hubId: focusHub.id,
        priorityTurnaroundVehicles: 0,
      },
    };
  }

  const busyVehicles = Math.max(0, focusHub.totalVehicles - Math.min(focusHub.totalVehicles, effectiveFocus.availableVehicles));
  const maxTurnaround = Math.min(effectiveFocus.busyChargingPorts, busyVehicles);
  const requestedTurnaround =
    req.priorityTurnaroundVehicles !== undefined
      ? Math.max(0, Math.floor(req.priorityTurnaroundVehicles))
      : Math.min(maxTurnaround, Math.max(1, Math.ceil(effectiveFocus.busyChargingPorts * 0.5)));
  const actualTurnaround = Math.min(requestedTurnaround, maxTurnaround);

  if (actualTurnaround <= 0) {
    unavailableKpis.push(
      `Chưa đủ dữ liệu để ước tính số xe quay vòng nhờ ưu tiên sạc tại ${focusHub.name} (cổng đang bận: ${effectiveFocus.busyChargingPorts}, xe chưa sẵn sàng: ${busyVehicles}).`,
    );
    return {
      runId,
      snapshotId,
      actionType: req.actionType,
      beforeAction,
      afterAction: beforeAction,
      assumptionsUsed: [
        `Hub áp dụng: ${focusHub.name} (${effectiveFocus.busyChargingPorts}/${effectiveFocus.totalChargingPorts} cổng đang bận).`,
      ],
      unavailableKpis,
      limitations,
      appliedParams: {
        hubId: focusHub.id,
        priorityTurnaroundVehicles: 0,
      },
    };
  }

  // Giới hạn nghiêm ngặt trong phạm vi số cổng đang thực sự bận (`busyChargingPorts`)
  focusHub.availableVehicles = Math.min(focusHub.totalVehicles, focusHub.availableVehicles + actualTurnaround);
  focusHub.freeChargingPorts = Math.min(
    focusHub.totalChargingPorts,
    focusHub.freeChargingPorts + Math.min(effectiveFocus.busyChargingPorts, Math.ceil(actualTurnaround * 0.5)),
  );

  assumptionsUsed.push(
    `Ưu tiên sạc xe pin thấp (< 25%) tại ${focusHub.name}: giả định ${actualTurnaround} xe (giới hạn trong ${effectiveFocus.busyChargingPorts} cổng đang thực sự bận của bản chụp) quay vòng sớm hơn trong khung đánh giá.`,
  );
  limitations.push(
    "Ước lượng độ nhạy chỉ áp dụng trên số cổng đang thực sự bận trong bản chụp tổng hợp; không thay đổi lịch sạc CONFIRMED hay phiên đang sạc thật.",
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
