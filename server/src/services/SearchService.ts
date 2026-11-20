import { systemConfig } from "../config/systemConfig";
import { VEHICLE_TYPES } from "../constants";
import { AppError } from "../lib/errors";
import { mobilityRepository } from "../repositories/MobilityRepository";
import type {
  MobilityContext,
  MobilityOption,
  OptionSelectionResult,
  SearchCriteria,
  SearchFormConfig,
  SearchResult,
} from "../types/dto";

const ALLOWED_PURPOSES = ["RENT_VEHICLE", "PARK", "CHARGE"] as const;
const sessionSelections = new Map<string, { optionId: string; criteria: SearchCriteria; selectedAt: Date }>();
const sessionCriteria = new Map<string, SearchCriteria>();
let currentUnverifiedFlags: string[] = [];

export const searchService = {
  async loadSearchForm(): Promise<SearchFormConfig> {
    const ctx = mobilityRepository.queryMobilityContext({
      purpose: "RENT_VEHICLE",
      originHubId: "",
      vehicleType: VEHICLE_TYPES[0],
      minBattery: 0,
    });
    return {
      defaultHubId: ctx.hubs[0]?.id ?? "",
      availableVehicleTypes: [...VEHICLE_TYPES],
    };
  },

  async findSuitableOptions(criteria: SearchCriteria): Promise<SearchResult> {
    await this.validateCriteria(criteria);
    const context = mobilityRepository.queryMobilityContext(criteria);
    if (!context.hubs || context.hubs.length === 0) {
      throw new AppError("NOT_FOUND", "Không tải được danh mục Hub khả dụng. Vui lòng thử lại.");
    }
    const originExists = context.hubs.some((h) => h.id === criteria.originHubId);
    if (!originExists) {
      throw new AppError("VALIDATION_ERROR", "Hub xuất phát không tồn tại trong hệ thống.");
    }

    currentUnverifiedFlags = [];
    assessDataFreshness(context);
    markUnverifiedResources(context);

    const options = filterSuitableOptions(criteria, context);
    return {
      options,
      updatedAt: context.lastUpdatedAt,
      unverifiedFlags: [...currentUnverifiedFlags],
    };
  },

  async confirmOptionSelection(sessionId: string, optionId: string): Promise<OptionSelectionResult> {
    if (!sessionId.trim() || !optionId.trim()) {
      throw new AppError("VALIDATION_ERROR", "Thiếu thông tin phiên tìm kiếm hoặc phương án được chọn.");
    }

    const lastCriteria = sessionCriteria.get(sessionId) ?? {
      purpose: "RENT_VEHICLE",
      originHubId: "",
      vehicleType: VEHICLE_TYPES[0],
      minBattery: 0,
    };

    const isStillValid = await this.validateSelectedOption(optionId, lastCriteria);
    const context = mobilityRepository.queryMobilityContext(lastCriteria);
    currentUnverifiedFlags = [];
    assessDataFreshness(context);
    markUnverifiedResources(context);
    const refreshedOptions = filterSuitableOptions(lastCriteria, context);
    const updatedResult: SearchResult = {
      options: refreshedOptions,
      updatedAt: context.lastUpdatedAt,
      unverifiedFlags: [...currentUnverifiedFlags],
    };

    if (!isStillValid) {
      return {
        optionChanged: true,
        nextActions: [],
        updatedResult,
      };
    }

    recordSessionSelection(sessionId, optionId);
    const selectedOption = refreshedOptions.find((o) => o.optionId === optionId);
    const targetHubId = selectedOption?.hubId ?? lastCriteria.originHubId;

    const nextActions = buildNextActions(lastCriteria.purpose, targetHubId, optionId);
    return {
      optionChanged: false,
      nextActions,
      updatedResult,
    };
  },

  async validateCriteria(criteria: SearchCriteria): Promise<boolean> {
    if (!criteria.purpose || !ALLOWED_PURPOSES.includes(criteria.purpose as (typeof ALLOWED_PURPOSES)[number])) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng chọn mục đích sử dụng hợp lệ.");
    }
    if (!criteria.originHubId || !criteria.originHubId.trim()) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng chọn Hub xuất phát.");
    }
    if (!VEHICLE_TYPES.includes(criteria.vehicleType)) {
      throw new AppError("VALIDATION_ERROR", "Loại phương tiện không hợp lệ.");
    }
    if (!Number.isInteger(criteria.minBattery) || criteria.minBattery < 0 || criteria.minBattery > 100) {
      throw new AppError("VALIDATION_ERROR", "Mức pin tối thiểu phải là số nguyên từ 0 đến 100%.");
    }
    return true;
  },

  async validateSelectedOption(optionId: string, criteria: SearchCriteria): Promise<boolean> {
    const state = mobilityRepository.queryCurrentOptionState(optionId);
    if (!state.isAvailable) {
      return false;
    }
    if (state.currentBattery < criteria.minBattery) {
      return false;
    }
    return true;
  },
};

