// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC01.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, gte, gt, inArray, lte, notInArray } from "drizzle-orm";
import { VEHICLE_TYPES } from "../constants";
import {
  chargingPorts,
  hubs,
  incidents,
  parkingAllocations,
  parkingSlots,
  redistributionItems,
  sharedVehicles,
  type SharedVehicle,
} from "../db/schema";
import { db } from "../lib/db";
import type { MobilityContext, OptionState, SearchCriteria } from "../types/dto";

/** Tổng hợp tài nguyên đỗ/sạc khả dụng theo từng Hub để phục vụ mục đích PARK và CHARGE trong UC01. */
export interface HubResourceAvailability {
  hubId: string;
  freeSlots: number;
  freeChargingPorts: number;
}

export function queryHubResourceAvailability(now: Date = new Date()): Map<string, HubResourceAvailability> {
  const allHubs = db.select().from(hubs).all();
  const allSlots = db.select().from(parkingSlots).all();
  const allPorts = db
    .select({ port: chargingPorts, hubId: parkingSlots.hubId, slotStatus: parkingSlots.status })
    .from(chargingPorts)
    .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
    .all();
  const allVehicles = db.select().from(sharedVehicles).all();
  const activeAllocations = db
    .select()
    .from(parkingAllocations)
    .where(
      and(
        inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
        lte(parkingAllocations.startTime, now),
        gt(parkingAllocations.endTime, now),
      ),
    )
    .all()
    .filter((a) => a.status !== "HELD" || !a.holdExpiresAt || a.holdExpiresAt > now);

  const openIncidents = db
    .select({ resourceId: incidents.resourceId })
    .from(incidents)
    .where(inArray(incidents.status, ["OPEN", "IN_PROGRESS"]))
    .all();
  const restrictedIds = new Set(openIncidents.map((i) => i.resourceId));

  const occupiedSlotIds = new Set<string>();
  for (const v of allVehicles) {
    if (v.slotId) occupiedSlotIds.add(v.slotId);
  }
  for (const a of activeAllocations) {
    occupiedSlotIds.add(a.slotId);
  }

  const result = new Map<string, HubResourceAvailability>();
  for (const hub of allHubs) {
    const freeSlots = allSlots.filter(
      (s) =>
        s.hubId === hub.id &&
        s.status === "IN_SERVICE" &&
        !restrictedIds.has(s.id) &&
        !occupiedSlotIds.has(s.id),
    ).length;

    const freeChargingPorts = allPorts.filter(
      (p) =>
        p.hubId === hub.id &&
        p.slotStatus === "IN_SERVICE" &&
        p.port.status === "AVAILABLE" &&
        !restrictedIds.has(p.port.id) &&
        !restrictedIds.has(p.port.slotId),
    ).length;

    result.set(hub.id, { hubId: hub.id, freeSlots, freeChargingPorts });
  }

  return result;
}

function getRestrictedSharedVehicleIds(): string[] {
  const incidentRows = db
    .select({ resourceId: incidents.resourceId })
    .from(incidents)
    .where(
      and(
        eq(incidents.resourceType, "SHARED_VEHICLE"),
        inArray(incidents.status, ["OPEN", "IN_PROGRESS"]),
      ),
    )
    .all();

  const redistributionRows = db
    .select({ vehicleId: redistributionItems.vehicleId })
    .from(redistributionItems)
    .where(inArray(redistributionItems.status, ["PENDING", "IN_TRANSIT"]))
    .all();

  return [...new Set([...incidentRows.map((r) => r.resourceId), ...redistributionRows.map((r) => r.vehicleId)])];
}

export const mobilityRepository = {
  queryMobilityContext(criteria: SearchCriteria): MobilityContext {
    const allHubs = db.select().from(hubs).all();
    const vehicles = this.findCandidateVehicles(criteria);

    const latestVehicleTs = vehicles.reduce(
      (max, v) => (v.lastUpdatedAt.getTime() > max ? v.lastUpdatedAt.getTime() : max),
      0,
    );
    const latestHubTs = allHubs.reduce(
      (max, h) => (h.lastUpdatedAt.getTime() > max ? h.lastUpdatedAt.getTime() : max),
      0,
    );

    // Không ép bằng Date.now() để assessDataFreshness phát hiện được dữ liệu cũ (DATA_STALE).
    const latestTs = Math.max(latestVehicleTs, latestHubTs);
    const lastUpdatedMs = latestTs > 0 ? latestTs : Date.now();

    return {
      hubs: allHubs,
      vehicles,
      lastUpdatedAt: new Date(lastUpdatedMs),
    };
  },

  queryCurrentOptionState(optionId: string): OptionState {
    // Hỗ trợ kiểm tra cho phương án theo Hub (mục đích PARK / CHARGE: optionId có tiền tố park- / charge-)
    if (optionId.startsWith("park:") || optionId.startsWith("charge:")) {
      const [prefix, hubId] = optionId.split(":");
      const avail = hubId ? queryHubResourceAvailability().get(hubId) : undefined;
      if (!avail) return { isAvailable: false, currentBattery: 100 };
      const isAvailable = prefix === "park" ? avail.freeSlots > 0 : avail.freeChargingPorts > 0;
      return { isAvailable, currentBattery: 100 };
    }

    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, optionId)).get();
    if (!vehicle) {
      return { isAvailable: false, currentBattery: 0 };
    }

    const restrictedIds = new Set(getRestrictedSharedVehicleIds());
    const isAvailable =
      vehicle.status === "AVAILABLE" && Boolean(vehicle.hubId) && !restrictedIds.has(vehicle.id);

    return {
      isAvailable,
      currentBattery: vehicle.batteryLevel,
    };
  },

  findCandidateVehicles(criteria: SearchCriteria): SharedVehicle[] {
    const restrictedIds = getRestrictedSharedVehicleIds();
    const conditions = [
      eq(sharedVehicles.status, "AVAILABLE"),
      gte(sharedVehicles.batteryLevel, criteria.minBattery),
    ];

    if (VEHICLE_TYPES.includes(criteria.vehicleType)) {
      conditions.push(eq(sharedVehicles.type, criteria.vehicleType));
    }

    if (restrictedIds.length > 0) {
      conditions.push(notInArray(sharedVehicles.id, restrictedIds));
    }

    return db
      .select()
      .from(sharedVehicles)
      .where(and(...conditions))
      .all();
  },
};
