// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Chữ ký method theo Sequence Submission #2 (Hình 2.16–2.19).
import type { DeviceCommandResult } from "../constants";
import type { Trip, VehicleReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface PickUpPreview {
  reservation: VehicleReservation;
  vehicleCode: string;
  batteryLevel: number;
  pickupDeadline: Date;
}

/** UC04 bước 8: tripStarted(tripId, startTime) hoặc kết quả lỗi thiết bị. */
export interface PickUpResult {
  outcome: DeviceCommandResult;
  trip?: Trip;
  reservation: VehicleReservation;
  /** true nếu đã mở khóa nhưng ghi chuyến đi thất bại, chờ đối soát (Ext 8a). */
  reconciliationRequired?: boolean;
}

/** UC04 Ext 9a (getPickUpResult): kết quả của một requestId đã gửi. */
export interface PickUpRequestResult {
  status: "PROCESSED" | "NOT_FOUND";
  result?: PickUpResult;
}

export const pickUpService = {
  /**
   * UC04 bước 2–3: tải đặt xe (loadPickUpContext), kiểm tra quyền, hạn nhận (quá hạn → expireReservation, Ext 3a),
   * tình trạng xe (không dùng được → markReservationAffected, Ext 4b); hiển thị thông tin xe trước khi mở khóa.
   */
  async preparePickUp(studentId: string, reservationId: string): Promise<PickUpPreview> {
    throw notImplemented("PickUpService.preparePickUp (UC04)");
  },

  /**
   * UC04 bước 4–8: atomicBeginHandover (kiểm tra gửi lặp) → vehicleSimulator.requestUnlock (NGOÀI transaction)
   * → SUCCESS: atomicStartTrip (lỗi ghi → markReconciliationRequired + notifyOperator, Ext 8a)
   * · FAILED: endHandoverAndResolveHold (Ext 7a) · UNKNOWN: markPendingVerification + notifyOperator (Ext 6b).
   */
  async confirmPickUp(requestId: string, studentId: string, reservationId: string): Promise<PickUpResult> {
    throw notImplemented("PickUpService.confirmPickUp (UC04)");
  },

  /** UC04 Ext 9a: mất kết nối sau khi gửi → tra lại kết quả theo requestId. */
  async getPickUpResult(studentId: string, requestId: string): Promise<PickUpRequestResult> {
    throw notImplemented("PickUpService.getPickUpResult (UC04)");
  },
};
