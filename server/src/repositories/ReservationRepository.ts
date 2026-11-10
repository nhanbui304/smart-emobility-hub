// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
import type { Hub, SharedVehicle, VehicleReservation } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const reservationRepository = {
  /** UC02: xe AVAILABLE tại Hub, pin >= ngưỡng có thể đặt. */
  findReservableVehicles(hubId: string, minBattery: number): SharedVehicle[] {
    throw notImplemented("ReservationRepository.findReservableVehicles (UC02)");
  },

  /** Đặt xe còn hiệu lực của sinh viên (để chặn đặt 2 xe cùng lúc). */
  findActiveByStudent(studentId: string): VehicleReservation | undefined {
    throw notImplemented("ReservationRepository.findActiveByStudent (UC02)");
  },

  findById(reservationId: string): VehicleReservation | undefined {
    throw notImplemented("ReservationRepository.findById");
  },

  /**
   * UC02 bước 3 (loadReservationContext): xe, Hub và đặt xe còn hiệu lực của sinh viên
   * để kiểm tra sơ bộ trước khi hiển thị xác nhận.
   */
  loadReservationContext(
    studentId: string,
    hubId: string,
    vehicleId: string,
  ): { vehicle: SharedVehicle | undefined; hub: Hub | undefined; activeReservation: VehicleReservation | undefined } {
    throw notImplemented("ReservationRepository.loadReservationContext (UC02)");
  },

  /** UC02 Ext 8a: đặt xe đã tạo từ requestId (tra processed_requests). */
  findByRequestId(studentId: string, requestId: string): VehicleReservation | undefined {
    throw notImplemented("ReservationRepository.findByRequestId (UC02)");
  },

  /**
   * UC02 – chạy bên trong db.transaction. requestId đã có trong processed_requests → trả đặt xe cũ. Kiểm tra lại xe còn AVAILABLE và sinh viên chưa có đặt xe khác,
   * rồi tạo VehicleReservation (RESERVED) + chuyển xe sang RESERVED + ghi processed_requests trong cùng transaction.
   */
  atomicReserveVehicle(input: {
    requestId: string;
    studentId: string;
    hubId: string;
    vehicleId: string;
    pickupDeadline: Date;
    now: Date;
  }): VehicleReservation {
    throw notImplemented("ReservationRepository.atomicReserveVehicle (UC02)");
  },

  /**
   * UC03 – chạy bên trong db.transaction. Kiểm tra đặt xe còn RESERVED và thuộc sinh viên,
   * chuyển sang CANCELLED và trả xe về AVAILABLE.
   */
  atomicCancelReservation(input: { studentId: string; reservationId: string; now: Date }): VehicleReservation {
    throw notImplemented("ReservationRepository.atomicCancelReservation (UC03)");
  },
};
