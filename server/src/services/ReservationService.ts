// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
import type { SharedVehicle, VehicleReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface ReservationPreview {
  hubId: string;
  vehicle: SharedVehicle;
  pickupDeadline: Date;
}

export const reservationService = {
  /** UC02 bước 2: danh sách xe có thể đặt tại Hub. */
  async getReservableVehicles(studentId: string, hubId: string): Promise<SharedVehicle[]> {
    throw notImplemented("ReservationService.getReservableVehicles (UC02)");
  },

  /** UC02 bước 3: kiểm tra sơ bộ và hiển thị thông tin xác nhận (chưa ghi dữ liệu). */
  async prepareReservation(studentId: string, hubId: string, vehicleId: string): Promise<ReservationPreview> {
    throw notImplemented("ReservationService.prepareReservation (UC02)");
  },

  /**
   * UC02 bước 4–6: xác nhận đặt xe.
   * TODO: return db.transaction(() => reservationRepository.atomicReserveVehicle({...}))
   */
  async confirmReservation(studentId: string, hubId: string, vehicleId: string): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.confirmReservation (UC02)");
  },

  /** UC03: hủy đặt xe trước khi nhận. */
  async cancelReservation(studentId: string, reservationId: string): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.cancelReservation (UC03)");
  },
};
