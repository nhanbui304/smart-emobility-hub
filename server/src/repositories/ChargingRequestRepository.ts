// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import type { ChargingRequest } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const chargingRequestRepository = {
  findById(id: string): ChargingRequest | undefined {
    throw notImplemented("ChargingRequestRepository.findById");
  },

  /**
   * UC07 – trong db.transaction: còn cổng trống phù hợp → ALLOCATED (gán portId, cổng IN_USE);
   * hết cổng → WAITING với queuedAt (pin < lowBatteryChargingPriority được ưu tiên).
   */
  atomicCreateRequest(input: {
    studentId: string;
    hubId: string;
    vehicleRef: string;
    targetBattery: number;
    now: Date;
  }): ChargingRequest {
    throw notImplemented("ChargingRequestRepository.atomicCreateRequest (UC07)");
  },

  /** Cancel Charging Request – trong db.transaction: WAITING|ALLOCATED → CANCELLED, trả cổng nếu đã giữ. */
  atomicCancelRequest(input: { studentId: string; chargingRequestId: string; now: Date }): ChargingRequest {
    throw notImplemented("ChargingRequestRepository.atomicCancelRequest (UC07)");
  },
};
