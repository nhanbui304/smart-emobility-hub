// Owner: Lê Quốc Linh – View My Reservations
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq, inArray } from "drizzle-orm";
import type { ChargingReservationStatus, ParkingAllocationStatus, VehicleReservationStatus } from "../constants";
import {
  chargingReservations,
  parkingAllocations,
  vehicleReservations,
  type ChargingReservation,
  type ParkingAllocation,
  type VehicleReservation,
} from "../db/schema";
import { db } from "../lib/db";

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
  findActiveParkingAllocations(studentId: string): ParkingAllocation[] {
    const now = Date.now();
    return db
      .select()
      .from(parkingAllocations)
      .where(and(eq(parkingAllocations.studentId, studentId), inArray(parkingAllocations.status, ACTIVE_PARKING)))
      .all()
      .filter((a) => a.status !== "HELD" || !a.holdExpiresAt || a.holdExpiresAt.getTime() > now);
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
