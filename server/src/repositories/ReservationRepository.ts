// Owner: Lê Quốc Linh – UC02, UC03, mục 2.3.2
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ProcessedRequest, SharedVehicle, VehicleReservation } from "../db/schema";
import type { ReservationContext } from "../types/dto";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const reservationRepository = {
  queryReservableVehicles(hubId: string, reservableBatteryThreshold: number, now: Date): SharedVehicle[] {
    throw notImplemented("ReservationRepository.queryReservableVehicles");
  },

  findById(reservationId: string): VehicleReservation | undefined {
    throw notImplemented("ReservationRepository.findById");
  },

  loadReservationContext(studentId: string, vehicleId: string): ReservationContext {
    throw notImplemented("ReservationRepository.loadReservationContext");
  },

  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    throw notImplemented("ReservationRepository.findProcessedRequest");
  },

  /**
   * UC02 – chạy bên trong db.transaction. Kiểm tra lại xe còn AVAILABLE và sinh viên chưa có đặt xe khác,
   * rồi tạo VehicleReservation (RESERVED) + chuyển xe sang RESERVED trong cùng transaction.
   */
  atomicReserveVehicle(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
    pickupDeadlineDuration: number,
    now: Date,
  ): VehicleReservation {
    throw notImplemented("ReservationRepository.atomicReserveVehicle");
  },

  findReservationForCancellation(reservationId: string): VehicleReservation {
    throw notImplemented("ReservationRepository.findReservationForCancellation");
  },

  /**
   * UC03 – chạy bên trong db.transaction. Kiểm tra đặt xe còn RESERVED và thuộc sinh viên,
   * chuyển sang CANCELLED và trả xe về AVAILABLE.
   */
  atomicCancelReservation(requestId: string, studentId: string, reservationId: string, now: Date): VehicleReservation {
    throw notImplemented("ReservationRepository.atomicCancelReservation");
  },
};
