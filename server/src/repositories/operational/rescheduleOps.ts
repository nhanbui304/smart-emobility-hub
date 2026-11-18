// Owner: Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingReservation } from "../../db/schema";
import type { CancellationResult, RescheduleResult } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const rescheduleOps = {
  findReservation(reservationId: string): ChargingReservation | undefined {
    throw notImplemented("OperationalRepository.findReservation");
  },

  /**
   * UC09 bước 10 – trong db.transaction: kiểm tra gửi lặp; version phải khớp expectedVersion;
   * kiểm tra lại cổng mới; đổi cổng / khung giờ / nhu cầu, version + 1; ghi processed_requests.
   */
  atomicReschedule(
    requestId: string,
    studentId: string,
    reservationId: string,
    optionId: string,
    expectedVersion: number,
  ): RescheduleResult {
    throw notImplemented("OperationalRepository.atomicReschedule");
  },

  /** UC09 Ext 4b.1 – trong db.transaction: kiểm tra gửi lặp; version phải khớp; CONFIRMED → CANCELLED. */
  atomicCancelReservation(
    requestId: string,
    studentId: string,
    reservationId: string,
    expectedVersion: number,
    now: Date,
  ): CancellationResult {
    throw notImplemented("OperationalRepository.atomicCancelReservation");
  },
};
