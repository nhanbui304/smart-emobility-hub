// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm)
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { ParkingAllocationStatus } from "@hub/shared";
import {
  chargingPorts,
  hubs,
  parkingAllocations,
  parkingSlots,
  sharedVehicles,
  type ChargingPort,
  type Hub,
  type ParkingAllocation,
  type ParkingSlot,
  type SharedVehicle,
} from "../db/schema";
import { db, type DbOrTx } from "../lib/db";

/** Các trạng thái phân bổ chỗ đỗ đang chiếm chỗ. */
const ACTIVE_ALLOCATION_STATUSES = [
  ParkingAllocationStatus.HELD,
  ParkingAllocationStatus.CONFIRMED,
  ParkingAllocationStatus.IN_USE,
];

export const hubRepository = {
  findAll(conn: DbOrTx = db): Hub[] {
    return conn.select().from(hubs).orderBy(hubs.name).all();
  },

  findById(id: string, conn: DbOrTx = db): Hub | undefined {
    return conn.select().from(hubs).where(eq(hubs.id, id)).get();
  },

  listSlots(hubId?: string, conn: DbOrTx = db): ParkingSlot[] {
    const q = conn.select().from(parkingSlots);
    return hubId ? q.where(eq(parkingSlots.hubId, hubId)).all() : q.all();
  },

  listVehicles(hubId?: string, conn: DbOrTx = db): SharedVehicle[] {
    const q = conn.select().from(sharedVehicles);
    return hubId ? q.where(eq(sharedVehicles.hubId, hubId)).orderBy(sharedVehicles.code).all() : q.all();
  },

  /** Cổng sạc kèm hubId (lấy qua vị trí đỗ chứa cổng). */
  listPortsWithHub(conn: DbOrTx = db): Array<ChargingPort & { hubId: string }> {
    return conn
      .select({ port: chargingPorts, hubId: parkingSlots.hubId })
      .from(chargingPorts)
      .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
      .all()
      .map((row) => ({ ...row.port, hubId: row.hubId }));
  },

  /** Phân bổ chỗ đỗ đang có hiệu lực tại thời điểm `at`. */
  listActiveAllocationsAt(at: Date, conn: DbOrTx = db): ParkingAllocation[] {
    return conn
      .select()
      .from(parkingAllocations)
      .where(
        and(
          inArray(parkingAllocations.status, ACTIVE_ALLOCATION_STATUSES),
          lte(parkingAllocations.startTime, at),
          gt(parkingAllocations.endTime, at),
        ),
      )
      .all();
  },

  touch(hubId: string, at: Date, conn: DbOrTx = db): void {
    conn.update(hubs).set({ lastUpdatedAt: at }).where(eq(hubs.id, hubId)).run();
  },
};
