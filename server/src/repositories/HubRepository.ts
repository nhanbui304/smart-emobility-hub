// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm); Nguyễn Hoàng Nhân – UC10 (queryHubReservations)
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, gt, inArray, lt, lte } from "drizzle-orm";
import {
  chargingPorts,
  chargingReservations,
  hubs,
  incidents,
  parkingAllocations,
  parkingSlots,
  redistributionItems,
  sharedVehicles,
  vehicleReservations,
  type Hub,
  type ParkingAllocation,
  type ParkingSlot,
  type SharedVehicle,
} from "../db/schema";
import { db } from "../lib/db";
import type { TimeRange } from "../lib/schemas";
import type { HubReservations, PortWithHub } from "../types/dto";

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

  listVehicleIdsWithOpenIncidents(): string[] {
    return db
      .select({ id: incidents.resourceId })
      .from(incidents)
      .where(and(eq(incidents.resourceType, "SHARED_VEHICLE"), inArray(incidents.status, ["OPEN", "IN_PROGRESS"])))
      .all()
      .map((row) => row.id);
  },

  listVehicleIdsInRedistribution(): string[] {
    return db
      .select({ id: redistributionItems.vehicleId })
      .from(redistributionItems)
      .where(inArray(redistributionItems.status, ["PENDING", "IN_TRANSIT"]))
      .all()
      .map((row) => row.id);
  },

  /** Cổng sạc kèm hubId (lấy qua vị trí đỗ chứa cổng). */
  listPortsWithHub(): PortWithHub[] {
    return db
      .select({ port: chargingPorts, hubId: parkingSlots.hubId })
      .from(chargingPorts)
      .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
      .all();
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

  /**
   * Mục 2.3.3 / UC10: phân bổ chỗ đỗ của Hub chồng lấn khoảng thời gian đánh giá
   * (HELD còn hạn, CONFIRMED, IN_USE).
   * Điều kiện hai khoảng [startTime, endTime) và [range.startTime, range.endTime) giao nhau:
   * allocation.startTime < range.endTime && allocation.endTime > range.startTime.
   */
  listAllocationsOverlapping(hubId: string, timeRange: TimeRange): ParkingAllocation[] {
    const rows = db
      .select({ allocation: parkingAllocations })
      .from(parkingAllocations)
      .innerJoin(parkingSlots, eq(parkingAllocations.slotId, parkingSlots.id))
      .where(
        and(
          eq(parkingSlots.hubId, hubId),
          inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
          lt(parkingAllocations.startTime, timeRange.endTime),
          gt(parkingAllocations.endTime, timeRange.startTime),
        ),
      )
      .all();

    return rows
      .map((r) => r.allocation)
      .filter((a) => {
        if (a.status === "HELD" && a.holdExpiresAt) {
          return a.holdExpiresAt > timeRange.startTime;
        }
        return true;
      });
  },

  /**
   * UC10 bước 6: các lượt đặt xe, đặt chỗ, lịch sạc còn hiệu lực tại Hub để Operator xem chi tiết.
   */
  queryHubReservations(hubId: string, now: Date): HubReservations {
    // 1. Các đặt xe dùng chung còn hiệu lực tại Hub
    const activeVehicleReservations = db
      .select()
      .from(vehicleReservations)
      .where(
        and(
          eq(vehicleReservations.hubId, hubId),
          inArray(vehicleReservations.status, ["RESERVED", "HANDING_OVER", "PENDING_VERIFICATION"]),
        ),
      )
      .all()
      .filter((vr) => vr.status !== "RESERVED" || vr.pickupDeadline > now);

    // 2. Các lượt giữ tạm / đặt chỗ đỗ còn hiệu lực tại Hub
    const activeParkingRows = db
      .select({ allocation: parkingAllocations })
      .from(parkingAllocations)
      .innerJoin(parkingSlots, eq(parkingAllocations.slotId, parkingSlots.id))
      .where(
        and(
          eq(parkingSlots.hubId, hubId),
          inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
          gt(parkingAllocations.endTime, now),
        ),
      )
      .all();

    const activeParkingAllocations = activeParkingRows
      .map((r) => r.allocation)
      .filter((pa) => pa.status !== "HELD" || !pa.holdExpiresAt || pa.holdExpiresAt > now);

    // 3. Các lịch sạc xe cá nhân còn hiệu lực tại các cổng sạc thuộc Hub
    const activeChargingRows = db
      .select({ reservation: chargingReservations })
      .from(chargingReservations)
      .innerJoin(chargingPorts, eq(chargingReservations.portId, chargingPorts.id))
      .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
      .where(
        and(
          eq(parkingSlots.hubId, hubId),
          inArray(chargingReservations.status, ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"]),
          gt(chargingReservations.endTime, now),
        ),
      )
      .all();

    return {
      vehicleReservations: activeVehicleReservations,
      parkingAllocations: activeParkingAllocations,
      chargingReservations: activeChargingRows.map((r) => r.reservation),
    };
  },
};
