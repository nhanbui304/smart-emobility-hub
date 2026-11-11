// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import type { ParkingAllocation, ParkingSlot } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const parkingRepository = {
  /** UC06: vị trí IN_SERVICE tại Hub, không bị phân bổ chồng lấn trong khoảng thời gian. */
  findAvailableSlots(hubId: string, startTime: Date, endTime: Date): ParkingSlot[] {
    throw notImplemented("ParkingRepository.findAvailableSlots (UC06)");
  },

  findAllocationById(allocationId: string): ParkingAllocation | undefined {
    throw notImplemented("ParkingRepository.findAllocationById");
  },

  /**
   * UC06 – trong db.transaction: kiểm tra lại vị trí còn trống trong khoảng thời gian,
   * tạo ParkingAllocation HELD. holdExpiresAt = min(now + parkingHoldMinutes, startTime) do service tính.
   * HELD đã quá holdExpiresAt không tính là chồng lấn (kể cả khi scheduler chưa chạy).
   */
  atomicCheckAndHold(input: {
    studentId: string;
    slotId: string;
    vehicleRef: string;
    startTime: Date;
    endTime: Date;
    holdExpiresAt: Date;
  }): ParkingAllocation {
    throw notImplemented("ParkingRepository.atomicCheckAndHold (UC06)");
  },

  /** UC06 – trong db.transaction: HELD còn hạn → CONFIRMED (cùng bản ghi). */
  atomicConfirmHold(input: { studentId: string; holdToken: string; now: Date }): ParkingAllocation {
    throw notImplemented("ParkingRepository.atomicConfirmHold (UC06)");
  },

  /** Hủy giữ tạm / hủy đặt chỗ / hết hạn: HELD|CONFIRMED → CANCELLED|EXPIRED. */
  atomicReleaseHold(input: {
    allocationId: string;
    reason: "CANCELLED" | "EXPIRED";
    studentId?: string;
    now: Date;
  }): ParkingAllocation {
    throw notImplemented("ParkingRepository.atomicReleaseHold (UC06)");
  },

  /** Cho HoldExpiryScheduler: các HELD đã quá holdExpiresAt. */
  findExpiredHolds(now: Date): ParkingAllocation[] {
    throw notImplemented("ParkingRepository.findExpiredHolds (2.3.1)");
  },
};
