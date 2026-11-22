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
  SimulatedHubBreakdown,
  SimulationMetrics,
} from "../types/dto";

const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
const abortedRunIds = new Set<string>();

/** Nhu cầu cơ sở ước tính tại mỗi Hub (~50% tổng số xe tại Hub, tối thiểu 4 xe). */
export function getHubBaselineDemand(totalVehicles: number): number {
  return Math.max(4, Math.round(totalVehicles * 0.5));
}

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
    const baselineDemand = getHubBaselineDemand(h.totalVehicles);
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

export interface SimulatedHubState {
  id: string;
  name: string;
  closed: boolean;
  totalVehicles: number;
  availableVehicles: number;
  freeSlots: number;
  totalChargingPorts: number;
  freeChargingPorts: number;
  /** Chỉ đếm cổng thực sự ở trạng thái IN_USE trong snapshot; undefined nếu snapshot cũ chưa có trường này. */
  inUseChargingPorts?: number;
  demand: number;
}

/**
 * Áp kịch bản giả định ĐÚNG MỘT LẦN lên bản chụp OperationalState để tạo trạng thái sau kịch bản.
 * Dùng chung cho cả tính KPI kịch bản và làm đầu vào trực tiếp cho mô phỏng tác động hành động
 * (không bao giờ áp lại kịch bản lần 2 gây tính trùng xe).
 */
export function applyScenarioToHubStates(state: OperationalState, scenario: Scenario): SimulatedHubState[] {
  const { scenarioType, assumptions } = scenario;
  const targetHubId = assumptions.hubId;

  const states: SimulatedHubState[] = state.hubs.map((h) => {
    const isTarget = !targetHubId || h.id === targetHubId;
    let closed = false;
    let totalVehicles = h.totalVehicles;
    let availableVehicles = h.availableVehicles;
    let freePorts = h.freeChargingPorts;
    let totalPorts = h.totalChargingPorts;
    let freeSlots = h.freeSlots;
    let inUseChargingPorts = typeof h.inUseChargingPorts === "number" ? h.inUseChargingPorts : undefined;
    let demand = getHubBaselineDemand(h.totalVehicles);

    if (scenarioType === "DEMAND_SURGE" && isTarget) {
      const mult = assumptions.demandMultiplier ?? 1.5;
      demand = Math.round(demand * mult);
    } else if (scenarioType === "HUB_CLOSURE") {
      if (isTarget) {
        // Hub bị đóng: toàn bộ xe tại Hub này không thể cho mượn, chỗ đỗ & cổng sạc ngừng tiếp nhận
        closed = true;
        availableVehicles = 0;
        freeSlots = 0;
        freePorts = 0;
        if (inUseChargingPorts !== undefined) {
          inUseChargingPorts = 0;
        }
      }
    } else if (scenarioType === "ADD_CHARGERS" && isTarget) {
      const addChargers = Math.max(0, assumptions.additionalChargers ?? 2);
      freePorts += addChargers;
      totalPorts += addChargers;
      // Cổng mới thêm giúp giải phóng nhanh các xe đang chờ sạc/pin yếu tại Hub (giữ lại tối thiểu 1 xe đang sạc IN_USE nếu có)
      const reserveInUse = (inUseChargingPorts ?? 0) > 0 ? 1 : 0;
      const maxAvail = Math.max(availableVehicles, totalVehicles - reserveInUse);
      availableVehicles = Math.min(maxAvail, availableVehicles + Math.ceil(addChargers * 0.6));
    } else if (scenarioType === "ADD_VEHICLES" && targetHubId && isTarget) {
      const addVehicles = Math.max(0, assumptions.additionalVehicles ?? 4);
      availableVehicles += addVehicles;
      totalVehicles += addVehicles;
      freeSlots = Math.max(0, freeSlots - addVehicles);
    }

    return {
      id: h.id,
      name: h.name,
      closed,
      totalVehicles,
      availableVehicles,
      freeSlots,
      totalChargingPorts: totalPorts,
      freeChargingPorts: freePorts,
      inUseChargingPorts,
      demand,
    };
  });

  // Nếu ADD_VEHICLES áp dụng cho Toàn mạng lưới (!targetHubId), phân bổ số xe thêm ưu tiên vào các Hub đang thiếu xe
  if (scenarioType === "ADD_VEHICLES" && !targetHubId && states.length > 0) {
    let remaining = Math.max(0, assumptions.additionalVehicles ?? 4);
    const byDeficit = [...states].sort((a, b) => (b.demand - b.availableVehicles) - (a.demand - a.availableVehicles));
    for (const st of byDeficit) {
      if (remaining <= 0) break;
      const deficit = Math.max(0, st.demand - st.availableVehicles);
      const give = deficit > 0 ? Math.min(remaining, deficit) : 0;
      if (give > 0) {
        st.availableVehicles += give;
        st.totalVehicles += give;
        remaining -= give;
      }
    }
    let idx = 0;
    while (remaining > 0) {
      const st = byDeficit[idx % byDeficit.length]!;
      st.availableVehicles += 1;
      st.totalVehicles += 1;
      remaining -= 1;
      idx += 1;
    }
  }

  return states;
}

