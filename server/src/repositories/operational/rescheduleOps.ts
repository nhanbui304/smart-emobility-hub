// Owner: Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC09.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, inArray } from "drizzle-orm";
import { systemConfig } from "../../config/systemConfig";
import {
  chargingPorts,
  chargingReservations,
  chargingSessions,
  hubs,
  incidents,
  parkingSlots,
  privateVehicles,
  processedRequests,
  type ChargingPort,
  type ChargingReservation,
  type Hub,
  type ParkingSlot,
  type PrivateVehicle,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type { TimeRange } from "../../lib/schemas";
import type {
  CancellationResult,
  ChargingNeed,
  ChargingSlotOption,
  RescheduleResult,
  SlotQueryResult,
} from "../../types/dto";
import { getChargingAvailability, isChargingPortAvailable } from "./chargingAvailability";
import { hasConflictingImmediateChargingRequest } from "./chargingReservationOps";
import { commonOps } from "./common";

/** Các trạng thái lịch sạc vẫn đang giữ cổng/vị trí sạc (không tính CANCELLED / COMPLETED / EXPIRED). */
const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"] as const;

/** Phương án đổi lịch lưu tạm trong bộ nhớ để bước confirmReschedule tra theo optionId. */
interface CachedRescheduleOption {
  option: ChargingSlotOption;
  studentId: string;
  reservationId: string;
  vehicleId: string;
  chargingNeed: ChargingNeed;
  expiresAt: Date;
}

const rescheduleOptionStore = new Map<string, CachedRescheduleOption>();

function getOptionTtlMs(): number {
  return systemConfig.parkingHoldMinutes * 60 * 1000;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

function purgeExpiredOptions(now: Date): void {
  const nowMs = now.getTime();
  for (const [id, entry] of rescheduleOptionStore.entries()) {
    if (entry.expiresAt.getTime() <= nowMs) {
      rescheduleOptionStore.delete(id);
    }
  }
}

/** Kiểm tra tài nguyên (cổng sạc hoặc vị trí đỗ) có đang bị hạn chế do sự cố OPEN/IN_PROGRESS (UC11 bước 4). */
function getRestrictedResourceIds(): Set<string> {
  const openIncidents = db
    .select()
    .from(incidents)
    .where(inArray(incidents.status, ["OPEN", "IN_PROGRESS"]))
    .all();
  return new Set(openIncidents.map((inc) => inc.resourceId));
}

/** Kiểm tra xe cá nhân có lịch sạc khác còn hiệu lực bị chồng lấn với khung giờ mới hay không (bỏ qua excludeReservationId). */
function hasVehicleScheduleConflict(
  vehicleId: string,
  timeRange: TimeRange,
  excludeReservationId: string,
): boolean {
  const vehicleReservations = db
    .select()
    .from(chargingReservations)
    .where(
      and(
        eq(chargingReservations.privateVehicleId, vehicleId),
        inArray(chargingReservations.status, [...ACTIVE_RESERVATION_STATUSES]),
      ),
    )
    .all();

  return vehicleReservations.some(
    (r) =>
      r.id !== excludeReservationId &&
      rangesOverlap(r.startTime, r.endTime, timeRange.startTime, timeRange.endTime),
  );
}

/**
 * UC09 bước 7 – Tìm các phương án cổng sạc khả dụng tại Hub cho việc đổi lịch.
 * Tương đương `queryAvailableChargingSlots(..., excludeReservationId)` trong UC09.drawio.
 * Tách thành helper nội bộ của module UC09 để không xung đột với `chargingReservationOps.ts` (UC08 – Ngô Minh Triết).
 */
export function queryAvailableChargingSlotsForReschedule(
  hubId: string,
  vehicleId: string,
  timeRange: TimeRange,
  chargingNeed: ChargingNeed,
  now: Date,
  excludeReservationId: string,
  studentId: string,
): SlotQueryResult {
  purgeExpiredOptions(now);

  const vehicle = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
  if (!vehicle) {
    return { options: [], verified: true, slots: [] };
  }

  if (hasVehicleScheduleConflict(vehicleId, timeRange, excludeReservationId)
    || hasConflictingImmediateChargingRequest(vehicleId, timeRange, now)) {
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
  const { occupiedPorts, activePowerKw, powerLimitKw } = getChargingAvailability(hubId, hubPorts, timeRange, now, excludeReservationId);

  const options: ChargingSlotOption[] = [];
  const availableSlots: ParkingSlot[] = [];
  const expiresAt = new Date(now.getTime() + getOptionTtlMs());

  for (const port of hubPorts) {
    if (port.connectorType !== vehicle.connectorType) continue;
    const slot = slotById.get(port.slotId);
    if (!slot) continue;
    if (!isChargingPortAvailable(port, slot, timeRange, now, restrictedIds, occupiedPorts)) {
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

    rescheduleOptionStore.set(option.slotOptionId, {
      option,
      studentId,
      reservationId: excludeReservationId,
      vehicleId,
      chargingNeed: { ...chargingNeed },
      expiresAt,
    });

    options.push(option);
    availableSlots.push(slot);
  }

  return { options, verified: true, slots: availableSlots };
}

/** Tra ngữ cảnh đầy đủ của một lịch sạc (xe cá nhân, cổng sạc, vị trí đỗ, Hub, phiên sạc đang chạy). */
export function loadReservationFullContext(reservationOrId: ChargingReservation | string): {
  reservation: ChargingReservation;
  vehicle: PrivateVehicle;
  port: ChargingPort;
  slot: ParkingSlot;
  hub: Hub;
  hasActiveSession: boolean;
} | undefined {
  const reservation =
    typeof reservationOrId === "string"
      ? rescheduleOps.findReservation(reservationOrId)
      : reservationOrId;
  if (!reservation) return undefined;

  const vehicle = db
    .select()
    .from(privateVehicles)
    .where(eq(privateVehicles.id, reservation.privateVehicleId))
    .get();
  const port = db.select().from(chargingPorts).where(eq(chargingPorts.id, reservation.portId)).get();
  if (!vehicle || !port) return undefined;

  const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, port.slotId)).get();
  if (!slot) return undefined;

  const hub = db.select().from(hubs).where(eq(hubs.id, slot.hubId)).get();
  if (!hub) return undefined;

  const activeSession = db
    .select()
    .from(chargingSessions)
    .where(and(eq(chargingSessions.reservationId, reservation.id), eq(chargingSessions.status, "ACTIVE")))
    .get();

  return {
    reservation,
    vehicle,
    port,
    slot,
    hub,
    hasActiveSession: Boolean(activeSession),
  };
}

/** Kiểm tra tính tương thích giữa xe cá nhân và Hub mục tiêu (dùng trong validateNewCriteria). */
export function checkVehicleAndHubCompatibility(
  vehicleId: string,
  hubId: string,
): { valid: boolean; reason?: string } {
  const vehicle = db.select().from(privateVehicles).where(eq(privateVehicles.id, vehicleId)).get();
  if (!vehicle) {
    return { valid: false, reason: "Không tìm thấy thông tin phương tiện điện cá nhân." };
  }

  const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
  if (!hub) {
    return { valid: false, reason: "Hub đã chọn không tồn tại trong hệ thống." };
  }

  const hubSlots = db
    .select()
    .from(parkingSlots)
    .where(and(eq(parkingSlots.hubId, hubId), eq(parkingSlots.hasCharger, true)))
    .all();
  if (hubSlots.length === 0) {
    return { valid: false, reason: `Hub "${hub.name}" chưa có cổng sạc phục vụ.` };
  }

  const ports = db
    .select()
    .from(chargingPorts)
    .where(inArray(chargingPorts.slotId, hubSlots.map((s) => s.id)))
    .all();

  const hasCompatibleConnector = ports.some((p) => p.connectorType === vehicle.connectorType);
  if (!hasCompatibleConnector) {
    return {
      valid: false,
      reason: `Hub "${hub.name}" không có cổng sạc tương thích với đầu cắm ${vehicle.connectorType} của xe ${vehicle.plate}.`,
    };
  }

  return { valid: true };
}

/** Kiểm tra một lịch sạc có phiên sạc ACTIVE đang chạy hay không (UC09 bước 5 / Ext 4b). */
export function hasActiveChargingSession(reservationId: string): boolean {
  const active = db
    .select()
    .from(chargingSessions)
    .where(and(eq(chargingSessions.reservationId, reservationId), eq(chargingSessions.status, "ACTIVE")))
    .get();
  return Boolean(active);
}

/** Lấy thông tin cổng + Hub để tạo hướng dẫn sử dụng (UpdatedReservation.usageGuide). */
export function getPortAndHubInfo(portId: string): { hubId: string; hubName: string; slotCode: string } | undefined {
  const port = db.select().from(chargingPorts).where(eq(chargingPorts.id, portId)).get();
  if (!port) return undefined;
  const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, port.slotId)).get();
  if (!slot) return undefined;
  const hub = db.select().from(hubs).where(eq(hubs.id, slot.hubId)).get();
  if (!hub) return undefined;
  return { hubId: hub.id, hubName: hub.name, slotCode: slot.code };
}

