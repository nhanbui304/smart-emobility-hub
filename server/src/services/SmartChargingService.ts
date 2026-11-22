// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC13.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import { AppError } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import { hubRepository } from "../repositories/HubRepository";
import { operationalRepository } from "../repositories/OperationalRepository";
import {
  committedChargingPortIds,
  getLatestAppliedSchedule,
  getLatestScheduleVersionNumber,
  getStoredPlanDraft,
  listHubChargingPortsWithSlots,
  savePlanDraft,
  validateScheduleConstraints,
  type StoredPlanDraft,
} from "../repositories/operational/chargingScheduleOps";
import type {
  ChargingContext,
  PlanAdjustment,
  PlanAllocation,
  PlanDraft,
  ScheduleResult,
  ValidatedPlan,
} from "../types/dto";
import { notificationService } from "./NotificationService";

/** Các quy tắc ưu tiên điều phối sạc được phép theo cấu hình (BTL1 trang 39 & 45). */
export const ALLOWED_PRIORITY_RULES = [
  "LOW_BATTERY_FIRST", // Ưu tiên xe pin thấp (< lowBatteryChargingPriority xét trước, sau đó tăng dần theo % pin)
  "SOONEST_USE_FIRST", // Ưu tiên xe sắp cần sử dụng / yêu cầu ghi nhận trước (FIFO)
  "MAX_NEED_FIRST", // Ưu tiên nhu cầu thiếu hụt năng lượng lớn nhất (targetBattery - currentBattery)
] as const;

/** Lưu ngữ cảnh Hub + khung giờ tạm thời khi gọi optimizeAllocation/markWaitingRequests theo đúng chữ ký sơ đồ. */
let currentPlanningMeta: { hubId: string; timeRange: TimeRange; ruleId: string } | null = null;

