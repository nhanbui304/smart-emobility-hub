// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
import type { Trip, VehicleReservation } from "../db/schema";
import type { Tx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const pickUpRepository = {
  /**
   * UC04 – trong runIdempotent, TRƯỚC khi gọi thiết bị: kiểm tra đặt xe RESERVED, còn hạn, pin >= ngưỡng nhận;
   * chuyển đặt xe + xe sang HANDING_OVER.
   */
  atomicBeginHandover(tx: Tx, input: { studentId: string; reservationId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.atomicBeginHandover (UC04)");
  },

  /** UC04 – SAU khi thiết bị mở khóa SUCCESS: tạo Trip ACTIVE, đặt xe USED, xe IN_USE, giải phóng vị trí đỗ. */
  atomicStartTrip(tx: Tx, input: { studentId: string; reservationId: string; now: Date }): Trip {
    throw notImplemented("PickUpRepository.atomicStartTrip (UC04)");
  },

  /** UC04 – thiết bị trả UNKNOWN: đánh dấu PENDING_VERIFICATION để Operator xác minh. */
  markPendingVerification(tx: Tx, input: { reservationId: string; now: Date }): VehicleReservation {
    throw notImplemented("PickUpRepository.markPendingVerification (UC04)");
  },
};
