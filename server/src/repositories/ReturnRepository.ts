// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
import type { ParkingAllocation, Trip } from "../db/schema";
import { notImplemented } from "../lib/errors";

export const returnRepository = {
  /** UC05 – trong db.transaction: tìm và giữ một vị trí trống tại Hub trả xe, Trip → RETURN_IN_PROGRESS. */
  atomicAllocateReturnSlot(input: { studentId: string; tripId: string; hubId: string; now: Date }): {
    trip: Trip;
    allocation: ParkingAllocation;
  } {
    throw notImplemented("ReturnRepository.atomicAllocateReturnSlot (UC05)");
  },

  /** UC05 – sau khi khóa xe SUCCESS: Trip ENDED, xe AVAILABLE tại vị trí mới, cập nhật phân bổ. */
  atomicCompleteReturn(input: { studentId: string; tripId: string; now: Date }): Trip {
    throw notImplemented("ReturnRepository.atomicCompleteReturn (UC05)");
  },
};
