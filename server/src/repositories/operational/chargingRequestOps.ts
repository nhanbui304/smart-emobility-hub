// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC07.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq, inArray } from "drizzle-orm";
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

const ACTIVE_REQUEST_STATUSES = ["WAITING", "ALLOCATED", "CHARGING"] as const;
const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"] as const;
/** Hệ số giới hạn công suất cung cấp điện của Hub (đồng bộ với UC09 & UC13). */
const HUB_POWER_SAFETY_FACTOR = 0.85;
/** Thời gian tối thiểu cần trống trước lịch đặt tiếp theo để cấp sạc ngay (phút). */
const IMMEDIATE_WINDOW_MINUTES = 60;

/** Chống gửi lặp theo requestId cho thao tác gửi/hủy yêu cầu sạc (UC07). */
const processedChargingOps = new Map<
  string,
  { actorId: string; kind: "SUBMIT" | "CANCEL"; chargingRequestId: string }
>();

function getClaimWindowMinutes(): number {
  const cfg = systemConfig as Record<string, number>;
  return typeof cfg.chargingAllocationClaimMinutes === "number"
    ? cfg.chargingAllocationClaimMinutes
    : 15;
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
      return shared.hubId === null || shared.hubId === hubId;
    }

    return false;
  },

  /** Tìm các yêu cầu sạc đang hoạt động (WAITING / ALLOCATED / CHARGING) của cùng phương tiện. */
  findConflictingChargingRecords(studentId: string, vehicleId: string): ChargingRequest[] {
    return db
      .select()
      .from(chargingRequests)
      .where(
        and(
          eq(chargingRequests.vehicleId, vehicleId),
          inArray(chargingRequests.status, [...ACTIVE_REQUEST_STATUSES]),
        ),
      )
      .all()
      .filter((r) => r.studentId === studentId || r.vehicleId === vehicleId);
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
    const hubPortIds = hubPorts.map((p) => p.id);

    const windowEnd = new Date(now.getTime() + IMMEDIATE_WINDOW_MINUTES * 60_000);

    // Các phiên sạc đang chạy, lịch đã xác nhận sắp tới, và yêu cầu ALLOCATED còn hạn tại Hub
    const activeSessionPortIds = new Set(
      hubPortIds.length === 0
        ? []
        : db
            .select({ portId: chargingSessions.portId })
            .from(chargingSessions)
            .where(and(inArray(chargingSessions.portId, hubPortIds), eq(chargingSessions.status, "ACTIVE")))
            .all()
            .map((s) => s.portId),
    );

    const overlappingReservationPortIds = new Set(
      hubPortIds.length === 0
        ? []
        : db
            .select()
            .from(chargingReservations)
            .where(
              and(
                inArray(chargingReservations.portId, hubPortIds),
                inArray(chargingReservations.status, [...ACTIVE_RESERVATION_STATUSES]),
              ),
            )
            .all()
            .filter((r) => rangesOverlap(r.startTime, r.endTime, now, windowEnd))
            .map((r) => r.portId),
    );

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

    const allocatedRequestPortIds = new Set(
      hubActiveRequests
        .filter(
          (r) =>
            r.assignedPortId &&
            (r.status === "CHARGING" ||
              (r.status === "ALLOCATED" && (!r.allocationDeadline || r.allocationDeadline > now))),
        )
        .map((r) => r.assignedPortId!),
    );

    const occupiedParkingSlotIds = new Set(
      chargerSlots.length === 0
        ? []
        : db
            .select()
            .from(parkingAllocations)
            .where(
              and(
                inArray(parkingAllocations.slotId, [...slotById.keys()]),
                inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
              ),
            )
            .all()
            .filter(
              (a) =>
                (a.status !== "HELD" || (a.holdExpiresAt !== null && a.holdExpiresAt > now)) &&
                (a.status === "IN_USE" || rangesOverlap(a.startTime, a.endTime, now, windowEnd)),
            )
            .map((a) => a.slotId),
    );

    // Tính ngân sách công suất hiện tại của Hub (hệ số 0.85 đồng bộ UC09 & UC13)
    const activePorts = hubPorts.filter((p) => p.status !== "OUT_OF_SERVICE");
    const totalActivePortPowerKw = activePorts.reduce((sum, p) => sum + p.maxPowerKw, 0);
    const maxSinglePortKw = activePorts.reduce((max, p) => Math.max(max, p.maxPowerKw), 0);
    const hubPowerLimitKw = Math.max(
      maxSinglePortKw,
      Math.round(totalActivePortPowerKw * HUB_POWER_SAFETY_FACTOR * 100) / 100,
    );

    const currentlyUsedPowerKw = hubPorts
      .filter(
        (p) =>
          p.status === "IN_USE" ||
          activeSessionPortIds.has(p.id) ||
          overlappingReservationPortIds.has(p.id) ||
          allocatedRequestPortIds.has(p.id),
      )
      .reduce((sum, p) => sum + p.maxPowerKw, 0);

    // Nếu cả Hub đang có sự cố mở thì không cấp mới
    if (!restrictedIds.has(hubId)) {
      const candidatePort = hubPorts.find((port) => {
        if (requiredConnector && port.connectorType !== requiredConnector) return false;
        const slot = slotById.get(port.slotId);
        if (!slot || slot.status !== "IN_SERVICE") return false;
        if (port.status !== "AVAILABLE") return false;
        if (restrictedIds.has(port.id) || restrictedIds.has(slot.id)) return false;
        if (activeSessionPortIds.has(port.id)) return false;
        if (overlappingReservationPortIds.has(port.id)) return false;
        if (allocatedRequestPortIds.has(port.id)) return false;
        if (occupiedParkingSlotIds.has(slot.id)) return false;
        if (currentlyUsedPowerKw + port.maxPowerKw > hubPowerLimitKw) return false;
        return true;
      });

      if (candidatePort) {
        return {
          canAllocateNow: true,
          proposedPortId: candidatePort.id,
          estimatedWaitMinutes: 0,
          allocationDeadline: new Date(now.getTime() + getClaimWindowMinutes() * 60_000),
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
        throw new AppError("CONFLICT", "Hub không có cổng sạc hoạt động tương thích với phương tiện của bạn.");
      }
      const conflicts = this.findConflictingChargingRecords(studentId, vehicleId);
      if (conflicts.length > 0) {
        throw new AppError(
          "CONFLICT",
          "Phương tiện này hiện đã có một yêu cầu sạc đang chờ hoặc đang được phân bổ tại hệ thống.",
        );
      }

      // 3. Đánh giá phân bổ mới nhất ngay trong transaction
      const proposal = this.evaluateChargingAllocation(hubId, vehicleId, chargingNeed, now);
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
      if (activeSession || (req.status !== "WAITING" && req.status !== "ALLOCATED")) {
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
