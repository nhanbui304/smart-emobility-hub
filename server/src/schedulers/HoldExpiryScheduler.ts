// Owner: Bùi Quang Nhân – Mục 2.3.1 Giữ chỗ đỗ tạm thời và tự động giải phóng
import { notImplemented } from "../lib/errors";

export const holdExpiryScheduler = {
  /**
   * Gọi parkingService.expireDueHolds(now): HELD đã quá holdExpiresAt → EXPIRED
   * (operationalRepository.atomicExpireHolds). Trả về số lượt giữ đã giải phóng.
   */
  expireDueHolds(now: Date): number {
    throw notImplemented("HoldExpiryScheduler.expireDueHolds (2.3.1)");
  },
};
