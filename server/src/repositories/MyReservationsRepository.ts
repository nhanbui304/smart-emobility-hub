// Owner: Lê Quốc Linh – View My Reservations
import type { ChargingReservation, ParkingAllocation, VehicleReservation } from "../db/schema";
import { db, type DbOrTx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const myReservationsRepository = {
  /** Đặt xe dùng chung còn hiệu lực (RESERVED / HANDING_OVER / PENDING_VERIFICATION) của sinh viên. */
  findActiveVehicleReservations(studentId: string, conn: DbOrTx = db): VehicleReservation[] {
    throw notImplemented("MyReservationsRepository.findActiveVehicleReservations");
  },

  /** Giữ chỗ / đặt chỗ đỗ còn hiệu lực (HELD / CONFIRMED / IN_USE). */
  findActiveParkingAllocations(studentId: string, conn: DbOrTx = db): ParkingAllocation[] {
    throw notImplemented("MyReservationsRepository.findActiveParkingAllocations");
  },

  /** Lịch sạc còn hiệu lực (CONFIRMED / CHARGING / AWAITING_DISCONNECT). */
  findActiveChargingReservations(studentId: string, conn: DbOrTx = db): ChargingReservation[] {
    throw notImplemented("MyReservationsRepository.findActiveChargingReservations");
  },
};
