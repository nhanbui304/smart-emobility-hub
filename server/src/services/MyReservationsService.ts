// Owner: Lê Quốc Linh – View My Reservations
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { myReservationsRepository } from "../repositories/MyReservationsRepository";
import type { MyReservationsResult } from "../types/dto";

export const myReservationsService = {
  /**
   * View My Reservations: gom các đặt chỗ còn hiệu lực của sinh viên (xe, chỗ đỗ, lịch sạc),
   * sắp xếp theo thời gian gần nhất. Chỉ trả dữ liệu của chính sinh viên đang đăng nhập.
   */
  async getMyReservations(studentId: string): Promise<MyReservationsResult> {
    const vehicleReservations = myReservationsRepository
      .findActiveVehicleReservations(studentId)
      .sort((a, b) => a.pickupDeadline.getTime() - b.pickupDeadline.getTime());
    const parkingAllocations = myReservationsRepository
      .findActiveParkingAllocations(studentId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const chargingReservations = myReservationsRepository
      .findActiveChargingReservations(studentId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    return { vehicleReservations, parkingAllocations, chargingReservations };
  },
};
