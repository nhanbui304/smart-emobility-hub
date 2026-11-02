// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import type { ChargingRequest } from "../db/schema";
import { db, type DbOrTx, type Tx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const chargingRequestRepository = {
  findById(id: string, conn: DbOrTx = db): ChargingRequest | undefined {
    throw notImplemented("ChargingRequestRepository.findById");
  },

  /**
   * UC07 – trong runIdempotent: còn cổng trống phù hợp → ALLOCATED (gán portId, cổng IN_USE);
   * hết cổng → WAITING với queuedAt (pin < lowBatteryChargingPriority được ưu tiên).
   */
  atomicCreateRequest(
    tx: Tx,
    input: { studentId: string; hubId: string; vehicleRef: string; targetBattery: number; now: Date },
  ): ChargingRequest {
    throw notImplemented("ChargingRequestRepository.atomicCreateRequest (UC07)");
  },

  /** Cancel Charging Request – trong runIdempotent: WAITING|ALLOCATED → CANCELLED, trả cổng nếu đã giữ. */
  atomicCancelRequest(tx: Tx, input: { studentId: string; chargingRequestId: string; now: Date }): ChargingRequest {
    throw notImplemented("ChargingRequestRepository.atomicCancelRequest (UC07)");
  },
};
