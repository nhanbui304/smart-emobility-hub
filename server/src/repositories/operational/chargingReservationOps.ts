// Owner: Ngô Minh Triết – UC08 Schedule Charging Session (queryAvailableChargingSlots dùng chung với UC09)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC08.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, inArray } from "drizzle-orm";
import { systemConfig } from "../../config/systemConfig";
import {
  chargingPorts,
  chargingRequests,
  chargingReservations,
  chargingSessions,
  hubs,
  incidents,
  parkingAllocations,
  parkingSlots,
  privateVehicles,
  processedRequests,
  type ChargingPort,
  type ChargingReservation,
  type ParkingSlot,
  type ProcessedRequest,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type { TimeRange } from "../../lib/schemas";
import type {
  ChargingNeed,
  ChargingSlotOption,
  CreateResult,
  SlotQueryResult,
} from "../../types/dto";
import { commonOps } from "./common";

const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"] as const;
/** Hệ số giới hạn công suất cung cấp điện của Hub (đồng bộ với UC09 & UC13). */
const HUB_POWER_SAFETY_FACTOR = 0.85;

export interface StoredSlotOptionEntry {
  option: ChargingSlotOption;
  studentId: string;
  vehicleId: string;
  chargingNeed: ChargingNeed;
  expiresAt: Date;
}

const slotOptionStore = new Map<string, StoredSlotOptionEntry>();

function getOptionTtlMs(): number {
  return systemConfig.parkingHoldMinutes * 60 * 1000;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function purgeExpiredSlotOptions(now: Date): void {
  const nowMs = now.getTime();
  for (const [id, entry] of slotOptionStore.entries()) {
    if (entry.expiresAt.getTime() <= nowMs) {
      slotOptionStore.delete(id);
    }
  }
}

/** Gọi commonOps.findProcessedRequest (trên main đã cài đặt), dự phòng SELECT trực tiếp khi chạy độc lập trên nhánh chưa merge main. */
function findProcessedRequestSafe(requestId: string): ProcessedRequest | undefined {
  try {
    return commonOps.findProcessedRequest(requestId);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_IMPLEMENTED") {
      return db
        .select()
        .from(processedRequests)
        .where(eq(processedRequests.requestId, requestId))
        .get();
    }
    throw err;
  }
}

function getRestrictedResourceIds(): Set<string> {
  const openIncidents = db
    .select({ resourceId: incidents.resourceId })
    .from(incidents)
    .where(inArray(incidents.status, ["OPEN", "IN_PROGRESS"]))
    .all();
  return new Set(openIncidents.map((i) => i.resourceId));
}

function computeHubPowerBudget(
  hubPorts: ChargingPort[],
  timeRange: TimeRange,
  excludeReservationId?: string,
): { activePowerKw: number; powerLimitKw: number } {
  const allHubPortIds = hubPorts.map((p) => p.id);
  const activePowerKw =
    allHubPortIds.length === 0
      ? 0
      : db
          .select()
          .from(chargingReservations)
          .where(
            and(
              inArray(chargingReservations.portId, allHubPortIds),
              inArray(chargingReservations.status, [...ACTIVE_RESERVATION_STATUSES]),
            ),
          )
          .all()
          .filter(
            (r) =>
              r.id !== excludeReservationId &&
              rangesOverlap(r.startTime, r.endTime, timeRange.startTime, timeRange.endTime),
          )
          .reduce((sum, r) => {
            const p = hubPorts.find((hp) => hp.id === r.portId);
            return sum + (p?.maxPowerKw ?? 0);
          }, 0);

  const activePorts = hubPorts.filter((p) => p.status !== "OUT_OF_SERVICE");
  const totalActivePortPowerKw = activePorts.reduce((sum, p) => sum + p.maxPowerKw, 0);
  const maxSinglePortKw = activePorts.reduce((max, p) => Math.max(max, p.maxPowerKw), 0);
  const powerLimitKw = Math.max(
    maxSinglePortKw,
    Math.round(totalActivePortPowerKw * HUB_POWER_SAFETY_FACTOR * 100) / 100,
  );

  return { activePowerKw, powerLimitKw };
}

function isPortAvailableForWindow(
  port: ChargingPort,
  slot: ParkingSlot,
  timeRange: TimeRange,
  now: Date,
  restrictedIds: Set<string>,
  excludeReservationId?: string,
): boolean {
  if (slot.status !== "IN_SERVICE") return false;
  if (port.status === "OUT_OF_SERVICE") return false;
  if (restrictedIds.has(port.id) || restrictedIds.has(slot.id) || restrictedIds.has(slot.hubId)) {
    return false;
  }

  const portReservations = db
    .select()
    .from(chargingReservations)
    .where(
      and(
        eq(chargingReservations.portId, port.id),
        inArray(chargingReservations.status, [...ACTIVE_RESERVATION_STATUSES]),
      ),
    )
    .all();
  for (const r of portReservations) {
    if (excludeReservationId && r.id === excludeReservationId) continue;
    if (rangesOverlap(r.startTime, r.endTime, timeRange.startTime, timeRange.endTime)) {
      return false;
    }
  }

  const slotAllocations = db
    .select()
    .from(parkingAllocations)
    .where(
      and(
        eq(parkingAllocations.slotId, slot.id),
        inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
      ),
    )
    .all();
  for (const alloc of slotAllocations) {
    if (alloc.status === "HELD" && alloc.holdExpiresAt && alloc.holdExpiresAt.getTime() <= now.getTime()) {
      continue;
    }
    if (rangesOverlap(alloc.startTime, alloc.endTime, timeRange.startTime, timeRange.endTime)) {
      return false;
    }
  }

  if (timeRange.startTime.getTime() <= now.getTime()) {
    const activeSession = db
      .select({ id: chargingSessions.id })
      .from(chargingSessions)
      .where(and(eq(chargingSessions.portId, port.id), eq(chargingSessions.status, "ACTIVE")))
      .get();
    if (activeSession) return false;
  }

  return true;
}

/** UC08 Ext 4d: Kiểm tra xe cá nhân có yêu cầu sạc ngay (charging_requests) đang hoạt động trùng khung giờ sát hiện tại hay không. */
export function hasConflictingImmediateChargingRequest(
  vehicleId: string,
  timeRange: TimeRange,
  now: Date,
): boolean {
  const immediateEnd = new Date(now.getTime() + 60 * 60_000);
  if (!rangesOverlap(timeRange.startTime, timeRange.endTime, now, immediateEnd)) {
    return false;
  }
  const activeReq = db
    .select({ id: chargingRequests.id })
    .from(chargingRequests)
    .where(
      and(
        eq(chargingRequests.vehicleId, vehicleId),
        inArray(chargingRequests.status, ["WAITING", "ALLOCATED", "CHARGING"]),
      ),
    )
    .get();
  return Boolean(activeReq);
}

export function getStoredSlotOptionEntry(
  slotOptionId: string,
  studentId: string,
): StoredSlotOptionEntry | undefined {
  purgeExpiredSlotOptions(new Date());
  const entry = slotOptionStore.get(slotOptionId);
  if (!entry || entry.studentId !== studentId) return undefined;
  return entry;
}

/** Nếu requestId đã được xử lý trước đó cho UC08 của đúng sinh viên, trả lại kết quả đã tạo (chống gửi lặp Ext 8d). */
export function findProcessedReservationCreateResult(
  requestId: string,
  studentId: string,
): CreateResult | undefined {
  const existingReq = findProcessedRequestSafe(requestId);
  if (!existingReq) return undefined;
  if (existingReq.actorId !== studentId || existingReq.operation !== "CONFIRM_CHARGING_RESERVATION") {
    throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
  }
  const saved = db
    .select()
    .from(chargingReservations)
    .where(eq(chargingReservations.id, existingReq.resultId))
    .get();
  if (!saved) {
    throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc đã xử lý trước đó.");
  }
  const savedHubRow = db
    .select({ hubId: parkingSlots.hubId })
    .from(chargingPorts)
    .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
    .where(eq(chargingPorts.id, saved.portId))
    .get();
  return {
    reservationId: saved.id,
    hubId: savedHubRow?.hubId ?? "",
    portId: saved.portId,
    timeRange: { startTime: saved.startTime, endTime: saved.endTime },
    status: saved.status,
    usageGuide: buildReservationUsageGuide(saved.portId, saved.startTime, saved.endTime),
  };
}

export function findAlternativeHubSuggestions(
  excludeHubId: string,
  vehicleId: string,
  timeRange: TimeRange,
  now: Date,
): Array<{ hubId: string; hubName: string; availablePorts: number }> {
  const vehicle = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
  if (!vehicle) return [];

  const allHubs = db.select().from(hubs).all().filter((h) => h.id !== excludeHubId);
  const restrictedIds = getRestrictedResourceIds();
  const suggestions: Array<{ hubId: string; hubName: string; availablePorts: number }> = [];

  for (const hub of allHubs) {
    const hubSlots = db
      .select()
      .from(parkingSlots)
      .where(and(eq(parkingSlots.hubId, hub.id), eq(parkingSlots.hasCharger, true)))
      .all();
    if (hubSlots.length === 0) continue;

    const slotById = new Map(hubSlots.map((s) => [s.id, s]));
    const hubPorts = db
      .select()
      .from(chargingPorts)
      .where(inArray(chargingPorts.slotId, [...slotById.keys()]))
      .all();
    const { activePowerKw, powerLimitKw } = computeHubPowerBudget(hubPorts, timeRange);

    const count = hubPorts.filter((port) => {
      if (port.connectorType !== vehicle.connectorType) return false;
      const slot = slotById.get(port.slotId);
      if (!slot) return false;
      if (!isPortAvailableForWindow(port, slot, timeRange, now, restrictedIds)) return false;
      return activePowerKw + port.maxPowerKw <= powerLimitKw;
    }).length;

    if (count > 0) {
      suggestions.push({ hubId: hub.id, hubName: hub.name, availablePorts: count });
    }
  }

  return suggestions;
}

function formatDateTimeVi(date: Date): string {
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildReservationUsageGuide(portId: string, startTime: Date, endTime: Date): string {
  const row = db
    .select({ slotCode: parkingSlots.code, hubName: hubs.name })
    .from(chargingPorts)
    .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
    .innerJoin(hubs, eq(parkingSlots.hubId, hubs.id))
    .where(eq(chargingPorts.id, portId))
    .get();
  const label = row ? `${row.hubName} (vị trí ${row.slotCode})` : `cổng ${portId}`;
  return `Lịch sạc đã được xác nhận tại ${label}. Vui lòng đưa xe đến trước ${formatDateTimeVi(startTime)} và hoàn tất sạc trước ${formatDateTimeVi(endTime)}.`;
}

export const chargingReservationOps = {
  /** Kiểm tra Hub có tồn tại và có cổng sạc hoạt động tương thích đầu cắm với xe cá nhân không. */
  queryHubChargingSupport(hubId: string, vehicleId: string): boolean {
    const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
    if (!hub) return false;

    const vehicle = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
    if (!vehicle) return false;

    const hubSlots = db
      .select()
      .from(parkingSlots)
      .where(
        and(
          eq(parkingSlots.hubId, hubId),
          eq(parkingSlots.hasCharger, true),
          eq(parkingSlots.status, "IN_SERVICE"),
        ),
      )
      .all();
    if (hubSlots.length === 0) return false;

    const ports = db
      .select()
      .from(chargingPorts)
      .where(inArray(chargingPorts.slotId, hubSlots.map((s) => s.id)))
      .all();

    return ports.some((p) => p.connectorType === vehicle.connectorType && p.status !== "OUT_OF_SERVICE");
  },

  /** Tìm các lịch sạc đang hiệu lực của xe cá nhân bị chồng lấn với khung giờ yêu cầu. */
  findConflictingRequestsOrSchedules(
    studentId: string,
    vehicleId: string,
    _date: Date,
    timeRange: TimeRange,
  ): ChargingReservation[] {
    return db
      .select()
      .from(chargingReservations)
      .where(
        and(
          eq(chargingReservations.privateVehicleId, vehicleId),
          inArray(chargingReservations.status, [...ACTIVE_RESERVATION_STATUSES]),
        ),
      )
      .all()
      .filter(
        (r) =>
          (r.studentId === studentId || r.privateVehicleId === vehicleId) &&
          rangesOverlap(r.startTime, r.endTime, timeRange.startTime, timeRange.endTime),
      );
  },

  /**
   * UC08 bước 5 / UC09 bước 7 (dùng chung): Tìm các cổng sạc khả dụng tại Hub cho khung giờ yêu cầu.
   * Hỗ trợ tham số cuối optional excludeReservationId để UC09 bỏ qua chính lịch đang sửa.
   */
  queryAvailableChargingSlots(
    hubId: string,
    vehicleId: string,
    _date: Date,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
    now: Date,
    excludeReservationId?: string,
  ): SlotQueryResult {
    purgeExpiredSlotOptions(now);

    const vehicle = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
    if (!vehicle) {
      return { options: [], verified: true, slots: [] };
    }

    const vehicleConflicts = db
      .select()
      .from(chargingReservations)
      .where(
        and(
          eq(chargingReservations.privateVehicleId, vehicleId),
          inArray(chargingReservations.status, [...ACTIVE_RESERVATION_STATUSES]),
        ),
      )
      .all()
      .some(
        (r) =>
          r.id !== excludeReservationId &&
          rangesOverlap(r.startTime, r.endTime, timeRange.startTime, timeRange.endTime),
      );
    if (vehicleConflicts) {
      return { options: [], verified: true, slots: [] };
    }

    const hubSlots = db
      .select()
      .from(parkingSlots)
      .where(and(eq(parkingSlots.hubId, hubId), eq(parkingSlots.hasCharger, true)))
      .all();
    if (hubSlots.length === 0) {
      return { options: [], verified: true, slots: [] };
    }

    const slotById = new Map(hubSlots.map((s) => [s.id, s]));
    const hubPorts = db
      .select()
      .from(chargingPorts)
      .where(inArray(chargingPorts.slotId, [...slotById.keys()]))
      .all();

    const restrictedIds = getRestrictedResourceIds();
    const { activePowerKw, powerLimitKw } = computeHubPowerBudget(hubPorts, timeRange, excludeReservationId);

    const options: ChargingSlotOption[] = [];
    const availableSlots: ParkingSlot[] = [];
    const expiresAt = new Date(now.getTime() + getOptionTtlMs());

    for (const port of hubPorts) {
      if (port.connectorType !== vehicle.connectorType) continue;
      const slot = slotById.get(port.slotId);
      if (!slot) continue;
      if (!isPortAvailableForWindow(port, slot, timeRange, now, restrictedIds, excludeReservationId)) {
        continue;
      }
      if (activePowerKw + port.maxPowerKw > powerLimitKw) {
        continue;
      }

      const option: ChargingSlotOption = {
        slotOptionId: crypto.randomUUID(),
        portId: port.id,
        hubId,
        startTime: new Date(timeRange.startTime),
        endTime: new Date(timeRange.endTime),
        maxPowerKw: port.maxPowerKw,
      };

      slotOptionStore.set(option.slotOptionId, {
        option,
        studentId: vehicle.ownerId,
        vehicleId,
        chargingNeed: { ...chargingNeed },
        expiresAt,
      });

      options.push(option);
      availableSlots.push(slot);
    }

    return { options, verified: true, slots: availableSlots };
  },

  /** UC08 bước 7 / UC09 bước 10 (findSlotOption): phương án còn hạn và thuộc đúng sinh viên. */
  findSlotOption(slotOptionId: string, studentId: string): ChargingSlotOption | undefined {
    return getStoredSlotOptionEntry(slotOptionId, studentId)?.option;
  },

  /**
   * UC08 bước 8 – trong db.transaction: requestId đã có trong processed_requests → trả lịch cũ;
   * kiểm tra lại quyền, xung đột, cổng còn trống và không bị hạn chế; tạo lịch CONFIRMED (version = 1);
   * ghi processed_requests (operation = CONFIRM_CHARGING_RESERVATION). Không tạo thêm dòng bên parking_allocations.
   */
  atomicCreateReservation(
    requestId: string,
    studentId: string,
    vehicleId: string,
    hubId: string,
    portId: string,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
  ): CreateResult {
    const now = new Date();
    purgeExpiredSlotOptions(now);

    return db.transaction(() => {
      // 1. Chống gửi lặp requestId (UC08 Ext 8d)
      const existingReq = findProcessedRequestSafe(requestId);
      if (existingReq) {
        if (existingReq.actorId !== studentId || existingReq.operation !== "CONFIRM_CHARGING_RESERVATION") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        const saved = db
          .select()
          .from(chargingReservations)
          .where(eq(chargingReservations.id, existingReq.resultId))
          .get();
        if (!saved) {
          throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc đã xử lý trước đó.");
        }
        const savedHubRow = db
          .select({ hubId: parkingSlots.hubId })
          .from(chargingPorts)
          .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
          .where(eq(chargingPorts.id, saved.portId))
          .get();
        return {
          reservationId: saved.id,
          hubId: savedHubRow?.hubId ?? hubId,
          portId: saved.portId,
          timeRange: { startTime: saved.startTime, endTime: saved.endTime },
          status: saved.status,
          usageGuide: buildReservationUsageGuide(saved.portId, saved.startTime, saved.endTime),
        };
      }

      // 2. Xác minh quyền sở hữu xe cá nhân
      const vehicle = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
      if (!vehicle) {
        throw new AppError("NOT_FOUND", "Không tìm thấy thông tin xe cá nhân.");
      }
      if (vehicle.ownerId !== studentId) {
        throw new AppError("FORBIDDEN", "Bạn không có quyền đặt lịch sạc cho xe của sinh viên khác.");
      }

      // 3. Kiểm tra lại khung giờ, cổng sạc, sự cố UC11, xung đột xe và giới hạn công suất Hub
      if (timeRange.startTime.getTime() <= now.getTime()) {
        throw new AppError("CONFLICT", "Khung giờ sạc đã qua thời điểm hiện tại. Vui lòng chọn khung giờ mới.");
      }

      const targetPort = db.select().from(chargingPorts).where(eq(chargingPorts.id, portId)).get();
      const targetSlot = targetPort
        ? db.select().from(parkingSlots).where(eq(parkingSlots.id, targetPort.slotId)).get()
        : undefined;
      if (!targetPort || !targetSlot || targetSlot.hubId !== hubId) {
        throw new AppError("CONFLICT", "Cổng sạc đã chọn không tồn tại tại Hub này.");
      }
      if (targetPort.connectorType !== vehicle.connectorType) {
        throw new AppError("CONFLICT", "Đầu sạc của cổng không tương thích với xe cá nhân của bạn.");
      }

      const restrictedIds = getRestrictedResourceIds();
      const hasVehicleConflict =
        this.findConflictingRequestsOrSchedules(studentId, vehicleId, timeRange.startTime, timeRange).length > 0 ||
        hasConflictingImmediateChargingRequest(vehicleId, timeRange, now);
      if (hasVehicleConflict) {
        throw new AppError("CONFLICT", "Xe của bạn đã có yêu cầu sạc hoặc lịch sạc khác trùng khung giờ này.");
      }

      const hubSlots = db
        .select()
        .from(parkingSlots)
        .where(and(eq(parkingSlots.hubId, hubId), eq(parkingSlots.hasCharger, true)))
        .all();
      const hubPorts =
        hubSlots.length === 0
          ? []
          : db
              .select()
              .from(chargingPorts)
              .where(inArray(chargingPorts.slotId, hubSlots.map((s) => s.id)))
              .all();
      const { activePowerKw, powerLimitKw } = computeHubPowerBudget(hubPorts, timeRange);

      const portAvailable =
        isPortAvailableForWindow(targetPort, targetSlot, timeRange, now, restrictedIds) &&
        activePowerKw + targetPort.maxPowerKw <= powerLimitKw;
      if (!portAvailable) {
        throw new AppError(
          "CONFLICT",
          "Cổng sạc vừa có người đặt trước, vượt giới hạn công suất Hub hoặc bị hạn chế do sự cố. Vui lòng tìm lại phương án khác.",
        );
      }

      // 4. Tạo lịch sạc CONFIRMED (version = 1) và ghi processed_requests trong cùng transaction
      const inserted = db
        .insert(chargingReservations)
        .values({
          studentId,
          privateVehicleId: vehicleId,
          portId,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          currentBattery: chargingNeed.currentBattery,
          targetBattery: chargingNeed.targetBattery,
          status: "CONFIRMED",
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get()!;

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: studentId,
          operation: "CONFIRM_CHARGING_RESERVATION",
          resultId: inserted.id,
          createdAt: now,
        })
        .run();

      // Xóa mọi slotOption trùng cổng+khung giờ vừa được sử dụng
      for (const [optId, entry] of slotOptionStore.entries()) {
        if (entry.studentId === studentId && entry.option.portId === portId) {
          slotOptionStore.delete(optId);
        }
      }

      return {
        reservationId: inserted.id,
        hubId,
        portId: inserted.portId,
        timeRange: { startTime: inserted.startTime, endTime: inserted.endTime },
        status: inserted.status,
        usageGuide: buildReservationUsageGuide(inserted.portId, inserted.startTime, inserted.endTime),
      };
    });
  },
};
