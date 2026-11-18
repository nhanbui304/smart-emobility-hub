// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { DeviceCommandResult } from "../constants";
import type { ProcessedRequest, Trip, VehicleReservation } from "../db/schema";
import type { PickUpContext } from "../types/dto";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const pickUpRepository = {
  loadPickUpContext(reservationId: string, now: Date): PickUpContext {
    throw notImplemented("PickUpRepository.loadPickUpContext");
  },

  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    throw notImplemented("PickUpRepository.findProcessedRequest");
  },

  expireReservation(reservationId: string, now: Date): VehicleReservation {
    throw notImplemented("PickUpRepository.expireReservation");
  },

  markReservationAffected(reservationId: string): VehicleReservation {
    throw notImplemented("PickUpRepository.markReservationAffected");
  },

  /**
   * UC04 – trong db.transaction, TRƯỚC khi gọi thiết bị: kiểm tra đặt xe RESERVED, còn hạn, pin >= ngưỡng nhận;
   * chuyển đặt xe + xe sang HANDING_OVER.
   */
  atomicBeginHandover(requestId: string, studentId: string, reservationId: string, now: Date): VehicleReservation {
    throw notImplemented("PickUpRepository.atomicBeginHandover");
  },

  endHandoverAndResolveHold(reservationId: string, now: Date): VehicleReservation {
    throw notImplemented("PickUpRepository.endHandoverAndResolveHold");
  },

  /** UC04 – thiết bị trả UNKNOWN: đánh dấu PENDING_VERIFICATION để Operator xác minh. */
  markPendingVerification(reservationId: string, vehicleId: string, now: Date): VehicleReservation {
    throw notImplemented("PickUpRepository.markPendingVerification");
  },

  /** UC04 – SAU khi thiết bị mở khóa SUCCESS: tạo Trip ACTIVE, đặt xe USED, xe IN_USE, giải phóng vị trí đỗ. */
  atomicStartTrip(requestId: string, reservationId: string, vehicleId: string, startTime: Date): Trip {
    throw notImplemented("PickUpRepository.atomicStartTrip");
  },

  markReconciliationRequired(
    reservationId: string,
    vehicleId: string,
    unlockEvidence: DeviceCommandResult,
  ): VehicleReservation {
    throw notImplemented("PickUpRepository.markReconciliationRequired");
  },
};
