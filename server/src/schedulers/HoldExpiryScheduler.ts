// Owner: Bùi Quang Nhân – Mục 2.3.1 Giữ chỗ đỗ tạm thời và tự động giải phóng
import { notImplemented } from "../lib/errors";

export const holdExpiryScheduler = {
  /**
   * Tìm ParkingAllocation HELD đã quá holdExpiresAt → EXPIRED (parkingRepository.findExpiredHolds +
   * atomicReleaseHold), gửi NOTIFICATION cho sinh viên. Trả về số bản giữ tạm đã giải phóng.
   */
  expireDueHolds(now: Date): number {
    throw notImplemented("HoldExpiryScheduler.expireDueHolds (2.3.1)");
  },
};
