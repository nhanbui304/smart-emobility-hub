// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC01.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import { VEHICLE_TYPES } from "../constants";
import type { SharedVehicle } from "../db/schema";
import { AppError } from "../lib/errors";
import { mobilityRepository, queryHubResourceAvailability } from "../repositories/MobilityRepository";
import type {
  MobilityContext,
  MobilityOption,
  OptionSelectionResult,
  SearchCriteria,
  SearchFormConfig,
  SearchResult,
} from "../types/dto";

const ALLOWED_PURPOSES = ["RENT_VEHICLE", "PARK", "CHARGE"] as const;
const SEARCH_SESSION_TTL_MS = 15 * 60_000;

interface SearchSession {
  criteria: SearchCriteria;
  offeredHubs: Map<string, string>;
  expiresAt: number;
  selection?: { optionId: string; selectedAt: Date };
}

const searchSessions = new Map<string, SearchSession>();

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

  async findSuitableOptions(criteria: SearchCriteria, sessionId: string): Promise<SearchResult> {
    await this.validateCriteria(criteria);
    const context = mobilityRepository.queryMobilityContext(criteria);
    if (!context.hubs || context.hubs.length === 0) {
      throw new AppError("NOT_FOUND", "Không tải được danh mục Hub khả dụng. Vui lòng thử lại.");
    }
    const originExists = context.hubs.some((h) => h.id === criteria.originHubId);
    if (!originExists) {
      throw new AppError("VALIDATION_ERROR", "Hub xuất phát không tồn tại trong hệ thống.");
    }

    const unverifiedFlags = [
      ...assessDataFreshness(context),
      ...markUnverifiedResources(context),
    ];

    const options = filterSuitableOptions(criteria, context);

    const now = Date.now();
    for (const [key, session] of searchSessions) {
      if (session.expiresAt <= now) searchSessions.delete(key);
    }
    searchSessions.set(sessionId, {
      criteria,
      offeredHubs: new Map(options.map((option) => [option.optionId, option.hubId])),
      expiresAt: now + SEARCH_SESSION_TTL_MS,
    });

    return {
      options,
      updatedAt: context.lastUpdatedAt,
      unverifiedFlags,
    };
  },

  async confirmOptionSelection(sessionId: string, optionId: string): Promise<OptionSelectionResult> {
    if (!sessionId.trim() || !optionId.trim()) {
      throw new AppError("VALIDATION_ERROR", "Thiếu thông tin phiên tìm kiếm hoặc phương án được chọn.");
    }

    const session = searchSessions.get(sessionId);
    if (!session || session.expiresAt <= Date.now()) {
      throw new AppError("CONFLICT", "Phiên tìm kiếm đã hết hiệu lực. Hãy tìm lại phương án.");
    }
    const offeredHubId = session.offeredHubs.get(optionId);
    if (!offeredHubId) {
      throw new AppError("VALIDATION_ERROR", "Phương án không thuộc kết quả tìm kiếm này.");
    }

    const lastCriteria = session.criteria;
    const isStillValid = await this.validateSelectedOption(optionId, lastCriteria);
    const context = mobilityRepository.queryMobilityContext(lastCriteria);
    const unverifiedFlags = [
      ...assessDataFreshness(context),
      ...markUnverifiedResources(context),
    ];
    const refreshedOptions = filterSuitableOptions(lastCriteria, context);
    session.offeredHubs = new Map(refreshedOptions.map((option) => [option.optionId, option.hubId]));

    const updatedResult: SearchResult = {
      options: refreshedOptions,
      updatedAt: context.lastUpdatedAt,
      unverifiedFlags,
    };

    const selectedOption = refreshedOptions.find((option) => option.optionId === optionId);
    if (!isStillValid || !selectedOption || selectedOption.hubId !== offeredHubId) {
      session.selection = undefined;
      return {
        optionChanged: true,
        nextActions: [],
        updatedResult,
      };
    }

    recordSessionSelection(sessionId, optionId);
    const nextActions = buildNextActions(lastCriteria.purpose, selectedOption.hubId, optionId);
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
    if (criteria.purpose === "RENT_VEHICLE" && state.currentBattery < criteria.minBattery) {
      return false;
    }
    return true;
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram UC01.drawio) ----------

