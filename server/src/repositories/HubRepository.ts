// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm); Nguyễn Hoàng Nhân – UC10 (queryHubReservations)
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import {
  chargingPorts,
  hubs,
  parkingAllocations,
  parkingSlots,
  sharedVehicles,
  type Hub,
  type ParkingAllocation,
  type ParkingSlot,
  type SharedVehicle,
} from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";
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

  /** Mục 2.3.3 / UC10: phân bổ chỗ đỗ của Hub chồng lấn khoảng thời gian đánh giá (HELD còn hạn, CONFIRMED, IN_USE). */
  listAllocationsOverlapping(hubId: string, timeRange: TimeRange): ParkingAllocation[] {
    throw notImplemented("HubRepository.listAllocationsOverlapping");
  },

  /** UC10 bước 3: các lượt đặt xe, đặt chỗ, lịch sạc còn hiệu lực tại Hub để Operator xem. */
  queryHubReservations(hubId: string, now: Date): HubReservations {
    throw notImplemented("HubRepository.queryHubReservations");
  },
};