export const smartChargingService = {
  /** Hỗ trợ UI Operator xem phiên bản lịch sạc đang áp dụng mới nhất tại Hub. */
  async getLatestAppliedSchedule(hubId: string) {
    const hub = hubRepository.findById(hubId);
    if (!hub) {
      throw new AppError("NOT_FOUND", "Không tìm thấy Mobility Hub.");
    }
    return getLatestAppliedSchedule(hubId);
  },

  /**
   * UC13 bước 1–2: Đọc bối cảnh sạc tại Hub trong khoảng thời gian điều phối,
   * sau đó đánh giá độ đầy đủ và tính mới của dữ liệu (assessDataCompleteness).
   * Dữ liệu thiếu hoặc quá hạn → AppError CONFLICT (Ext 2a).
   */
  async getChargingContext(hubId: string, timeRange: TimeRange): Promise<ChargingContext> {
    const hub = hubRepository.findById(hubId);
    if (!hub) {
      throw new AppError("NOT_FOUND", "Không tìm thấy Mobility Hub.");
    }

    // Kiểm tra dữ liệu Hub có quá hạn cập nhật không (UC13 Ext 2a)
    const ageSeconds = Math.floor((Date.now() - hub.lastUpdatedAt.getTime()) / 1000);
    if (ageSeconds > systemConfig.dataStaleSeconds) {
      throw new AppError(
        "CONFLICT",
        `Dữ liệu tại ${hub.name} đã quá hạn cập nhật (${ageSeconds}s > ${systemConfig.dataStaleSeconds}s). Vui lòng làm mới dữ liệu trước khi lập kế hoạch.`,
      );
    }

    const context = operationalRepository.queryChargingContext(hubId, timeRange);
    if (!assessDataCompleteness(context)) {
      throw new AppError(
        "CONFLICT",
        "Thiếu dữ liệu cần thiết hoặc Hub không có khả năng cung cấp điện khả dụng.",
      );
    }

    return context;
  },

  /**
   * UC13 bước 3–4: Kiểm tra quy tắc ưu tiên (validatePriorityRule), tính thứ tự ưu tiên (computePriorities),
   * tối ưu phân bổ cổng/vị trí/công suất (optimizeAllocation) và đánh dấu các nhu cầu còn chờ (markWaitingRequests).
   * Không có phương án khả thi → AppError CONFLICT kèm ràng buộc (Ext 4b).
   */
  async generateProposedSchedule(
    hubId: string,
    timeRange: TimeRange,
    ruleId: string,
  ): Promise<PlanDraft> {
    if (!validatePriorityRule(ruleId)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Quy tắc ưu tiên '${ruleId}' không hợp lệ. Vui lòng chọn một trong các quy tắc: ${ALLOWED_PRIORITY_RULES.join(", ")}.`,
      );
    }

    const context = await this.getChargingContext(hubId, timeRange);
    const priorities = computePriorities(context, ruleId);

    currentPlanningMeta = { hubId, timeRange, ruleId };
    try {
      const draft = optimizeAllocation(context, priorities);
      markWaitingRequests(draft);

      // UC13 Ext 4b: Không có phương án khả thi nào được tạo dù có nhu cầu
      if (draft.proposedAllocations.length === 0 && context.demands.length > 0) {
        throw new AppError(
          "CONFLICT",
          "Không có phương án phân bổ khả thi: Tất cả cổng sạc tại Hub đang bị hạn chế sự cố, đã có cam kết hoặc không còn công suất khả dụng.",
        );
      }

      return draft;
    } finally {
      currentPlanningMeta = null;
    }
  },

  /**
   * UC13 bước 5–6: Áp dụng điều chỉnh của Operator vào bản nháp (applyAdjustments)
   * rồi kiểm tra toàn bộ kế hoạch (validateScheduleConstraints):
   * - Xung đột tài nguyên hoặc vượt giới hạn công suất (Ext 6a).
   * - Làm ảnh hưởng trái phép lịch đã xác nhận (CONFIRMED) hoặc phiên đang chạy (Ext 6b).
   */
  async validatePlan(planDraftId: string, adjustments: PlanAdjustment[]): Promise<ValidatedPlan> {
    const stored = getStoredPlanDraft(planDraftId);
    if (!stored) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản nháp kế hoạch sạc.");
    }

    const adjustedPlan = applyAdjustments(planDraftId, adjustments);
    const context = operationalRepository.queryChargingContext(stored.hubId, stored.timeRange);

    validateScheduleConstraints(adjustedPlan, context);
    savePlanDraft(adjustedPlan);

    return {
      planDraftId: adjustedPlan.draft.planDraftId,
      baseVersion: stored.baseVersion,
    };
  },

  /**
   * UC13 bước 7–9: Áp dụng kế hoạch trong một giao dịch nhất quán (operationalRepository.atomicApplyChargingSchedule):
   * - Kiểm tra gửi lặp bằng requestId (Ext 8c).
   * - Kiểm tra baseVersion và tài nguyên/hạn chế sự cố mới phát sinh (Ext 8a).
   * - Lưu phiên bản kế hoạch mới vào bảng charging_schedule_versions.
   * - Gửi thông báo cho các bên liên quan; nếu gửi thông báo thất bại thì markNotificationPending (Ext 9a).
   */
  async applyChargingSchedule(
    requestId: string,
    planDraftId: string,
    baseVersion: number,
    operatorId: string,
  ): Promise<ScheduleResult> {
    const applyResult = operationalRepository.atomicApplyChargingSchedule(
      requestId,
      planDraftId,
      baseVersion,
      operatorId,
    );

    if (applyResult.appliedNow) {
      try {
        const notifyRes = await notificationService.notifyAffectedParties(
          applyResult.scheduleVersionId,
          applyResult.changeSummary,
        );
        if (!notifyRes.sent) {
          operationalRepository.markNotificationPending(applyResult.scheduleVersionId);
        }
      } catch {
        // UC13 Ext 9a: Gửi thông báo thất bại -> giữ kế hoạch đã áp dụng, đánh dấu chờ gửi lại
        operationalRepository.markNotificationPending(applyResult.scheduleVersionId);
      }
    }

    return {
      scheduleVersionId: applyResult.scheduleVersionId,
      allocations: applyResult.allocations,
    };
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram UC13.drawio) ----------

/**
 * UC13 bước 2 (private "–" trong class diagram):
 * Đánh giá bối cảnh sạc có đủ dữ liệu hợp lệ để lập kế hoạch hay không.
 */
function assessDataCompleteness(chargingContext: ChargingContext): boolean {
  if (!chargingContext) return false;
  if (
    typeof chargingContext.hubPowerCapacityKw !== "number" ||
    Number.isNaN(chargingContext.hubPowerCapacityKw) ||
    chargingContext.hubPowerCapacityKw <= 0
  ) {
    return false;
  }
  return Array.isArray(chargingContext.demands) && Array.isArray(chargingContext.batteryLevels);
}

/**
 * UC13 bước 3 (private "–" trong class diagram):
 * Kiểm tra quy tắc ưu tiên có nằm trong danh mục được phép cấu hình hay không.
 */
function validatePriorityRule(ruleId: string): boolean {
  return (ALLOWED_PRIORITY_RULES as readonly string[]).includes(ruleId);
}

/**
 * UC13 bước 4 (private "–" trong class diagram):
 * Xác định thứ tự ưu tiên giữa các nhu cầu sạc theo quy tắc đã chọn (BTL1 trang 45):
 * - LOW_BATTERY_FIRST: Xe có mức pin < lowBatteryChargingPriority (25%) được xếp vào nhóm ưu tiên cao nhất,
 *   sắp xếp theo mức pin tăng dần; trong cùng mức pin giữ thứ tự ghi nhận trước (FIFO).
 * - SOONEST_USE_FIRST: Ưu tiên yêu cầu sạc của sinh viên / xe sắp sử dụng theo thứ tự ghi nhận trước.
 * - MAX_NEED_FIRST: Ưu tiên xe có độ thiếu hụt năng lượng (targetBattery - currentBattery) lớn nhất.
 */
function computePriorities(chargingContext: ChargingContext, ruleId: string): string[] {
  const demandsWithIndex = chargingContext.demands.map((d, index) => ({ demand: d, index }));

  demandsWithIndex.sort((a, b) => {
    const needA = a.demand.chargingNeed;
    const needB = b.demand.chargingNeed;

    if (ruleId === "LOW_BATTERY_FIRST") {
      const isLowA = needA.currentBattery < systemConfig.lowBatteryChargingPriority ? 0 : 1;
      const isLowB = needB.currentBattery < systemConfig.lowBatteryChargingPriority ? 0 : 1;
      if (isLowA !== isLowB) return isLowA - isLowB;
      if (needA.currentBattery !== needB.currentBattery) {
        return needA.currentBattery - needB.currentBattery;
      }
      return a.index - b.index; // Trong cùng nhóm, ghi nhận trước xét trước
    }

    if (ruleId === "MAX_NEED_FIRST") {
      const deficitA = needA.targetBattery - needA.currentBattery;
      const deficitB = needB.targetBattery - needB.currentBattery;
      if (deficitA !== deficitB) return deficitB - deficitA;
      return a.index - b.index;
    }

    // SOONEST_USE_FIRST: Ưu tiên yêu cầu sạc đã có thời điểm ghi nhận (charging_requests) trước, sau đó theo pin thấp
    const isExplicitReqA = a.demand.demandId.startsWith("demand-") ? 1 : 0;
    const isExplicitReqB = b.demand.demandId.startsWith("demand-") ? 1 : 0;
    if (isExplicitReqA !== isExplicitReqB) return isExplicitReqA - isExplicitReqB;
    if (a.index !== b.index) return a.index - b.index;
    return needA.currentBattery - needB.currentBattery;
  });

  return demandsWithIndex.map((item) => item.demand.demandId);
}

/**
 * UC13 bước 4 (private "–" trong class diagram):
 * Đề xuất phân bổ cổng, vị trí, thời gian và công suất sạc;
 * tôn trọng phiên đang chạy, lịch đã xác nhận, lượt giữ tạm và không dùng tài nguyên bị hạn chế do sự cố.
 */
function optimizeAllocation(chargingContext: ChargingContext, priorities: string[]): PlanDraft {
  const meta = currentPlanningMeta ?? {
    hubId: "",
    timeRange: { startTime: new Date(), endTime: new Date(Date.now() + 3600_000) },
    ruleId: "LOW_BATTERY_FIRST",
  };

  const portsWithSlots = meta.hubId ? listHubChargingPortsWithSlots(meta.hubId) : [];
  const restrictedIds = new Set(chargingContext.restrictedResources.map((r) => r.resourceId));

  // Tập các cổng hoặc vị trí đã có cam kết (phiên đang chạy, lịch CONFIRMED, lượt giữ tạm)
  const committedPortIds = committedChargingPortIds(chargingContext, portsWithSlots);
  const committedSlotIds = new Set(chargingContext.activeHolds.map((hold) => hold.positionId));

  const proposedAllocations: PlanAllocation[] = [];
  const servedRequests: string[] = [];
  const demandPortMap = new Map<string, string>();
  let remainingPowerKw = chargingContext.hubPowerCapacityKw;

  // 1. Giữ nguyên phân bổ cho các lịch đã xác nhận (CONFIRMED) hoặc phiên đang chạy (UC13 Ext 6b),
  // đồng thời đảm bảo tổng công suất phân bổ không vượt quá giới hạn công suất của Hub.
  const committedPorts = portsWithSlots.filter(
    ({ port, slot }) =>
      !restrictedIds.has(port.id) &&
      !restrictedIds.has(slot.id) &&
      committedPortIds.has(port.id),
  );
  const totalCommittedMaxKw = committedPorts.reduce((sum, { port }) => sum + port.maxPowerKw, 0);
  const committedScale =
    totalCommittedMaxKw > remainingPowerKw && totalCommittedMaxKw > 0
      ? remainingPowerKw / totalCommittedMaxKw
      : 1;

  for (const { port, slot } of committedPorts) {
    if (remainingPowerKw <= 0) break;
    const targetPower = Math.min(port.maxPowerKw, port.maxPowerKw * committedScale, remainingPowerKw);
    const allocatedPowerKw = Math.floor(targetPower * 10) / 10;
    if (allocatedPowerKw > 0) {
      proposedAllocations.push({
        portId: port.id,
        positionId: slot.id,
        timeRange: meta.timeRange,
        allocatedPowerKw,
      });
      remainingPowerKw = Math.max(0, Math.round((remainingPowerKw - allocatedPowerKw) * 10) / 10);
    }
  }

  // 2. Danh sách cổng sạc còn rảnh để phân bổ cho các nhu cầu theo thứ tự ưu tiên
  const freePorts = portsWithSlots.filter(
    ({ port, slot }) =>
      !restrictedIds.has(port.id) &&
      !restrictedIds.has(slot.id) &&
      !committedPortIds.has(port.id) &&
      !committedSlotIds.has(slot.id),
  );

  const demandsById = new Map(chargingContext.demands.map((demand) => [demand.demandId, demand]));
  for (const demandId of priorities) {
    if (freePorts.length === 0) break;
    if (remainingPowerKw < 1.5) break; // Không đủ công suất tối thiểu để cấp thêm cổng

    const demand = demandsById.get(demandId);
    if (!demand) continue;
    const portIndex = freePorts.findIndex(({ port }) =>
      !demand.connectorType || port.connectorType === demand.connectorType
    );
    if (portIndex === -1) continue;
    const candidate = freePorts[portIndex]!;
    // Chia công suất hợp lý: không vượt maxPowerKw của cổng và không vượt remainingPowerKw của Hub
    const remainingDemandsToServe = Math.min(
      freePorts.length,
      priorities.length - servedRequests.length,
    );
    const fairShareKw =
      remainingDemandsToServe > 1
        ? Math.max(2.0, remainingPowerKw / remainingDemandsToServe)
        : remainingPowerKw;
    const allocatedKw = Math.floor(Math.min(candidate.port.maxPowerKw, fairShareKw, remainingPowerKw) * 10) / 10;

    if (allocatedKw <= 0) break;

    proposedAllocations.push({
      demandId,
      portId: candidate.port.id,
      positionId: candidate.slot.id,
      timeRange: meta.timeRange,
      allocatedPowerKw: allocatedKw,
    });
    servedRequests.push(demandId);
    demandPortMap.set(demandId, candidate.port.id);
    remainingPowerKw = Math.max(0, Math.round((remainingPowerKw - allocatedKw) * 10) / 10);
    freePorts.splice(portIndex, 1);
  }

  const allDemandIds = chargingContext.demands.map((d) => d.demandId);
  const waitingRequests = allDemandIds.filter((id) => !servedRequests.includes(id));

  const draft: PlanDraft = {
    planDraftId: crypto.randomUUID(),
    servedRequests,
    waitingRequests,
    proposedAllocations,
  };

  savePlanDraft({
    draft,
    hubId: meta.hubId,
    timeRange: meta.timeRange,
    ruleId: meta.ruleId,
    baseVersion: meta.hubId ? getLatestScheduleVersionNumber(meta.hubId) : 0,
    demandPortMap,
    createdAt: new Date(),
  });

  return draft;
}

/**
 * UC13 Ext 4a (private "–" trong class diagram):
 * Đánh dấu các nhu cầu chưa được phân bổ vào danh sách chờ (waitingRequests), không tự hủy lịch đã xác nhận.
 */
function markWaitingRequests(proposedPlan: PlanDraft): void {
  const stored = getStoredPlanDraft(proposedPlan.planDraftId);
  if (!stored) return;
  const context = operationalRepository.queryChargingContext(stored.hubId, stored.timeRange);
  const servedSet = new Set(proposedPlan.servedRequests);
  proposedPlan.waitingRequests = context.demands
    .map((d) => d.demandId)
    .filter((id) => !servedSet.has(id));
}

/**
 * UC13 bước 5 (private "–" trong class diagram):
 * Áp dụng các điều chỉnh công suất / cổng sạc của Operator vào bản nháp kế hoạch.
 */
function applyAdjustments(planDraftId: string, adjustments: PlanAdjustment[]): StoredPlanDraft {
  const stored = getStoredPlanDraft(planDraftId);
  if (!stored) {
    throw new AppError("NOT_FOUND", "Không tìm thấy bản nháp kế hoạch sạc.");
  }

  const allocations = new Map(stored.draft.proposedAllocations.map((allocation) => [allocation.portId, allocation]));
  const demandPortMap = new Map(stored.demandPortMap);
  for (const adjustment of adjustments) {
    const current = allocations.get(adjustment.portId);
    const demandId = adjustment.demandId ?? current?.demandId;
    if (current && current.demandId !== demandId) {
      throw new AppError("CONFLICT", "Cổng sạc đã được gắn với nhu cầu khác hoặc cam kết hiện có.");
    }
    if (demandId) {
      const oldPortId = demandPortMap.get(demandId);
      if (oldPortId && oldPortId !== adjustment.portId) {
        allocations.delete(oldPortId);
      }
      demandPortMap.set(demandId, adjustment.portId);
    }
    allocations.set(adjustment.portId, { ...adjustment, demandId });
  }

  return {
    ...stored,
    demandPortMap,
    draft: {
      ...stored.draft,
      proposedAllocations: [...allocations.values()],
      servedRequests: [...demandPortMap.keys()],
      waitingRequests: stored.draft.waitingRequests.filter((id) => !demandPortMap.has(id)),
    },
  };
}
