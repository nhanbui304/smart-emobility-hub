// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC07.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq, exists, gt, inArray, isNull, lte, notExists, or } from "drizzle-orm";
import { systemConfig } from "../../config/systemConfig";
import {
  chargingPorts,
  chargingRequests,
  chargingReservations,
  chargingSessions,
  hubs,
  incidents,
  parkingSlots,
  privateVehicles,
  sharedVehicles,
  trips,
  type ChargingRequest,
  type PrivateVehicle,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type {
  CancelChargingResult,
  ChargingNeed,
  ChargingProposal,
  ChargingRequestResult,
} from "../../types/dto";

import { getChargingAvailability, isChargingPortAvailable } from "./chargingAvailability";

const ACTIVE_REQUEST_STATUSES = ["WAITING", "ALLOCATED", "CHARGING"] as const;
const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"] as const;
/** Chống gửi lặp theo requestId cho thao tác gửi/hủy yêu cầu sạc (UC07). */
const processedChargingOps = new Map<
  string,
  { actorId: string; kind: "SUBMIT" | "CANCEL"; chargingRequestId: string }
>();

/**
 * Lưu phương án mới nhất đã hiển thị cho sinh viên ở bước prepareChargingRequest (UC07 bước 5–6)
 * để phát hiện nhánh Ext 7a: nếu trước đó báo cấp cổng ngay mà lúc xác nhận đã hết cổng thì
 * không tự đổi sang hàng chờ khi chưa được sinh viên đồng ý lại.
 */
const preparedAllocationCache = new Map<string, { canAllocateNow: boolean; preparedAt: Date }>();

function proposalCacheKey(studentId: string, hubId: string, vehicleId: string): string {
  return `${studentId}:${hubId}:${vehicleId}`;
}

export function recordPreparedChargingProposal(
  studentId: string,
  hubId: string,
  vehicleId: string,
  proposal: ChargingProposal,
  now: Date = new Date(),
): void {
  preparedAllocationCache.set(proposalCacheKey(studentId, hubId, vehicleId), {
    canAllocateNow: proposal.canAllocateNow,
    preparedAt: now,
  });
}

/** UC07 Ext 4d: Kiểm tra phương tiện có lịch sạc (charging_reservations) đang hiệu lực trùng thời điểm hiện tại hay không. */
export function hasConflictingActiveChargingReservation(vehicleId: string, now: Date): boolean {
  const windowEnd = new Date(now.getTime() + systemConfig.immediateChargingWindowMinutes * 60_000);
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
    .some((r) => rangesOverlap(r.startTime, r.endTime, now, windowEnd));
}

function activeSessionForRequest() {
  return db.select({ id: chargingSessions.id }).from(chargingSessions).where(and(
    eq(chargingSessions.chargingRequestId, chargingRequests.id),
    eq(chargingSessions.status, "ACTIVE"),
  ));
}

function findUnfinishedChargingRequests(vehicleId: string, now: Date): ChargingRequest[] {
  return db.select().from(chargingRequests).where(and(
    eq(chargingRequests.vehicleId, vehicleId),
    or(
      inArray(chargingRequests.status, ["WAITING", "CHARGING"]),
      and(
        eq(chargingRequests.status, "ALLOCATED"),
        or(isNull(chargingRequests.allocationDeadline), gt(chargingRequests.allocationDeadline, now)),
      ),
      exists(activeSessionForRequest()),
    ),
  )).all();
}

export function hasUnfinishedCharging(vehicleId: string, now: Date): boolean {
  return findUnfinishedChargingRequests(vehicleId, now).length > 0;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function getRestrictedResourceIds(): Set<string> {
  const openIncidents = db
    .select({ resourceId: incidents.resourceId })
    .from(incidents)
    .where(inArray(incidents.status, ["OPEN", "IN_PROGRESS"]))
    .all();
  return new Set(openIncidents.map((i) => i.resourceId));
}

function buildUsageGuide(
  hubName: string,
  status: ChargingRequest["status"],
  slotCode?: string,
  deadline?: Date | null,
  queuePosition?: number,
): string {
  if (status === "EXPIRED") return "Đã hết hạn nhận cổng sạc. Bạn có thể gửi yêu cầu mới.";
  if (status === "ALLOCATED" && slotCode) {
    const deadlineText = deadline
      ? deadline.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      : "";
    return `Đã phân bổ cổng sạc tại ${hubName} (vị trí ${slotCode}). Vui lòng đưa xe vào và bắt đầu cắm sạc trước ${deadlineText}.`;
  }
  const posText = queuePosition ? ` (vị trí dự kiến #${queuePosition} trong hàng đợi)` : "";
  return `Hiện chưa có cổng sạc phù hợp trống tại ${hubName}. Yêu cầu đã vào hàng đợi chờ điều phối${posText}.`;
}

export function getStudentChargingContext(studentId: string): {
  vehicles: PrivateVehicle[];
  requests: ChargingRequest[];
} {
  const vehicles = db
    .select()
    .from(privateVehicles)
    .where(eq(privateVehicles.ownerId, studentId))
    .all();
  const requests = db
    .select()
    .from(chargingRequests)
    .where(eq(chargingRequests.studentId, studentId))
    .orderBy(desc(chargingRequests.createdAt))
    .all();
  return { vehicles, requests };
}

export const chargingRequestOps = {
  expireDueChargingRequests(now: Date): number {
    return db.update(chargingRequests)
      .set({ status: "EXPIRED", assignedPortId: null, updatedAt: now })
      .where(and(
        eq(chargingRequests.status, "ALLOCATED"),
        lte(chargingRequests.allocationDeadline, now),
        notExists(activeSessionForRequest()),
      ))
      .run().changes;
  },

  /** Kiểm tra sinh viên có quyền gửi yêu cầu sạc cho xe (sở hữu xe cá nhân hoặc đang có chuyến đi ACTIVE với xe dùng chung). */
  findVehicleChargingRight(studentId: string, vehicleId: string): boolean {
    const ownedPrivate = db
      .select({ id: privateVehicles.id })
      .from(privateVehicles)
      .where(and(eq(privateVehicles.id, vehicleId), eq(privateVehicles.ownerId, studentId)))
      .get();
    if (ownedPrivate) return true;

    const activeTrip = db
      .select({ id: trips.id })
      .from(trips)
      .where(
        and(
          eq(trips.studentId, studentId),
          eq(trips.vehicleId, vehicleId),
          eq(trips.status, "ACTIVE"),
        ),
      )
      .get();
    return Boolean(activeTrip);
  },

  /** Kiểm tra Hub tồn tại, có hạ tầng sạc hoạt động và tương thích đầu sạc với phương tiện. */
  checkVehicleAtHubAndCompatible(hubId: string, vehicleId: string): boolean {
    const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
    if (!hub) return false;

    const chargerSlots = db
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
    if (chargerSlots.length === 0) return false;

    const ports = db
      .select()
      .from(chargingPorts)
      .where(inArray(chargingPorts.slotId, chargerSlots.map((s) => s.id)))
      .all()
      .filter((p) => p.status !== "OUT_OF_SERVICE");
    if (ports.length === 0) return false;

    const priv = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
    if (priv) {
      return ports.some((p) => p.connectorType === priv.connectorType);
    }

    const shared = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    if (shared) {
      return shared.hubId === hubId;
    }

    return false;
  },

  /** Tìm các yêu cầu sạc đang hoạt động (WAITING / ALLOCATED / CHARGING) của cùng phương tiện. */
  findConflictingChargingRecords(studentId: string, vehicleId: string): ChargingRequest[] {
    return findUnfinishedChargingRequests(vehicleId, new Date());
  },

  /** Đánh giá khả năng cấp cổng sạc ngay lập tức hoặc đưa vào hàng đợi tại Hub. */
  evaluateChargingAllocation(
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
    now: Date,
  ): ChargingProposal {
    const restrictedIds = getRestrictedResourceIds();
    const priv = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
    const requiredConnector = priv?.connectorType;

    const chargerSlots = db
      .select()
      .from(parkingSlots)
      .where(and(eq(parkingSlots.hubId, hubId), eq(parkingSlots.hasCharger, true)))
      .all();
    const slotById = new Map(chargerSlots.map((s) => [s.id, s]));
    const hubPorts =
      chargerSlots.length === 0
        ? []
        : db
            .select()
            .from(chargingPorts)
            .where(inArray(chargingPorts.slotId, [...slotById.keys()]))
            .all();
    const windowEnd = new Date(now.getTime() + systemConfig.immediateChargingWindowMinutes * 60_000);
    const timeRange = { startTime: now, endTime: windowEnd };
    const { occupiedPorts, activePowerKw, powerLimitKw } = getChargingAvailability(hubId, hubPorts, timeRange, now);

    const hubActiveRequests = db
      .select()
      .from(chargingRequests)
      .where(
        and(
          eq(chargingRequests.hubId, hubId),
          inArray(chargingRequests.status, [...ACTIVE_REQUEST_STATUSES]),
        ),
      )
      .all();

    if (!restrictedIds.has(hubId)) {
      const candidatePort = hubPorts.find((port) => {
        if (requiredConnector && port.connectorType !== requiredConnector) return false;
        const slot = slotById.get(port.slotId);
        return slot
          && isChargingPortAvailable(port, slot, timeRange, now, restrictedIds, occupiedPorts)
          && activePowerKw + port.maxPowerKw <= powerLimitKw;
      });

      if (candidatePort) {
        return {
          canAllocateNow: true,
          proposedPortId: candidatePort.id,
          estimatedWaitMinutes: 0,
          allocationDeadline: new Date(now.getTime() + systemConfig.chargingAllocationClaimMinutes * 60_000),
        };
      }
    }

    // Không còn cổng trống → ước tính thời gian chờ theo hàng đợi (ưu tiên pin thấp < 25%)
    const waitingList = hubActiveRequests.filter((r) => r.status === "WAITING");
    const isLowBattery = chargingNeed.currentBattery < systemConfig.lowBatteryChargingPriority;
    const aheadCount = isLowBattery
      ? waitingList.filter((r) => r.currentBattery < systemConfig.lowBatteryChargingPriority).length
      : waitingList.length;

    return {
      canAllocateNow: false,
      estimatedWaitMinutes: Math.max(15, (aheadCount + 1) * 15),
    };
  },

  /** UC07 – Trong db.transaction: kiểm tra gửi lặp, quyền, xung đột; phân cổng ngay (ALLOCATED) hoặc đưa vào hàng đợi (WAITING). */
  atomicSubmitChargingRequest(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
    now: Date,
  ): ChargingRequestResult {
    return db.transaction(() => {
      this.expireDueChargingRequests(now);
      // 1. Chống gửi lặp cùng requestId
      const existingOp = processedChargingOps.get(requestId);
      if (existingOp) {
        if (existingOp.actorId !== studentId || existingOp.kind !== "SUBMIT") {
          throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho một thao tác khác.");
        }
        const saved = db
          .select()
          .from(chargingRequests)
          .where(eq(chargingRequests.id, existingOp.chargingRequestId))
          .get();
        if (saved) {
          const hub = db.select().from(hubs).where(eq(hubs.id, saved.hubId)).get();
          const slotCode = saved.assignedPortId ? getPortSlotCode(saved.assignedPortId) : undefined;
          return {
            chargingRequestId: saved.id,
            status: saved.status,
            assignedPortId: saved.assignedPortId ?? undefined,
            allocationDeadline: saved.allocationDeadline ?? undefined,
            usageGuide: buildUsageGuide(hub?.name ?? saved.hubId, saved.status, slotCode, saved.allocationDeadline),
          };
        }
      }

      // 2. Xác minh lại quyền, Hub tương thích và không có yêu cầu đang trùng
      if (!this.findVehicleChargingRight(studentId, vehicleId)) {
        throw new AppError("FORBIDDEN", "Bạn không có quyền gửi yêu cầu sạc cho phương tiện này.");
      }
      if (!this.checkVehicleAtHubAndCompatible(hubId, vehicleId)) {
        throw new AppError("CONFLICT", "Không xác minh được xe đang ở Hub đã chọn hoặc Hub không có cổng sạc tương thích.");
      }
      const conflicts = findUnfinishedChargingRequests(vehicleId, now);
      if (conflicts.length > 0 || hasConflictingActiveChargingReservation(vehicleId, now)) {
        throw new AppError(
          "CONFLICT",
          "Phương tiện này hiện đã có một yêu cầu sạc hoặc lịch sạc xung đột đang hiệu lực.",
        );
      }

      // 3. Đánh giá phân bổ mới nhất ngay trong transaction
      const proposal = this.evaluateChargingAllocation(hubId, vehicleId, chargingNeed, now);

      // UC07 Ext 7a: Nếu lúc chuẩn bị hệ thống đề xuất cấp cổng ngay nhưng hiện tại đã hết cổng
      // -> báo khả năng phân bổ thay đổi và yêu cầu sinh viên xác nhận lại (không tự đẩy vào hàng chờ).
      const cacheKey = proposalCacheKey(studentId, hubId, vehicleId);
      const prevPrepared = preparedAllocationCache.get(cacheKey);
      const isFreshPrepared =
        prevPrepared !== undefined &&
        now.getTime() - prevPrepared.preparedAt.getTime() <= systemConfig.chargingAllocationClaimMinutes * 60_000;
      if (isFreshPrepared && prevPrepared.canAllocateNow && !proposal.canAllocateNow) {
        preparedAllocationCache.set(cacheKey, { canAllocateNow: false, preparedAt: now });
        throw new AppError(
          "CONFLICT",
          "Khả năng phân bổ cổng sạc tại Hub vừa thay đổi (hiện không còn cổng trống). Vui lòng xem lại phương án hàng chờ và xác nhận lại.",
          { reason: "ALLOCATION_CHANGED", updatedProposal: proposal },
        );
      }
      preparedAllocationCache.delete(cacheKey);

      const status = proposal.canAllocateNow && proposal.proposedPortId ? "ALLOCATED" : "WAITING";
      const assignedPortId = status === "ALLOCATED" ? proposal.proposedPortId! : null;
      const allocationDeadline = status === "ALLOCATED" ? (proposal.allocationDeadline ?? null) : null;

      const inserted = db
        .insert(chargingRequests)
        .values({
          studentId,
          vehicleId,
          hubId,
          assignedPortId,
          currentBattery: chargingNeed.currentBattery,
          targetBattery: chargingNeed.targetBattery,
          status,
          allocationDeadline,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get()!;

      processedChargingOps.set(requestId, {
        actorId: studentId,
        kind: "SUBMIT",
        chargingRequestId: inserted.id,
      });

      const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
      const slotCode = assignedPortId ? getPortSlotCode(assignedPortId) : undefined;
      const waitingCount =
        status === "WAITING"
          ? db
              .select({ id: chargingRequests.id })
              .from(chargingRequests)
              .where(and(eq(chargingRequests.hubId, hubId), eq(chargingRequests.status, "WAITING")))
              .all().length
          : undefined;

      return {
        chargingRequestId: inserted.id,
        status: inserted.status,
        assignedPortId: inserted.assignedPortId ?? undefined,
        allocationDeadline: inserted.allocationDeadline ?? undefined,
        usageGuide: buildUsageGuide(
          hub?.name ?? hubId,
          inserted.status,
          slotCode,
          inserted.allocationDeadline,
          waitingCount,
        ),
      };
    });
  },

  findChargingRequest(chargingRequestId: string): ChargingRequest | undefined {
    return db
      .select()
      .from(chargingRequests)
      .where(eq(chargingRequests.id, chargingRequestId))
      .get();
  },

  /** Cancel Charging Request – Trong db.transaction: kiểm tra gửi lặp, quyền sở hữu, chưa bắt đầu sạc → CANCELLED. */
  atomicCancelChargingRequest(
    requestId: string,
    studentId: string,
    chargingRequestId: string,
    now: Date,
  ): CancelChargingResult {
    return db.transaction(() => {
      const existingOp = processedChargingOps.get(requestId);
      if (existingOp) {
        if (existingOp.actorId !== studentId || existingOp.kind !== "CANCEL") {
          throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho một thao tác khác.");
        }
        const saved = this.findChargingRequest(existingOp.chargingRequestId);
        if (saved) {
          return { chargingRequestId: saved.id, status: saved.status };
        }
      }

      const req = this.findChargingRequest(chargingRequestId);
      if (!req) {
        throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu sạc cần hủy.");
      }
      if (req.studentId !== studentId) {
        throw new AppError("FORBIDDEN", "Bạn không có quyền hủy yêu cầu sạc của sinh viên khác.");
      }
      if (req.status === "CANCELLED") {
        processedChargingOps.set(requestId, {
          actorId: studentId,
          kind: "CANCEL",
          chargingRequestId: req.id,
        });
        return { chargingRequestId: req.id, status: "CANCELLED" };
      }

      const activeSession = db
        .select({ id: chargingSessions.id })
        .from(chargingSessions)
        .where(and(eq(chargingSessions.chargingRequestId, req.id), eq(chargingSessions.status, "ACTIVE")))
        .get();
      const expired = req.status === "ALLOCATED" && req.allocationDeadline && req.allocationDeadline <= now;
      if (activeSession || expired || (req.status !== "WAITING" && req.status !== "ALLOCATED")) {
        throw new AppError(
          "CONFLICT",
          "Yêu cầu sạc đã bắt đầu sạc, đã hoàn tất hoặc đã hết hạn nên không thể hủy.",
        );
      }

      const updated = db
        .update(chargingRequests)
        .set({
          status: "CANCELLED",
          assignedPortId: null,
          allocationDeadline: null,
          updatedAt: now,
        })
        .where(eq(chargingRequests.id, req.id))
        .returning()
        .get()!;

      processedChargingOps.set(requestId, {
        actorId: studentId,
        kind: "CANCEL",
        chargingRequestId: updated.id,
      });

      return {
        chargingRequestId: updated.id,
        status: updated.status,
      };
    });
  },
};

function getPortSlotCode(portId: string): string | undefined {
  const row = db
    .select({ code: parkingSlots.code })
    .from(chargingPorts)
    .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
    .where(eq(chargingPorts.id, portId))
    .get();
  return row?.code;
}