/**
 * Dựng bảng chi tiết từng Hub (Trước vs Sau kịch bản/hành động) để hiển thị rõ trên UI:
 * Hub nào đang thiếu bao nhiêu xe, Hub nào đang dư bao nhiêu xe, tổng thiếu toàn mạng là bao nhiêu.
 */
export function buildHubBreakdowns(
  state: OperationalState,
  scenario: Scenario,
  customHubStates?: SimulatedHubState[],
): SimulatedHubBreakdown[] {
  const scenarioHubs = customHubStates ?? applyScenarioToHubStates(state, scenario);
  const byId = new Map(scenarioHubs.map((h) => [h.id, h]));

  const rows: SimulatedHubBreakdown[] = state.hubs.map((baseHub) => {
    const baseDemand = getHubBaselineDemand(baseHub.totalVehicles);
    const baseDeficit = Math.max(0, baseDemand - baseHub.availableVehicles);
    const baseSurplus = Math.max(0, baseHub.availableVehicles - baseDemand);

    const sc = byId.get(baseHub.id);
    const scAvail = sc ? sc.availableVehicles : baseHub.availableVehicles;
    const scDemand = sc ? sc.demand : baseDemand;
    const closed = sc ? sc.closed : false;
    const scDeficit = Math.max(0, scDemand - scAvail);
    const scSurplus = closed ? 0 : Math.max(0, scAvail - scDemand);
    const freeSlots = sc ? sc.freeSlots : baseHub.freeSlots;
    const isOverloaded =
      closed ||
      scDeficit > 0 ||
      scAvail < systemConfig.lowVehicleThreshold ||
      freeSlots <= systemConfig.nearFullThreshold;

    return {
      hubId: baseHub.id,
      hubName: baseHub.name,
      closed,
      baselineAvailable: baseHub.availableVehicles,
      baselineDemand: baseDemand,
      baselineDeficit: baseDeficit,
      baselineSurplus: baseSurplus,
      baselineFreeSlots: baseHub.freeSlots,
      scenarioAvailable: scAvail,
      scenarioDemand: scDemand,
      scenarioDeficit: scDeficit,
      scenarioSurplus: scSurplus,
      scenarioFreeSlots: freeSlots,
      isTargetHub: scenario.assumptions.hubId ? scenario.assumptions.hubId === baseHub.id : false,
      isOverloaded,
      inUseChargingPorts: sc?.inUseChargingPorts ?? baseHub.inUseChargingPorts,
      freeChargingPorts: sc?.freeChargingPorts ?? baseHub.freeChargingPorts,
      totalChargingPorts: sc?.totalChargingPorts ?? baseHub.totalChargingPorts,
    };
  });

  return rows.sort((a, b) => {
    if (a.isTargetHub !== b.isTargetHub) return a.isTargetHub ? -1 : 1;
    if (a.scenarioDeficit !== b.scenarioDeficit) return b.scenarioDeficit - a.scenarioDeficit;
    return b.scenarioSurplus - a.scenarioSurplus;
  });
}

/**
 * Tính 3 chỉ số KPI từ danh sách trạng thái Hub đã áp kịch bản (và/hoặc đã áp hành động).
 */
