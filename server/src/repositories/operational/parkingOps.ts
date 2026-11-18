// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, mục 2.3.1
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ParkingAllocation, PrivateVehicle } from "../../db/schema";
import type { TimeRange } from "../../lib/schemas";
import type { HubAcceptance, SlotQueryResult } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const parkingOps = {
  findVehicleRight(studentId: string, vehicleId: string): PrivateVehicle | undefined {
    throw notImplemented("OperationalRepository.findVehicleRight");
  },

  queryHubAcceptance(hubId: string, vehicleId: string): HubAcceptance {
    throw notImplemented("OperationalRepository.queryHubAcceptance");
  },

  queryAvailableSlots(hubId: string, vehicleId: string, timeRange: TimeRange, now: Date): SlotQueryResult {
    throw notImplemented("OperationalRepository.queryAvailableSlots");
  },

  /**
   * UC06 – trong db.transaction: kiểm tra lại vị trí còn trống trong khoảng thời gian,
   * tạo ParkingAllocation HELD. holdExpiresAt = min(now + parkingHoldMinutes, startTime) do service tính.
   * HELD đã quá holdExpiresAt không tính là chồng lấn (kể cả khi scheduler chưa chạy).
   */
  atomicCheckAndHold(
    requestId: string,
    studentId: string,
    slotId: string,
    timeRange: TimeRange,
    holdDeadline: Date,
  ): ParkingAllocation {
    throw notImplemented("OperationalRepository.atomicCheckAndHold");
  },

  /** UC06 – trong db.transaction: HELD còn hạn → CONFIRMED (cùng bản ghi). */
  atomicConfirmHold(requestId: string, studentId: string, holdToken: string, now: Date): ParkingAllocation {
    throw notImplemented("OperationalRepository.atomicConfirmHold");
  },

  /** Hủy giữ tạm / hủy đặt chỗ / hết hạn: HELD|CONFIRMED → CANCELLED|EXPIRED. */
  atomicReleaseHold(requestId: string, studentId: string, holdToken: string): ParkingAllocation {
    throw notImplemented("OperationalRepository.atomicReleaseHold");
  },

  findActiveHold(studentId: string, now: Date): ParkingAllocation | undefined {
    throw notImplemented("OperationalRepository.findActiveHold");
  },

  atomicExpireHolds(now: Date): string[] {
    throw notImplemented("OperationalRepository.atomicExpireHolds");
  },

  atomicCancelBooking(studentId: string, bookingId: string, now: Date): ParkingAllocation {
    throw notImplemented("OperationalRepository.atomicCancelBooking");
  },
};