function assessDataFreshness(context: MobilityContext): string[] {
  const flags: string[] = [];
  const nowMs = Date.now();
  const staleLimitMs = systemConfig.dataStaleSeconds * 1000;
  if (nowMs - context.lastUpdatedAt.getTime() > staleLimitMs) {
    flags.push("DATA_STALE");
  }
  return flags;
}

function markUnverifiedResources(context: MobilityContext): string[] {
  const flags: string[] = [];
  const nowMs = Date.now();
  const staleLimitMs = systemConfig.dataStaleSeconds * 1000;
  for (const hub of context.hubs) {
    if (nowMs - hub.lastUpdatedAt.getTime() > staleLimitMs) {
      flags.push(`HUB_STALE:${hub.id}`);
    }
  }
  for (const vehicle of context.vehicles) {
    if (!vehicle.hubId || nowMs - vehicle.lastUpdatedAt.getTime() > staleLimitMs) {
      flags.push(`VEHICLE_UNVERIFIED:${vehicle.id}`);
    }
  }
  return flags;
}

function filterSuitableOptions(criteria: SearchCriteria, ctx: MobilityContext): MobilityOption[] {
  const hubIndexMap = new Map<string, number>();
  ctx.hubs.forEach((h, idx) => hubIndexMap.set(h.id, idx));
  const originIndex = hubIndexMap.get(criteria.originHubId) ?? 0;

  // Mục đích PARK hoặc CHARGE: lọc các Hub còn vị trí đỗ trống hoặc còn cổng sạc rảnh thực tế
  if (criteria.purpose === "PARK" || criteria.purpose === "CHARGE") {
    const availMap = queryHubResourceAvailability();
    const isPark = criteria.purpose === "PARK";
    const options: MobilityOption[] = [];

    for (const hub of ctx.hubs) {
      const avail = availMap.get(hub.id);
      if (!avail) continue;
      const freeCount = isPark ? avail.freeSlots : avail.freeChargingPorts;
      if (freeCount <= 0) continue;

      const hubIdx = hubIndexMap.get(hub.id) ?? originIndex;
      const estimatedDistance = hub.id === criteria.originHubId ? 0 : Math.abs(hubIdx - originIndex) * 0.8 + 0.5;
      const optionId = `${isPark ? "park" : "charge"}:${hub.id}`;
      const summaryVehicle: SharedVehicle = {
        id: optionId,
        code: isPark ? `Còn ${freeCount} chỗ đỗ` : `Còn ${freeCount} cổng sạc`,
        type: criteria.vehicleType,
        batteryLevel: 100,
        status: "AVAILABLE",
        hubId: hub.id,
        slotId: null,
        lastUpdatedAt: hub.lastUpdatedAt,
        createdAt: hub.createdAt,
        updatedAt: hub.createdAt,
      };
      options.push({
        optionId,
        hubId: hub.id,
        vehicle: summaryVehicle,
        estimatedDistance: Number(estimatedDistance.toFixed(1)),
      });
    }

    return options.sort((a, b) => a.estimatedDistance - b.estimatedDistance);
  }

  // Mục đích RENT_VEHICLE: lọc xe dùng chung AVAILABLE đạt mức pin tối thiểu
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
  const session = searchSessions.get(sessionId);
  if (session) session.selection = { optionId, selectedAt: new Date() };
}

function buildNextActions(purpose: string, hubId: string, optionId: string): string[] {
  if (purpose === "PARK") {
    return [`/student/my-vehicle?hubId=${hubId}`];
  }
  if (purpose === "CHARGE") {
    return [`/student/charging-request?hubId=${hubId}`];
  }
  return [`/student/hubs/${hubId}/reserve?vehicleId=${optionId}`];
}