export function computeMetricsFromHubStates(hubs: SimulatedHubState[]): SimulationMetrics {
  let unavailableVehicles = 0;
  let totalWaitWeighted = 0;
  let overloadedHubCount = 0;

  for (const h of hubs) {
    const deficit = Math.max(0, h.demand - h.availableVehicles);
    unavailableVehicles += deficit;

    const busyVehicles = Math.max(1, h.totalVehicles - Math.min(h.totalVehicles, h.availableVehicles));
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

  const hubCount = Math.max(1, hubs.length);
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
  return computeMetricsFromHubStates(applyScenarioToHubStates(state, scenario));
}

export interface ActionSimulationExecution {
  result: ActionImpactResult;
  beforeHubs: SimulatedHubState[];
  afterHubs: SimulatedHubState[];
}

/**
 * Thực thi mô phỏng tác động hành động trực tiếp trên trạng thái sau kịch bản (chỉ áp kịch bản 1 lần).
 * Trả kèm trạng thái Hub trước/sau hành động để dễ kiểm chứng bảo toàn số xe và ràng buộc Hub đóng.
 */
export function simulateActionOnScenarioStates(
  runId: string,
  snapshotId: string,
  state: OperationalState,
  scenario: Scenario,
  req: ActionImpactRequest,
): ActionSimulationExecution {
  const beforeHubs = applyScenarioToHubStates(state, scenario);
  const beforeAction = computeMetricsFromHubStates(beforeHubs);
  const workingHubs = beforeHubs.map((h) => ({ ...h }));

  const assumptionsUsed: string[] = [];
  const unavailableKpis: string[] = [];
  const limitations: string[] = [
    "Tính toán hoàn toàn trên bản chụp và kịch bản mô phỏng; không tạo lệnh vận hành hay thay đổi tài nguyên thật.",
  ];

  const openHubs = workingHubs.filter((h) => !h.closed);

  if (req.actionType === "REDISTRIBUTE_VEHICLES") {
    const scenarioFocusHub = scenario.assumptions.hubId
      ? openHubs.find((h) => h.id === scenario.assumptions.hubId)
      : undefined;

    // Hub đích (nhận xe): ưu tiên Hub được chỉ định hoặc Hub đang thiếu nhiều xe nhất (demand - availableVehicles lớn nhất)
    const targetHub =
      (req.targetHubId ? workingHubs.find((h) => h.id === req.targetHubId) : undefined) ??
      (scenarioFocusHub && scenarioFocusHub.demand > scenarioFocusHub.availableVehicles
        ? scenarioFocusHub
        : undefined) ??
      [...openHubs].sort(
        (a, b) => (b.demand - b.availableVehicles) - (a.demand - a.availableVehicles),
      )[0];

    // Hub nguồn (xuất xe): ưu tiên Hub đang dư nhiều xe nhất so với nhu cầu (availableVehicles - demand lớn nhất)
    const sourceHub =
      (req.sourceHubId ? workingHubs.find((h) => h.id === req.sourceHubId) : undefined) ??
      [...openHubs]
        .filter((h) => h.id !== targetHub?.id)
        .sort(
          (a, b) =>
            (b.availableVehicles - b.demand) - (a.availableVehicles - a.demand) ||
            b.availableVehicles - a.availableVehicles,
        )[0];

    if (!targetHub || !sourceHub || sourceHub.id === targetHub.id) {
      unavailableKpis.push(
        "Cần ít nhất 2 Mobility Hub đang hoạt động khác nhau trong phạm vi kịch bản để mô phỏng điều chuyển xe.",
      );
      return {
        beforeHubs,
        afterHubs: workingHubs,
        result: {
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
        },
      };
    }

    if (sourceHub.closed || targetHub.closed) {
      const closedNames = [
        sourceHub.closed ? `Hub nguồn ${sourceHub.name}` : null,
        targetHub.closed ? `Hub đích ${targetHub.name}` : null,
      ]
        .filter(Boolean)
        .join(" và ");
      unavailableKpis.push(
        `Không thể mô phỏng điều chuyển xe vì ${closedNames} đang ở trạng thái đóng cửa trong kịch bản hiện tại (0 xe khả dụng / 0 chỗ tiếp nhận). Vui lòng chọn cặp Hub đang hoạt động.`,
      );
      return {
        beforeHubs,
        afterHubs: workingHubs,
        result: {
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
        },
      };
    }

    const sourceSurplus = Math.max(0, sourceHub.availableVehicles - sourceHub.demand);
    const targetDeficit = Math.max(1, targetHub.demand - targetHub.availableVehicles);
    const maxFromSource = Math.max(0, sourceHub.availableVehicles - systemConfig.lowVehicleThreshold);
    const maxIntoTarget = Math.max(0, targetHub.freeSlots);
    const defaultSuggested = Math.min(
      targetDeficit,
      sourceSurplus > 0 ? sourceSurplus : Math.max(1, maxFromSource),
      maxIntoTarget,
    );
    const requested =
      req.vehicleCount !== undefined
        ? Math.max(0, Math.floor(req.vehicleCount))
        : Math.max(1, defaultSuggested);
    const actualMoved = Math.min(requested, sourceHub.availableVehicles, targetHub.freeSlots);

    if (actualMoved <= 0) {
      unavailableKpis.push(
        `Không thể chuyển xe từ ${sourceHub.name} (còn ${sourceHub.availableVehicles} xe sau kịch bản) sang ${targetHub.name} (còn ${targetHub.freeSlots} chỗ trống sau kịch bản) với tham số hiện tại.`,
      );
      return {
        beforeHubs,
        afterHubs: workingHubs,
        result: {
          runId,
          snapshotId,
          actionType: req.actionType,
          beforeAction,
          afterAction: beforeAction,
          assumptionsUsed: [
            `Hub nguồn: ${sourceHub.name} (${sourceHub.availableVehicles} xe khả dụng sau kịch bản)`,
            `Hub đích: ${targetHub.name} (${targetHub.freeSlots} chỗ trống sau kịch bản)`,
          ],
          unavailableKpis,
          limitations,
          appliedParams: {
            sourceHubId: sourceHub.id,
            targetHubId: targetHub.id,
            vehicleCount: 0,
          },
        },
      };
    }

    // Cập nhật trực tiếp trên trạng thái sau kịch bản (KHÔNG áp lại kịch bản lần 2)
    sourceHub.availableVehicles -= actualMoved;
    sourceHub.totalVehicles -= actualMoved;
    sourceHub.freeSlots += actualMoved;

    targetHub.availableVehicles += actualMoved;
    targetHub.totalVehicles += actualMoved;
    targetHub.freeSlots -= actualMoved;

    assumptionsUsed.push(
      `Điều chuyển mô phỏng ${actualMoved} xe từ ${sourceHub.name} → ${targetHub.name} trực tiếp trên trạng thái sau kịch bản (tổng số xe toàn mạng lưới được bảo toàn).`,
    );
    if (requested > actualMoved) {
      assumptionsUsed.push(
        `Giới hạn thực tế sau kịch bản: chỉ chuyển tối đa ${actualMoved}/${requested} xe do số xe khả dụng ở Hub nguồn hoặc chỗ trống ở Hub đích.`,
      );
    }
    limitations.push("Mô hình chưa tính thời gian di chuyển vật lý giữa hai Hub trong lúc xe đang quá cảnh.");

    const afterAction = computeMetricsFromHubStates(workingHubs);
    return {
      beforeHubs,
      afterHubs: workingHubs,
      result: {
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
        hubBreakdowns: buildHubBreakdowns(state, scenario, workingHubs),
      },
    };
  }

  // Hành động 2: PRIORITIZE_LOW_BATTERY_CHARGING (UC13 — Ưu tiên sạc xe pin thấp < 25%)
  const focusHub =
    (req.hubId ? workingHubs.find((h) => h.id === req.hubId) : undefined) ??
    (scenario.assumptions.hubId ? openHubs.find((h) => h.id === scenario.assumptions.hubId) : undefined) ??
    [...openHubs].sort((a, b) => (b.inUseChargingPorts ?? -1) - (a.inUseChargingPorts ?? -1))[0] ??
    workingHubs[0];

  if (!focusHub) {
    unavailableKpis.push("Không tìm thấy Hub hợp lệ trong bản chụp để mô phỏng ưu tiên lịch sạc.");
    return {
      beforeHubs,
      afterHubs: workingHubs,
      result: {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [],
        unavailableKpis,
        limitations,
        appliedParams: {},
      },
    };
  }

  unavailableKpis.push(
    "Phân bổ công suất chi tiết từng cổng (kW), hàng đợi sạc và mức pin từng xe: bản chụp chỉ lưu tổng hợp theo Hub, không lưu danh sách xe nào đang chờ sạc.",
  );

  if (focusHub.closed) {
    unavailableKpis.push(
      `Không thể mô phỏng ưu tiên lịch sạc tại ${focusHub.name} vì Hub này đang ở trạng thái đóng cửa trong kịch bản hiện tại.`,
    );
    return {
      beforeHubs,
      afterHubs: workingHubs,
      result: {
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
      },
    };
  }

  // Snapshot cũ chưa lưu trường inUseChargingPorts -> không suy đoán từ (total - free) vì dễ gộp nhầm cổng hỏng OUT_OF_SERVICE
  if (focusHub.inUseChargingPorts === undefined) {
    unavailableKpis.push(
      `Bản chụp cũ của ${focusHub.name} chưa lưu riêng số cổng sạc đang sử dụng (IN_USE), nên không thể phân biệt cổng đang sạc với cổng hỏng (OUT_OF_SERVICE). Giữ nguyên KPI trước/sau thay vì ước tính.`,
    );
    return {
      beforeHubs,
      afterHubs: workingHubs,
      result: {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [`Bản chụp cũ thiếu trường số cổng đang sạc (IN_USE) tại ${focusHub.name}.`],
        unavailableKpis,
        limitations,
        appliedParams: {
          hubId: focusHub.id,
          priorityTurnaroundVehicles: 0,
        },
      },
    };
  }

  // Chỉ tính trên cổng thực sự IN_USE (cổng hỏng OUT_OF_SERVICE và cổng mới thêm trong ADD_CHARGERS KHÔNG phải phiên đang sạc)
  if (focusHub.inUseChargingPorts <= 0) {
    unavailableKpis.push(
      `Tại ${focusHub.name} hiện có 0 cổng sạc đang sử dụng (IN_USE) trong bản chụp (${focusHub.freeChargingPorts}/${focusHub.totalChargingPorts} cổng rảnh; cổng hỏng và cổng mới thêm không được tính là phiên đang sạc), nên giữ nguyên KPI trước/sau.`,
    );
    return {
      beforeHubs,
      afterHubs: workingHubs,
      result: {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [
          `Hub áp dụng: ${focusHub.name} (0 cổng đang sạc IN_USE; ${focusHub.freeChargingPorts}/${focusHub.totalChargingPorts} cổng rảnh).`,
        ],
        unavailableKpis,
        limitations,
        appliedParams: {
          hubId: focusHub.id,
          priorityTurnaroundVehicles: 0,
        },
      },
    };
  }

  const busyVehicles = Math.max(0, focusHub.totalVehicles - Math.min(focusHub.totalVehicles, focusHub.availableVehicles));
  const maxTurnaround = Math.min(focusHub.inUseChargingPorts, busyVehicles);
  const requestedTurnaround =
    req.priorityTurnaroundVehicles !== undefined
      ? Math.max(0, Math.floor(req.priorityTurnaroundVehicles))
      : Math.min(maxTurnaround, Math.max(1, Math.ceil(focusHub.inUseChargingPorts * 0.5)));
  const actualTurnaround = Math.min(requestedTurnaround, maxTurnaround);

  if (actualTurnaround <= 0) {
    unavailableKpis.push(
      `Chưa đủ dữ liệu để ước tính số xe quay vòng nhờ ưu tiên sạc tại ${focusHub.name} (cổng IN_USE: ${focusHub.inUseChargingPorts}, xe chưa sẵn sàng: ${busyVehicles}).`,
    );
    return {
      beforeHubs,
      afterHubs: workingHubs,
      result: {
        runId,
        snapshotId,
        actionType: req.actionType,
        beforeAction,
        afterAction: beforeAction,
        assumptionsUsed: [
          `Hub áp dụng: ${focusHub.name} (${focusHub.inUseChargingPorts} cổng IN_USE, ${busyVehicles} xe chưa sẵn sàng).`,
        ],
        unavailableKpis,
        limitations,
        appliedParams: {
          hubId: focusHub.id,
          priorityTurnaroundVehicles: 0,
        },
      },
    };
  }

  const freedPorts = Math.min(focusHub.inUseChargingPorts, Math.ceil(actualTurnaround * 0.5));
  focusHub.availableVehicles = Math.min(focusHub.totalVehicles, focusHub.availableVehicles + actualTurnaround);
  focusHub.freeChargingPorts = Math.min(focusHub.totalChargingPorts, focusHub.freeChargingPorts + freedPorts);
  focusHub.inUseChargingPorts = Math.max(0, focusHub.inUseChargingPorts - freedPorts);

  assumptionsUsed.push(
    `Ưu tiên sạc xe pin thấp (< 25%) tại ${focusHub.name}: giả định ${actualTurnaround} xe (giới hạn trong ${maxTurnaround} cổng thực sự đang sạc IN_USE của bản chụp, không tính cổng hỏng hay cổng mới thêm) quay vòng sớm hơn.`,
  );
  limitations.push(
    "Ước lượng độ nhạy chỉ áp dụng trên số cổng thực sự ở trạng thái IN_USE trong bản chụp; không thay đổi lịch sạc CONFIRMED hay phiên đang sạc thật.",
  );

  const afterAction = computeMetricsFromHubStates(workingHubs);
  return {
    beforeHubs,
    afterHubs: workingHubs,
    result: {
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
      hubBreakdowns: buildHubBreakdowns(state, scenario, workingHubs),
    },
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
  return simulateActionOnScenarioStates(runId, snapshotId, state, scenario, req).result;
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
