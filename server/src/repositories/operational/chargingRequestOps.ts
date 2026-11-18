// Owner: Ngô Minh Triết – UC07 Submit Charging Request
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingRequest } from "../../db/schema";
import type { CancelChargingResult, ChargingNeed, ChargingProposal, ChargingRequestResult } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const chargingRequestOps = {
  findVehicleChargingRight(studentId: string, vehicleId: string): boolean {
    throw notImplemented("OperationalRepository.findVehicleChargingRight");
  },

  checkVehicleAtHubAndCompatible(hubId: string, vehicleId: string): boolean {
    throw notImplemented("OperationalRepository.checkVehicleAtHubAndCompatible");
  },

  findConflictingChargingRecords(studentId: string, vehicleId: string): ChargingRequest[] {
    throw notImplemented("OperationalRepository.findConflictingChargingRecords");
  },

  evaluateChargingAllocation(
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
    now: Date,
  ): ChargingProposal {
    throw notImplemented("OperationalRepository.evaluateChargingAllocation");
  },

  atomicSubmitChargingRequest(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
    now: Date,
  ): ChargingRequestResult {
    throw notImplemented("OperationalRepository.atomicSubmitChargingRequest");
  },

  findChargingRequest(chargingRequestId: string): ChargingRequest | undefined {
    throw notImplemented("OperationalRepository.findChargingRequest");
  },

  atomicCancelChargingRequest(
    requestId: string,
    studentId: string,
    chargingRequestId: string,
    now: Date,
  ): CancelChargingResult {
    throw notImplemented("OperationalRepository.atomicCancelChargingRequest");
  },
};
