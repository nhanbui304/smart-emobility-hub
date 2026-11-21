// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import type { RequestOperation } from "../constants";
import type { SharedVehicle, User, VehicleReservation } from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import { myReservationsRepository } from "../repositories/MyReservationsRepository";
import { reservationRepository } from "../repositories/ReservationRepository";
import type { CancellationPreview, ReservationPreview } from "../types/dto";

export const reservationService = {
  /** UC02 bước 2: danh sách xe có thể đặt tại Hub. */
  async getReservableVehicles(studentId: string, hubId: string): Promise<SharedVehicle[]> {
    return reservationRepository.queryReservableVehicles(hubId, systemConfig.reservableBatteryThreshold, new Date());
  },

  /** UC02 bước 3: kiểm tra sơ bộ và hiển thị thông tin xác nhận (chưa ghi dữ liệu). */
  async prepareReservation(studentId: string, hubId: string, vehicleId: string): Promise<ReservationPreview> {
    const now = new Date();
    const context = reservationRepository.loadReservationContext(studentId, vehicleId);
    if (!checkStudentEligibility(context.student)) {
      throw new AppError("FORBIDDEN", "Tài khoản của bạn không có quyền sử dụng dịch vụ xe dùng chung.");
    }
    if (myReservationsRepository.findActiveVehicleReservations(studentId).length > 0) {
      throw new AppError("CONFLICT", "Bạn đang có một đặt xe còn hiệu lực. Hãy nhận hoặc hủy đặt xe đó trước.");
    }
    // Danh sách "xe có thể đặt" đã gồm mọi điều kiện: đúng Hub, AVAILABLE, đủ pin, không bị khóa điều chuyển.
    const reservable = reservationRepository.queryReservableVehicles(hubId, systemConfig.reservableBatteryThreshold, now);
    if (!reservable.some((v) => v.id === vehicleId)) {
      throw new AppError("CONFLICT", "Xe không còn khả dụng hoặc không đủ điều kiện phục vụ. Vui lòng chọn xe khác.");
    }
    return {
      hubId,
      vehicle: context.vehicle,
      pickupDeadline: new Date(now.getTime() + systemConfig.pickupDeadlineMinutes * 60_000),
    };
  },

  /**
   * UC02 bước 4–6: xác nhận đặt xe.
   * Gửi lặp cùng requestId → trả kết quả cũ. Kiểm tra lại điều kiện và ghi trong CÙNG một transaction
   * nên hai sinh viên bấm cùng lúc thì chỉ một người đặt được.
   */
  async confirmReservation(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
  ): Promise<VehicleReservation> {
    const recorded = findRecordedReservation(requestId, studentId, "RESERVE_VEHICLE");
    if (recorded) return recorded;

    return db.transaction(() => {
      const context = reservationRepository.loadReservationContext(studentId, vehicleId);
      if (!checkStudentEligibility(context.student)) {
        throw new AppError("FORBIDDEN", "Tài khoản của bạn không có quyền sử dụng dịch vụ xe dùng chung.");
      }
      if (context.vehicle.hubId !== hubId) {
        throw new AppError("CONFLICT", "Xe không còn ở Hub đã chọn. Vui lòng chọn lại.");
      }
      if (!checkVehicleServiceability(context.vehicle)) {
        const taken = context.vehicle.status === "RESERVED";
        throw new AppError(
          "CONFLICT",
          taken
            ? "Xe vừa được người khác đặt, vui lòng chọn xe khác."
            : "Xe không còn khả dụng hoặc không đủ điều kiện phục vụ. Vui lòng chọn xe khác.",
        );
      }
      return reservationRepository.atomicReserveVehicle(
        requestId,
        studentId,
        hubId,
        vehicleId,
        systemConfig.pickupDeadlineMinutes,
        new Date(),
      );
    });
  },

  /** UC02 bước 8a: lấy lại kết quả khi mất kết nối sau lúc đặt xe. */
  async getReservationResult(requestId: string, studentId: string): Promise<VehicleReservation> {
    const recorded = findRecordedReservation(requestId, studentId, "RESERVE_VEHICLE");
    if (!recorded) throw new AppError("NOT_FOUND", "Chưa có kết quả cho yêu cầu đặt xe này.");
    return recorded;
  },

  /** UC03 bước 2–4: kiểm tra quyền sở hữu, điều kiện hủy và hiển thị thông tin trước khi hủy. */
  async prepareCancellation(studentId: string, reservationId: string): Promise<CancellationPreview> {
    const now = new Date();
    const reservation = reservationRepository.findReservationForCancellation(reservationId);
    if (!checkReservationOwnership(reservation, studentId)) {
      throw new AppError("FORBIDDEN", "Đặt xe này không thuộc về bạn.");
    }
    const allowed = checkCancellationEligibility(reservation, now);
    return {
      reservation,
      cancellationAllowed: allowed,
      message: allowed
        ? "Sau khi hủy, xe sẽ không còn được giữ cho bạn."
        : describeCancellationBlock(reservation, now),
    };
  },

  /** UC03 bước 5–7: hủy đặt xe, trả xe về AVAILABLE (nếu xe còn đủ điều kiện) trong một transaction. */
  async confirmCancellation(requestId: string, studentId: string, reservationId: string): Promise<VehicleReservation> {
    const recorded = findRecordedReservation(requestId, studentId, "CANCEL_VEHICLE_RESERVATION");
    if (recorded) return recorded;

    return db.transaction(() => {
      const now = new Date();
      const reservation = reservationRepository.findReservationForCancellation(reservationId);
      if (!checkReservationOwnership(reservation, studentId)) {
        throw new AppError("FORBIDDEN", "Đặt xe này không thuộc về bạn.");
      }
      if (!checkCancellationEligibility(reservation, now)) {
        throw new AppError("CONFLICT", describeCancellationBlock(reservation, now));
      }
      return reservationRepository.atomicCancelReservation(requestId, studentId, reservationId, now);
    });
  },

  /** UC03 bước 7b: lấy lại kết quả hủy khi mất kết nối. */
  async getCancellationResult(requestId: string, studentId: string): Promise<VehicleReservation> {
    const recorded = findRecordedReservation(requestId, studentId, "CANCEL_VEHICLE_RESERVATION");
    if (!recorded) throw new AppError("NOT_FOUND", "Chưa có kết quả cho yêu cầu hủy này.");
    return recorded;
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram: sinh viên có quyền dùng dịch vụ xe dùng chung. */
function checkStudentEligibility(studentContext: User): boolean {
  return studentContext.role === "STUDENT";
}

/** private (–) trong class diagram: xe đang AVAILABLE và đủ ngưỡng pin để đặt. */
function checkVehicleServiceability(vehicleContext: SharedVehicle): boolean {
  return (
    vehicleContext.status === "AVAILABLE" && vehicleContext.batteryLevel >= systemConfig.reservableBatteryThreshold
  );
}

/** private (–) trong class diagram: chỉ hủy được đặt xe còn RESERVED và chưa quá hạn nhận. */
function checkCancellationEligibility(reservation: VehicleReservation, now: Date): boolean {
  return reservation.status === "RESERVED" && reservation.pickupDeadline.getTime() > now.getTime();
}

/** private (–) trong class diagram. */
function checkReservationOwnership(reservation: VehicleReservation, studentId: string): boolean {
  return reservation.studentId === studentId;
}

// ---------- Hàm phụ (không có trong sơ đồ) ----------

/** Lý do không hủy được, theo các nhánh 3a–3d của UC03. */
function describeCancellationBlock(reservation: VehicleReservation, now: Date): string {
  switch (reservation.status) {
    case "CANCELLED":
      return "Đặt xe này đã được hủy trước đó.";
    case "EXPIRED":
      return "Đặt xe đã hết hạn nhận xe nên không cần hủy.";
    case "USED":
      return "Xe đã được nhận. Hãy dùng chức năng trả xe để kết thúc chuyến đi.";
    case "HANDING_OVER":
    case "PENDING_VERIFICATION":
      return "Đang bàn giao hoặc chưa rõ kết quả mở khóa, tạm thời không thể hủy. Cần xác minh việc nhận xe trước.";
    default:
      return reservation.pickupDeadline.getTime() <= now.getTime()
        ? "Đặt xe đã quá hạn nhận xe; hệ thống sẽ tự giải phóng xe."
        : "Đặt xe không còn ở trạng thái có thể hủy.";
  }
}

/**
 * Chống gửi lặp: requestId đã xử lý thì trả đúng kết quả cũ.
 * requestId của người khác hoặc của thao tác khác bị từ chối.
 */
function findRecordedReservation(
  requestId: string,
  studentId: string,
  operation: RequestOperation,
): VehicleReservation | undefined {
  const done = reservationRepository.findProcessedRequest(requestId);
  if (!done) return undefined;
  if (done.actorId !== studentId) throw new AppError("FORBIDDEN", "Mã yêu cầu không thuộc về bạn.");
  if (done.operation !== operation) throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho một thao tác khác.");
  return reservationRepository.findById(done.resultId);
}