function assessDataFreshness(context: MobilityContext): void {
  const nowMs = Date.now();
  const staleLimitMs = systemConfig.dataStaleSeconds * 1000;
  if (nowMs - context.lastUpdatedAt.getTime() > staleLimitMs) {
    currentUnverifiedFlags.push("DATA_STALE");
  }
}

function markUnverifiedResources(context: MobilityContext): void {
  const nowMs = Date.now();
  const staleLimitMs = systemConfig.dataStaleSeconds * 1000;
  for (const hub of context.hubs) {
    if (nowMs - hub.lastUpdatedAt.getTime() > staleLimitMs) {
      currentUnverifiedFlags.push(`HUB_STALE:${hub.id}`);
    }
  }
  for (const vehicle of context.vehicles) {
    if (!vehicle.hubId || nowMs - vehicle.lastUpdatedAt.getTime() > staleLimitMs) {
      currentUnverifiedFlags.push(`VEHICLE_UNVERIFIED:${vehicle.id}`);
    }
  }
}

function filterSuitableOptions(criteria: SearchCriteria, ctx: MobilityContext): MobilityOption[] {
  if (criteria.originHubId) {
    sessionCriteria.set("default", criteria);
  }
  const hubIndexMap = new Map<string, number>();
  ctx.hubs.forEach((h, idx) => hubIndexMap.set(h.id, idx));
  const originIndex = hubIndexMap.get(criteria.originHubId) ?? 0;

  return ctx.vehicles
    .filter((v) => v.hubId !== null && v.status === "AVAILABLE" && v.batteryLevel >= criteria.minBattery)
    .map((v) => {
      const hubId = v.hubId as string;
      const hubIdx = hubIndexMap.get(hubId) ?? originIndex;
      const estimatedDistance = hubId === criteria.originHubId ? 0 : Math.abs(hubIdx - originIndex) * 0.8 + 0.5;
      return {
        optionId: v.id,
        hubId,
        vehicle: v,
        estimatedDistance: Number(estimatedDistance.toFixed(1)),
      };
    })
    .sort((a, b) => {
      if (a.estimatedDistance !== b.estimatedDistance) {
        return a.estimatedDistance - b.estimatedDistance;
      }
      return b.vehicle.batteryLevel - a.vehicle.batteryLevel;
    });
}

function recordSessionSelection(sessionId: string, optionId: string): void {
  const existingCriteria = sessionCriteria.get(sessionId) ?? sessionCriteria.get("default") ?? {
    purpose: "RENT_VEHICLE",
    originHubId: "",
    vehicleType: VEHICLE_TYPES[0],
    minBattery: 0,
  };
  sessionSelections.set(sessionId, {
    optionId,
    criteria: existingCriteria,
    selectedAt: new Date(),
  });
}

function buildNextActions(purpose: string, hubId: string, optionId: string): string[] {
  if (purpose === "PARK") {
    return [`/student/hubs/${hubId}/parking`];
  }
  if (purpose === "CHARGE") {
    return [`/student/charging?hubId=${hubId}&vehicleId=${optionId}`];
  }
  return [`/student/hubs/${hubId}/reserve?vehicleId=${optionId}`];
}