// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm)
import { and, eq, gt, inArray, lte } from "drizzle-orm";
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
import { db } from "../lib/db";

/** Repository CHỈ truy cập dữ liệu, không chứa nghiệp vụ. */
export const hubRepository = {
  findAll(): Hub[] {
    return db.select().from(hubs).orderBy(hubs.name).all();
  },

  findById(id: string): Hub | undefined {
    return db.select().from(hubs).where(eq(hubs.id, id)).get();
  },

  listSlots(): ParkingSlot[] {
    return db.select().from(parkingSlots).all();
  },

  listVehicles(hubId?: string): SharedVehicle[] {
    if (hubId) {
      return db.select().from(sharedVehicles).where(eq(sharedVehicles.hubId, hubId)).orderBy(sharedVehicles.code).all();
    }
    return db.select().from(sharedVehicles).all();
  },

  /** Cổng sạc kèm hubId (lấy qua vị trí đỗ chứa cổng). */
  listPortsWithHub(): Array<ChargingPort & { hubId: string }> {
    const rows = db
      .select({ port: chargingPorts, hubId: parkingSlots.hubId })
      .from(chargingPorts)
      .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
      .all();
    return rows.map((row) => ({ ...row.port, hubId: row.hubId }));
  },

  /** Phân bổ chỗ đỗ đang chiếm chỗ (giữ tạm / đã xác nhận / đang dùng) tại thời điểm `at`. */
  listActiveAllocationsAt(at: Date): ParkingAllocation[] {
    return db
      .select()
      .from(parkingAllocations)
      .where(
        and(
          inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
          lte(parkingAllocations.startTime, at),
          gt(parkingAllocations.endTime, at),
        ),
      )
      .all();
  },
};
