// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
import type { DeviceCommandResult } from "../constants";
import type { ParkingAllocation, Trip } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface ReturnPreparation {
  trip: Trip;
  allocation: ParkingAllocation;
  slotCode: string;
}

export interface ReturnResult {
  outcome: DeviceCommandResult;
  trip: Trip;
}

export const returnService = {
  /** UC05 bước 2–4: chọn Hub trả xe, hệ thống phân bổ vị trí đỗ. */
  async prepareReturn(studentId: string, tripId: string, hubId: string): Promise<ReturnPreparation> {
    throw notImplemented("ReturnService.prepareReturn (UC05)");
  },

  /**
   * UC05 bước 5–7: vehicleSimulator.sendLockCommand (NGOÀI transaction)
   * → SUCCESS: atomicCompleteReturn (trạng thái xe theo pin/sự cố)
   * → FAILED: recordLockFailure, giữ vị trí, cho thử lại · UNKNOWN: atomicMarkPendingVerification + báo Operator.
   */
  async confirmReturn(studentId: string, tripId: string): Promise<ReturnResult> {
    throw notImplemented("ReturnService.confirmReturn (UC05)");
  },

  /** UC05 luồng thay thế: sinh viên bỏ dở việc trả xe → giải phóng vị trí đã giữ, Trip về ACTIVE. */
  async abandonReturn(studentId: string, tripId: string): Promise<Trip> {
    throw notImplemented("ReturnService.abandonReturn (UC05)");
  },
};
