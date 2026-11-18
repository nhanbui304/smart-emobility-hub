// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { VehicleStatus } from "../../constants";
import type { ParkingAllocation, Trip } from "../../db/schema";
import type { HubReturnContext, LockResult, ReturnAllocation, ReturnHandoverContext, ReturnSlotPlan } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const returnOps = {
  findTripForReturn(tripId: string): Trip | undefined {
    throw notImplemented("OperationalRepository.findTripForReturn");
  },

  queryHubReturnContext(hubId: string, vehicleId: string, studentId: string, now: Date): HubReturnContext {
    throw notImplemented("OperationalRepository.queryHubReturnContext");
  },

  /** UC05 – trong db.transaction: tìm và giữ một vị trí trống tại Hub trả xe, Trip → RETURN_IN_PROGRESS. */
  atomicAllocateReturnSlot(
    requestId: string,
    tripId: string,
    hubId: string,
    slotPlan: ReturnSlotPlan,
  ): ReturnAllocation {
    throw notImplemented("OperationalRepository.atomicAllocateReturnSlot");
  },

  findReturnHandoverContext(tripId: string, studentId: string): ReturnHandoverContext | undefined {
    throw notImplemented("OperationalRepository.findReturnHandoverContext");
  },

  markHandoverInProgress(requestId: string, tripId: string, vehicleId: string, slotId: string): void {
    throw notImplemented("OperationalRepository.markHandoverInProgress");
  },

  /** UC05 – khóa xe FAILED: ghi nhận lần thất bại; Trip vẫn RETURN_IN_PROGRESS, giữ vị trí, xe chưa được cấp lại. */
  recordLockFailure(requestId: string, tripId: string): void {
    throw notImplemented("OperationalRepository.recordLockFailure");
  },

  markPendingVerification(tripId: string, vehicleId: string, slotId: string): Trip {
    throw notImplemented("OperationalRepository.markPendingVerification");
  },

  /**
   * UC05 – sau khi khóa xe SUCCESS: Trip ENDED, xe đặt tại vị trí mới với vehicleServiceStatus
   * (AVAILABLE; pin < reservableBatteryThreshold hoặc sự cố → UNDER_MAINTENANCE; chưa rõ → PENDING_VERIFICATION), cập nhật phân bổ.
   */
  atomicCompleteReturn(
    requestId: string,
    tripId: string,
    vehicleId: string,
    slotId: string,
    returnedAt: Date,
    bookingId: string | undefined,
    vehicleServiceStatus: VehicleStatus,
  ): Trip {
    throw notImplemented("OperationalRepository.atomicCompleteReturn");
  },

  saveHandoverForReconciliation(tripId: string, vehicleId: string, slotId: string, lockResult: LockResult): Trip {
    throw notImplemented("OperationalRepository.saveHandoverForReconciliation");
  },

  releaseNewReturnAllocation(requestId: string, allocationId: string): ParkingAllocation {
    throw notImplemented("OperationalRepository.releaseNewReturnAllocation");
  },
};
