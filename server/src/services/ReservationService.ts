// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { SharedVehicle, User, VehicleReservation } from "../db/schema";
import type { CancellationPreview, ReservationPreview } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const reservationService = {
  /** UC02 bước 2: danh sách xe có thể đặt tại Hub. */
  async getReservableVehicles(studentId: string, hubId: string): Promise<SharedVehicle[]> {
    throw notImplemented("ReservationService.getReservableVehicles");
  },

  /** UC02 bước 3: kiểm tra sơ bộ và hiển thị thông tin xác nhận (chưa ghi dữ liệu). */
  async prepareReservation(studentId: string, hubId: string, vehicleId: string): Promise<ReservationPreview> {
    throw notImplemented("ReservationService.prepareReservation");
  },

  /**
   * UC02 bước 4–6: xác nhận đặt xe.
   * TODO: return db.transaction(() => reservationRepository.atomicReserveVehicle({...}))
   */
  async confirmReservation(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
  ): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.confirmReservation");
  },

  async getReservationResult(requestId: string, studentId: string): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.getReservationResult");
  },

  async prepareCancellation(studentId: string, reservationId: string): Promise<CancellationPreview> {
    throw notImplemented("ReservationService.prepareCancellation");
  },

  async confirmCancellation(requestId: string, studentId: string, reservationId: string): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.confirmCancellation");
  },

  async getCancellationResult(requestId: string, studentId: string): Promise<VehicleReservation> {
    throw notImplemented("ReservationService.getCancellationResult");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function checkStudentEligibility(studentContext: User): boolean {
  throw notImplemented("ReservationService.checkStudentEligibility");
}

/** private (–) trong class diagram. */
function checkVehicleServiceability(vehicleContext: SharedVehicle): boolean {
  throw notImplemented("ReservationService.checkVehicleServiceability");
}

/** private (–) trong class diagram. */
function checkCancellationEligibility(reservation: VehicleReservation, now: Date): boolean {
  throw notImplemented("ReservationService.checkCancellationEligibility");
}

/** private (–) trong class diagram. */
function checkReservationOwnership(reservation: VehicleReservation, studentId: string): boolean {
  throw notImplemented("ReservationService.checkReservationOwnership");
}
