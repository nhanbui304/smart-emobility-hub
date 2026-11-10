// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Chữ ký method theo Sequence Submission #2 (Hình 2.35–2.37).
import type { DeviceCommandResult } from "../constants";
import type { ParkingAllocation, Trip } from "../db/schema";
import { notImplemented } from "../lib/errors";

/** UC05 bước 4: parkingGuidance(allocationId, slotId). */
export interface ReturnPreparation {
  trip: Trip;
  allocation: ParkingAllocation;
  slotCode: string;
}

/** UC05 bước 9: returnResult(tripId, returnedAt, hubId, slotId); hoặc kết quả lỗi khóa / chờ đối soát. */
export interface ReturnResult {
  outcome: DeviceCommandResult;
  trip: Trip;
  returnedAt?: Date;
  hubId: string;
  slotId: string;
  /** true nếu đã bàn giao nhưng ghi nhận thất bại, chờ đối soát (Ext 8a). */
  pendingReconciliation?: boolean;
}

export const returnService = {
  /**
   * UC05 bước 1–4: tìm chuyến đi (findTripForReturn), kiểm tra (validateTripForReturn: Ext 2a–2d),
   * đọc bối cảnh Hub (queryHubReturnContext), chọn chỗ (selectReturnSlot), phân bổ trong một thao tác
   * (atomicAllocateReturnSlot, kiểm tra gửi lặp). Chỗ đã đặt không dùng được và không có chỗ thay thế
   * → notifyOperator(supportRequest) (Ext 3c).
   */
  async prepareReturn(requestId: string, studentId: string, tripId: string, hubId: string): Promise<ReturnPreparation> {
    throw notImplemented("ReturnService.prepareReturn (UC05)");
  },

  /**
   * UC05 bước 5–9: kiểm tra gửi lặp; tải bối cảnh bàn giao (findReturnHandoverContext); đọc vị trí xe
   * (vehicleSimulator.readVehiclePosition) và kiểm tra (verifyVehicleHubAndSlot, sai → Ext 6a);
   * markHandoverInProgress; vehicleSimulator.sendLockCommand (NGOÀI transaction)
   * → SUCCESS: determineVehicleServiceStatus rồi atomicCompleteReturn (lỗi ghi → saveHandoverForReconciliation
   *   + notifyOperator, Ext 8a)
   * → FAILED: recordLockFailure, giữ chỗ, cho thử lại (Ext 7a)
   * → UNKNOWN: markPendingVerification + notifyOperator (Ext 7b).
   */
  async confirmReturn(requestId: string, studentId: string, tripId: string): Promise<ReturnResult> {
    throw notImplemented("ReturnService.confirmReturn (UC05)");
  },

  /**
   * UC05 Ext 5a: sinh viên dừng trước khi bàn giao. Đọc vị trí xe: xe chưa chiếm chỗ → releaseNewReturnAllocation
   * (chỉ giải phóng phần phân bổ mới, không hủy đặt chỗ trước); xe đang chiếm chỗ hoặc chưa rõ → giữ nguyên.
   * Chuyến đi chưa kết thúc.
   */
  async abandonReturn(requestId: string, studentId: string, tripId: string): Promise<Trip> {
    throw notImplemented("ReturnService.abandonReturn (UC05)");
  },
};
