// Owner: Lê Quốc Linh – View My Reservations
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, inArray } from "drizzle-orm";
import type { ChargingReservationStatus, ParkingAllocationStatus, VehicleReservationStatus } from "../constants";
import {
  chargingReservations,
  hubs,
  parkingAllocations,
  parkingSlots,
  vehicleReservations,
  type ChargingReservation,
  type VehicleReservation,
} from "../db/schema";
import { db } from "../lib/db";
import type { MyReservationsResult } from "../types/dto";

const ACTIVE_VEHICLE: VehicleReservationStatus[] = ["RESERVED", "HANDING_OVER", "PENDING_VERIFICATION"];
const ACTIVE_PARKING: ParkingAllocationStatus[] = ["HELD", "CONFIRMED", "IN_USE"];
const ACTIVE_CHARGING: ChargingReservationStatus[] = ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"];

export const myReservationsRepository = {
  /** Đặt xe dùng chung còn hiệu lực (RESERVED / HANDING_OVER / PENDING_VERIFICATION) của sinh viên. */
  findActiveVehicleReservations(studentId: string): VehicleReservation[] {
    return db
      .select()
      .from(vehicleReservations)
      .where(and(eq(vehicleReservations.studentId, studentId), inArray(vehicleReservations.status, ACTIVE_VEHICLE)))
      .all();
  },

  /** Giữ chỗ / đặt chỗ đỗ còn hiệu lực (HELD / CONFIRMED / IN_USE). Lượt giữ tạm đã quá hạn thì không tính. */
  findActiveParkingAllocations(studentId: string): MyReservationsResult["parkingAllocations"] {
    const now = Date.now();
    return db
      .select({ allocation: parkingAllocations, slotCode: parkingSlots.code, hubName: hubs.name })
      .from(parkingAllocations)
      .innerJoin(parkingSlots, eq(parkingSlots.id, parkingAllocations.slotId))
      .innerJoin(hubs, eq(hubs.id, parkingSlots.hubId))
      .where(and(eq(parkingAllocations.studentId, studentId), inArray(parkingAllocations.status, ACTIVE_PARKING)))
      .all()
      .map(({ allocation, slotCode, hubName }) => ({ ...allocation, slotCode, hubName }))
      .filter((a) => a.status === "IN_USE"
        || (a.status === "HELD" && a.holdExpiresAt && a.holdExpiresAt.getTime() > now)
        || (a.status === "CONFIRMED" && a.endTime.getTime() > now));
  },

  /** Lịch sạc còn hiệu lực (CONFIRMED / CHARGING / AWAITING_DISCONNECT). */
  findActiveChargingReservations(studentId: string): ChargingReservation[] {
    return db
      .select()
      .from(chargingReservations)
      .where(and(eq(chargingReservations.studentId, studentId), inArray(chargingReservations.status, ACTIVE_CHARGING)))
      .all();
  },
};
