// Owner: Ngô Minh Triết, Nguyễn Hoàng Nhân – UC07, UC08, UC09
import { and, desc, eq, inArray } from "drizzle-orm";
import { systemConfig } from "../../config/systemConfig";
import {
  chargingRequests,
  chargingReservations,
  chargingScheduleVersions,
  chargingSessions,
  parkingAllocations,
  type ChargingPort,
  type ParkingSlot,
} from "../../db/schema";
import { db } from "../../lib/db";
import type { TimeRange } from "../../lib/schemas";

const HUB_POWER_SAFETY_FACTOR = 0.85;

export function getChargingAvailability(
  hubId: string,
  ports: ChargingPort[],
  range: TimeRange,
  now: Date,
  excludeReservationId?: string,
) {
  const portIds = ports.map((port) => port.id);
  const occupiedPorts = new Set(ports.filter((port) => port.status === "IN_USE").map((port) => port.id));
  if (ports.length > 0) {
    const sessions = db.select({ portId: chargingSessions.portId }).from(chargingSessions)
      .where(and(inArray(chargingSessions.portId, portIds), eq(chargingSessions.status, "ACTIVE"))).all();
    for (const session of sessions) occupiedPorts.add(session.portId);

    const reservations = db.select().from(chargingReservations).where(and(
      inArray(chargingReservations.portId, portIds),
      inArray(chargingReservations.status, ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"]),
    )).all();
    for (const reservation of reservations) {
      if (reservation.id === excludeReservationId) continue;
      if (reservation.status !== "CONFIRMED" || overlaps(reservation.startTime, reservation.endTime, range)) {
        occupiedPorts.add(reservation.portId);
      }
    }

    const requests = db.select().from(chargingRequests).where(and(
      inArray(chargingRequests.assignedPortId, portIds),
      inArray(chargingRequests.status, ["ALLOCATED", "CHARGING"]),
    )).all();
    const hasLiveAllocation = requests.some((request) =>
      request.status === "ALLOCATED" && request.allocationDeadline && request.allocationDeadline > now,
    );
    const versions = hasLiveAllocation
      ? db.select({ allocations: chargingScheduleVersions.allocations }).from(chargingScheduleVersions)
        .where(eq(chargingScheduleVersions.hubId, hubId)).orderBy(desc(chargingScheduleVersions.version)).all()
      : [];
    const plannedAllocations = versions.flatMap((version) => version.allocations);
    for (const request of requests) {
      const portId = request.assignedPortId;
      if (!portId) continue;
      if (request.status === "CHARGING" || !request.allocationDeadline) {
        occupiedPorts.add(portId);
        continue;
      }
      if (request.allocationDeadline <= now) continue;

      // UC13 có khung sạc đã lưu, còn UC07 giữ công suất cho khoảng sạc ngay dự kiến.
      const planned = plannedAllocations.find((allocation) =>
        allocation.demandId === request.id && allocation.portId === portId,
      );
      const start = planned ? new Date(planned.timeRange.startTime) : request.createdAt;
      const end = planned
        ? new Date(planned.timeRange.endTime)
        : new Date(Math.max(
          request.allocationDeadline.getTime(),
          start.getTime() + systemConfig.immediateChargingWindowMinutes * 60_000,
        ));
      if (overlaps(start, end, range)) occupiedPorts.add(portId);
    }
  }

  const activePorts = ports.filter((port) => port.status !== "OUT_OF_SERVICE");
  const totalPowerKw = activePorts.reduce((sum, port) => sum + port.maxPowerKw, 0);
  const largestPortKw = activePorts.reduce((max, port) => Math.max(max, port.maxPowerKw), 0);
  const committedPowerKw = ports.reduce((sum, port) => sum + (occupiedPorts.has(port.id) ? port.maxPowerKw : 0), 0);
  return {
    occupiedPorts,
    activePowerKw: committedPowerKw,
    powerLimitKw: Math.max(largestPortKw, Math.round(totalPowerKw * HUB_POWER_SAFETY_FACTOR * 100) / 100),
  };
}

export function isChargingPortAvailable(
  port: ChargingPort,
  slot: ParkingSlot,
  range: TimeRange,
  now: Date,
  restrictedIds: ReadonlySet<string>,
  occupiedPorts: ReadonlySet<string>,
): boolean {
  if (slot.status !== "IN_SERVICE" || port.status !== "AVAILABLE" || occupiedPorts.has(port.id)) return false;
  if (restrictedIds.has(port.id) || restrictedIds.has(slot.id) || restrictedIds.has(slot.hubId)) return false;

  const allocations = db.select().from(parkingAllocations).where(and(
    eq(parkingAllocations.slotId, slot.id),
    inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
  )).all();
  return !allocations.some((allocation) =>
    allocation.status === "IN_USE" ||
    ((allocation.status !== "HELD" || (allocation.holdExpiresAt && allocation.holdExpiresAt > now))
      && overlaps(allocation.startTime, allocation.endTime, range)),
  );
}

function overlaps(start: Date, end: Date, range: TimeRange): boolean {
  return start < range.endTime && end > range.startTime;
}
