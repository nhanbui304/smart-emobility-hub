import { and, eq, gte, inArray, notInArray } from "drizzle-orm";
import { VEHICLE_TYPES } from "../constants";
import { hubs, incidents, sharedVehicles, type SharedVehicle } from "../db/schema";
import { db } from "../lib/db";
import type { MobilityContext, OptionState, SearchCriteria } from "../types/dto";

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
    const lastUpdatedMs = Math.max(latestVehicleTs, latestHubTs, Date.now());
    return {
      hubs: allHubs,
      vehicles,
      lastUpdatedAt: new Date(lastUpdatedMs),
    };
  },

  queryCurrentOptionState(optionId: string): OptionState {
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, optionId)).get();
    if (!vehicle) {
      return { isAvailable: false, currentBattery: 0 };
    }
    const openIncident = db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.resourceType, "SHARED_VEHICLE"),
          eq(incidents.resourceId, vehicle.id),
          inArray(incidents.status, ["OPEN", "IN_PROGRESS"]),
        ),
      )
      .get();
    const isAvailable =
      vehicle.status === "AVAILABLE" && Boolean(vehicle.hubId) && !openIncident;
    return {
      isAvailable,
      currentBattery: vehicle.batteryLevel,
    };
  },

  findCandidateVehicles(criteria: SearchCriteria): SharedVehicle[] {
    const restrictedRows = db
      .select({ resourceId: incidents.resourceId })
      .from(incidents)
      .where(
        and(
          eq(incidents.resourceType, "SHARED_VEHICLE"),
          inArray(incidents.status, ["OPEN", "IN_PROGRESS"]),
        ),
      )
      .all();
    const restrictedIds = restrictedRows.map((r) => r.resourceId);

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