export const rescheduleOps = {
  /** UC09 bước 2 / 5 / 7 / Ext 4b: tìm bản ghi lịch sạc theo mã. */
  findReservation(reservationId: string): ChargingReservation | undefined {
    return db
      .select()
      .from(chargingReservations)
      .where(eq(chargingReservations.id, reservationId))
      .get();
  },

  /**
   * UC09 bước 10 – trong db.transaction:
   * Thứ tự kiểm tra khớp BTL2 Sequence (3/4) & Activity (4/4):
   *   1. Chống gửi lặp requestId (Ext 10d)
   *   2. Kiểm tra quyền sở hữu (Ext 2a)
   *   3. Kiểm tra phương án mới còn khả dụng & không bị hạn chế do sự cố UC11 (Ext 10a, TC-UC09-01)
   *   4. Kiểm tra expectedVersion & điều kiện sửa (Ext 10b)
   *   5. Cập nhật cổng/khung giờ/nhu cầu, version + 1, ghi processed_requests (Bước 10)
   */
  atomicReschedule(
    requestId: string,
    studentId: string,
    reservationId: string,
    optionId: string,
    expectedVersion: number,
  ): RescheduleResult {
    const now = new Date();
    purgeExpiredOptions(now);

    return db.transaction(() => {
      // 1. Ext 10d: Kiểm tra gửi lặp cùng requestId
      const existingReq = commonOps.findProcessedRequest(requestId);
      if (existingReq) {
        if (existingReq.actorId !== studentId || existingReq.operation !== "RESCHEDULE_CHARGING_RESERVATION") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        const saved = db
          .select()
          .from(chargingReservations)
          .where(eq(chargingReservations.id, existingReq.resultId))
          .get();
        if (!saved) {
          throw new AppError("NOT_FOUND", "Không tìm thấy kết quả lịch sạc đã xử lý trước đó.");
        }
        return { reservation: saved };
      }

      // 2. Ext 2a: Kiểm tra lịch tồn tại và thuộc sinh viên
      const reservation = db
        .select()
        .from(chargingReservations)
        .where(eq(chargingReservations.id, reservationId))
        .get();
      if (!reservation) {
        throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc cần đổi.");
      }
      if (reservation.studentId !== studentId) {
        throw new AppError("FORBIDDEN", "Bạn không có quyền thay đổi lịch sạc của sinh viên khác.");
      }

      // 3. Ext 10a (TC-UC09-01): Kiểm tra phương án mới còn tồn tại, còn hạn và còn khả dụng
      const cached = rescheduleOptionStore.get(optionId);
      if (!cached || cached.studentId !== studentId || cached.reservationId !== reservationId) {
        throw new AppError(
          "CONFLICT",
          "Phương án đổi lịch không tồn tại hoặc đã hết hiệu lực. Vui lòng tìm lại phương án mới.",
          { reason: "NEW_OPTION_UNAVAILABLE", updatedOptions: [] },
        );
      }

      const { option, chargingNeed } = cached;
      const newTimeRange: TimeRange = { startTime: option.startTime, endTime: option.endTime };

      const targetPort = db.select().from(chargingPorts).where(eq(chargingPorts.id, option.portId)).get();
      const targetSlot = targetPort
        ? db.select().from(parkingSlots).where(eq(parkingSlots.id, targetPort.slotId)).get()
        : undefined;
      const restrictedIds = getRestrictedResourceIds();

      let portAvailable = false;
      if (targetPort && targetSlot) {
        const hubChargerSlots = db
          .select()
          .from(parkingSlots)
          .where(and(eq(parkingSlots.hubId, targetSlot.hubId), eq(parkingSlots.hasCharger, true)))
          .all();
        const hubPorts =
          hubChargerSlots.length === 0
            ? []
            : db
              .select()
              .from(chargingPorts)
              .where(inArray(chargingPorts.slotId, hubChargerSlots.map((s) => s.id)))
              .all();
        const { occupiedPorts, activePowerKw, powerLimitKw } = getChargingAvailability(
          targetSlot.hubId, hubPorts, newTimeRange, now, reservationId,
        );
        portAvailable = isChargingPortAvailable(targetPort, targetSlot, newTimeRange, now, restrictedIds, occupiedPorts)
          && activePowerKw + targetPort.maxPowerKw <= powerLimitKw;
      }

      const stillAvailable =
        Boolean(targetPort && targetSlot) &&
        newTimeRange.startTime.getTime() > now.getTime() &&
        !hasVehicleScheduleConflict(reservation.privateVehicleId, newTimeRange, reservationId) &&
        !hasConflictingImmediateChargingRequest(reservation.privateVehicleId, newTimeRange, now) &&
        portAvailable;

      if (!stillAvailable) {
        // Cập nhật danh sách phương án mới nhất để UI hiển thị cho sinh viên chọn lại (BTL1 Ext 10a, TC-UC09-01)
        const refreshed = queryAvailableChargingSlotsForReschedule(
          option.hubId,
          reservation.privateVehicleId,
          newTimeRange,
          chargingNeed,
          now,
          reservationId,
          studentId,
        );
        throw new AppError(
          "CONFLICT",
          "Phương án mới vừa hết chỗ hoặc bị hạn chế phục vụ. Lịch sạc cũ của bạn vẫn được giữ nguyên; vui lòng chọn phương án khác.",
          { reason: "NEW_OPTION_UNAVAILABLE", updatedOptions: refreshed.options },
        );
      }

      // 4. Ext 10b: Kiểm tra phiên bản lịch (optimistic locking) và điều kiện còn được sửa
      if (reservation.version !== expectedVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          `Lịch sạc đã được cập nhật trước đó (phiên bản hiện tại là ${reservation.version}, bạn gửi ${expectedVersion}). Vui lòng tải lại lịch sạc.`,
          { reason: "VERSION_MISMATCH", currentReservation: reservation },
        );
      }

      const activeSession = db
        .select()
        .from(chargingSessions)
        .where(and(eq(chargingSessions.reservationId, reservation.id), eq(chargingSessions.status, "ACTIVE")))
        .get();

      if (reservation.status !== "CONFIRMED" || reservation.startTime.getTime() <= now.getTime() || activeSession) {
        throw new AppError(
          "CONFLICT",
          "Lịch sạc không còn đủ điều kiện sửa (đã đến giờ bắt đầu, đang xử lý bắt đầu sạc hoặc đã kết thúc/hết hạn/hủy).",
          { reason: "NOT_MODIFIABLE", currentReservation: reservation },
        );
      }

      // 5. Bước 10: Cập nhật lịch sạc & chuyển phân bổ từ cổng cũ sang cổng mới trong cùng 1 transaction
      const updated = db
        .update(chargingReservations)
        .set({
          portId: option.portId,
          startTime: option.startTime,
          endTime: option.endTime,
          currentBattery: chargingNeed.currentBattery,
          targetBattery: chargingNeed.targetBattery,
          version: expectedVersion + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(chargingReservations.id, reservationId),
            eq(chargingReservations.version, expectedVersion),
          ),
        )
        .returning()
        .get();

      if (!updated) {
        throw new AppError("VERSION_CONFLICT", "Lịch sạc vừa bị thay đổi đồng thời. Vui lòng tải lại.");
      }

      // Ghi nhận ProcessedRequest trong cùng transaction để chống gửi lặp (Ext 10d)
      db.insert(processedRequests)
        .values({
          requestId,
          actorId: studentId,
          operation: "RESCHEDULE_CHARGING_RESERVATION",
          resultId: updated.id,
        })
        .run();

      // Xóa option đã dùng khỏi bộ nhớ tạm
      rescheduleOptionStore.delete(optionId);

      return { reservation: updated };
    });
  },

  /**
   * UC09 Ext 4b.1 – trong db.transaction:
   *   1. Kiểm tra gửi lặp requestId (Ext 10d)
   *   2. Kiểm tra quyền sở hữu (Ext 2a)
   *   3. Nếu đã hủy trước đó → trả kết quả đã có, không giải phóng lặp (Ext 4b.3)
   *   4. Kiểm tra expectedVersion & điều kiện hủy (CONFIRMED, chưa đến giờ bắt đầu, chưa bắt đầu sạc)
   *   5. Chuyển CONFIRMED → CANCELLED, version + 1, ghi processed_requests
   */
  atomicCancelReservation(
    requestId: string,
    studentId: string,
    reservationId: string,
    expectedVersion: number,
    now: Date,
  ): CancellationResult {
    return db.transaction(() => {
      // 1. Ext 10d: Kiểm tra gửi lặp cùng requestId
      const existingReq = commonOps.findProcessedRequest(requestId);
      if (existingReq) {
        if (existingReq.actorId !== studentId || existingReq.operation !== "CANCEL_CHARGING_RESERVATION") {
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
        return { reservationId: saved.id, status: saved.status };
      }

      // 2. Ext 2a: Kiểm tra tồn tại và quyền sở hữu
      const reservation = db
        .select()
        .from(chargingReservations)
        .where(eq(chargingReservations.id, reservationId))
        .get();
      if (!reservation) {
        throw new AppError("NOT_FOUND", "Không tìm thấy lịch sạc cần hủy.");
      }
      if (reservation.studentId !== studentId) {
        throw new AppError("FORBIDDEN", "Bạn không có quyền hủy lịch sạc của sinh viên khác.");
      }

      // 3. Ext 4b.3: Nếu lịch đã hủy → trả trạng thái đã hủy, không giải phóng tài nguyên lần nữa
      if (reservation.status === "CANCELLED") {
        return { reservationId: reservation.id, status: "CANCELLED" };
      }

      // 4. Kiểm tra phiên bản và điều kiện còn được phép hủy
      if (reservation.version !== expectedVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          `Lịch sạc đã được thay đổi trước đó (phiên bản hiện tại là ${reservation.version}, bạn gửi ${expectedVersion}). Vui lòng tải lại lịch sạc.`,
          { reason: "VERSION_MISMATCH", currentReservation: reservation },
        );
      }

      const activeSession = db
        .select()
        .from(chargingSessions)
        .where(and(eq(chargingSessions.reservationId, reservation.id), eq(chargingSessions.status, "ACTIVE")))
        .get();

      if (reservation.status !== "CONFIRMED" || reservation.startTime.getTime() <= now.getTime() || activeSession) {
        throw new AppError(
          "CONFLICT",
          "Lịch sạc không còn được phép hủy (đã đến giờ bắt đầu, đang sạc hoặc đã kết thúc/hết hạn).",
          { reason: "NOT_CANCELLABLE", currentReservation: reservation },
        );
      }

      // 5. Ext 4b.1: Chuyển CONFIRMED → CANCELLED và giải phóng tài nguyên cổng sạc trong cùng transaction
      const cancelled = db
        .update(chargingReservations)
        .set({
          status: "CANCELLED",
          version: expectedVersion + 1,
          updatedAt: now,
        })
        .where(
          and(
            eq(chargingReservations.id, reservationId),
            eq(chargingReservations.version, expectedVersion),
          ),
        )
        .returning()
        .get();

      if (!cancelled) {
        throw new AppError("VERSION_CONFLICT", "Lịch sạc vừa bị thay đổi đồng thời. Vui lòng tải lại.");
      }

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: studentId,
          operation: "CANCEL_CHARGING_RESERVATION",
          resultId: cancelled.id,
        })
        .run();

      return { reservationId: cancelled.id, status: cancelled.status };
    });
  },
};
