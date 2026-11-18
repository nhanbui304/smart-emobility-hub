// Owner: Lê Quốc Linh – View My Reservations
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingReservation, ParkingAllocation, VehicleReservation } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const myReservationsRepository = {
  /** Đặt xe dùng chung còn hiệu lực (RESERVED / HANDING_OVER / PENDING_VERIFICATION) của sinh viên. */
  findActiveVehicleReservations(studentId: string): VehicleReservation[] {
    throw notImplemented("MyReservationsRepository.findActiveVehicleReservations");
  },

  /** Giữ chỗ / đặt chỗ đỗ còn hiệu lực (HELD / CONFIRMED / IN_USE). */
  findActiveParkingAllocations(studentId: string): ParkingAllocation[] {
    throw notImplemented("MyReservationsRepository.findActiveParkingAllocations");
  },

  /** Lịch sạc còn hiệu lực (CONFIRMED / CHARGING / AWAITING_DISCONNECT). */
  findActiveChargingReservations(studentId: string): ChargingReservation[] {
    throw notImplemented("MyReservationsRepository.findActiveChargingReservations");
  },
};
