// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Sequence Sub #2 gọi chung là OperationalRepository; trong code tách theo nghiệp vụ (xem bảng ánh xạ trong báo cáo).
import type { SharedVehicle, Trip, VehicleReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";

export const pickUpRepository = {
  /** UC04 bước 2 (loadPickUpContext): đặt xe kèm xe dùng chung. */
  loadPickUpContext(
    studentId: string,
    reservationId: string,
  ): { reservation: VehicleReservation; vehicle: SharedVehicle } | undefined {
    throw notImplemented("PickUpRepository.loadPickUpContext (UC04)");
  },

  /** UC04 Ext 3a (expireReservation): quá hạn nhận → đặt xe EXPIRED, xe về AVAILABLE. */
  expireReservation(input: { reservationId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.expireReservation (UC04)");
  },

  /** UC04 Ext 4b (markReservationAffected): xe không dùng được (pin thấp / sự cố) → đặt xe bị ảnh hưởng, gợi ý xe khác. */
  markReservationAffected(input: { reservationId: string; reason: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.markReservationAffected (UC04)");
  },

  /**
   * UC04 bước 5 – trong db.transaction, TRƯỚC khi gọi thiết bị: requestId đã xử lý → trả kết quả cũ;
   * kiểm tra đặt xe RESERVED, còn hạn, pin >= ngưỡng nhận; chuyển đặt xe + xe sang HANDING_OVER.
   */
  atomicBeginHandover(input: { requestId: string; studentId: string; reservationId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.atomicBeginHandover (UC04)");
  },

  /**
   * UC04 bước 7 – SAU khi thiết bị mở khóa SUCCESS: tạo Trip ACTIVE, đặt xe USED, xe IN_USE; ghi processed_requests.
   * Chưa giải phóng chỗ đỗ (theo sequence): chỗ đỗ được cập nhật khi trả xe (UC05).
   */
  atomicStartTrip(input: { requestId: string; studentId: string; reservationId: string; now: Date }): Trip {
    throw notImplemented("PickUpRepository.atomicStartTrip (UC04)");
  },

  /** UC04 Ext 7a (endHandoverAndResolveHold): mở khóa FAILED → kết thúc bàn giao, đặt xe về RESERVED nếu còn hạn. */
  endHandoverAndResolveHold(input: { reservationId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.endHandoverAndResolveHold (UC04)");
  },

  /** UC04 Ext 6b – thiết bị trả UNKNOWN: đánh dấu PENDING_VERIFICATION để Operator xác minh. */
  markPendingVerification(input: { reservationId: string; vehicleId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.markPendingVerification (UC04)");
  },

  /** UC04 Ext 8a (markReconciliationRequired): đã mở khóa nhưng ghi chuyến đi thất bại → chờ đối soát. */
  markReconciliationRequired(input: { reservationId: string; vehicleId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.markReconciliationRequired (UC04)");
  },

  /** UC04 Ext 9a: kết quả đã ghi theo requestId. */
  findResultByRequestId(studentId: string, requestId: string): { reservation: VehicleReservation; trip?: Trip } | undefined {
    throw notImplemented("PickUpRepository.findResultByRequestId (UC04)");
  },
};
