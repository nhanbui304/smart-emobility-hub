// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
import type { DeviceCommandResult } from "../constants";
import type { Trip, VehicleReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface PickUpPreview {
  reservation: VehicleReservation;
  vehicleCode: string;
  batteryLevel: number;
  pickupDeadline: Date;
}

export interface PickUpResult {
  outcome: DeviceCommandResult;
  trip?: Trip;
  reservation: VehicleReservation;
}

export const pickUpService = {
  /** UC04 bước 2–3: kiểm tra đặt xe, hiển thị thông tin xe trước khi mở khóa. */
  async preparePickUp(studentId: string, reservationId: string): Promise<PickUpPreview> {
    throw notImplemented("PickUpService.preparePickUp (UC04)");
  },

  /**
   * UC04 bước 4–7: atomicBeginHandover → vehicleSimulator.requestUnlock (NGOÀI transaction)
   * → SUCCESS: atomicStartTrip · FAILED: trả về RESERVED · UNKNOWN: markPendingVerification.
   */
  async confirmPickUp(studentId: string, reservationId: string): Promise<PickUpResult> {
    throw notImplemented("PickUpService.confirmPickUp (UC04)");
  },
};
