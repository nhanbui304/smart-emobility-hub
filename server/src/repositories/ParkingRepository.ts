// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import type { VehicleType } from "../constants";
import type { Hub, ParkingAllocation, ParkingSlot, PrivateVehicle } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const parkingRepository = {
  /** UC06 bước 2 (findVehicleRight): xe cá nhân thuộc sinh viên. */
  findVehicleRight(studentId: string, vehicleId: string): PrivateVehicle | undefined {
    throw notImplemented("ParkingRepository.findVehicleRight (UC06)");
  },

  /** UC06 bước 2 (queryHubAcceptance): Hub đang hoạt động và tiếp nhận loại xe này. */
  queryHubAcceptance(hubId: string, vehicleType: VehicleType): { hub: Hub | undefined; accepting: boolean } {
    throw notImplemented("ParkingRepository.queryHubAcceptance (UC06)");
  },

  /** UC06: vị trí IN_SERVICE tại Hub, không bị phân bổ chồng lấn trong khoảng thời gian. */
  findAvailableSlots(hubId: string, startTime: Date, endTime: Date): ParkingSlot[] {
    throw notImplemented("ParkingRepository.findAvailableSlots (UC06)");
  },

  findAllocationById(allocationId: string): ParkingAllocation | undefined {
    throw notImplemented("ParkingRepository.findAllocationById");
  },

  /**
   * UC06 bước 5 – trong db.transaction: requestId đã xử lý → trả lượt giữ cũ; kiểm tra lại vị trí còn trống
   * trong khoảng thời gian, sinh viên chưa có lượt giữ khác, vị trí không bị hạn chế do sự cố;
   * tạo ParkingAllocation HELD; ghi processed_requests. holdExpiresAt = min(now + parkingHoldMinutes, startTime) do service tính.
   * HELD đã quá holdExpiresAt không tính là chồng lấn (kể cả khi scheduler chưa chạy).
   */
  atomicCheckAndHold(input: {
    requestId: string;
    studentId: string;
    slotId: string;
    vehicleRef: string;
    startTime: Date;
    endTime: Date;
    holdExpiresAt: Date;
  }): ParkingAllocation {
    throw notImplemented("ParkingRepository.atomicCheckAndHold (UC06)");
  },

  /**
   * UC06 bước 8 – trong db.transaction: kiểm tra gửi lặp, chủ sở hữu, hạn giữ, vị trí / Hub còn phục vụ;
   * HELD còn hạn → CONFIRMED (cùng bản ghi); quá hạn → EXPIRED và giải phóng.
   */
  atomicConfirmHold(input: { requestId: string; studentId: string; holdToken: string; now: Date }): ParkingAllocation {
    throw notImplemented("ParkingRepository.atomicConfirmHold (UC06)");
  },

  /** UC06 Ext 7b (findActiveHold): lượt giữ HELD còn hạn của sinh viên. */
  findActiveHold(studentId: string, now: Date): ParkingAllocation | undefined {
    throw notImplemented("ParkingRepository.findActiveHold (UC06)");
  },

  /**
   * UC06 Ext 7a / Cancel Parking Reservation: HELD|CONFIRMED → CANCELLED.
   * requestId bắt buộc với hủy giữ tạm (UC06), không có với hủy đặt chỗ (chưa có sequence).
   */
  atomicReleaseHold(input: {
    requestId?: string;
    allocationId: string;
    reason: "CANCELLED";
    studentId?: string;
    now: Date;
  }): ParkingAllocation {
    throw notImplemented("ParkingRepository.atomicReleaseHold (UC06)");
  },

  /**
   * UC06 Ext 7c / Mục 2.3.1 (atomicExpireHolds) – trong db.transaction: các HELD đã quá holdExpiresAt → EXPIRED.
   * Trả về danh sách id đã hết hạn (expiredHoldIds).
   */
  atomicExpireHolds(now: Date): string[] {
    throw notImplemented("ParkingRepository.atomicExpireHolds (2.3.1)");
  },
};
