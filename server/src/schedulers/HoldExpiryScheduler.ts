// Owner: Bùi Quang Nhân – Mục 2.3.1 Giữ chỗ đỗ tạm thời và tự động giải phóng
// Sequence Sub #2 (UC06 4/4, Ext 7c): HoldExpiryScheduler → ParkingService.expireDueHolds(now) → atomicExpireHolds(now).
import { parkingService } from "../services/ParkingService";

export const holdExpiryScheduler = {
  /** Gọi parkingService.expireDueHolds; trả về số lượt giữ tạm đã giải phóng (expiredCount). */
  expireDueHolds(now: Date): number {
    return parkingService.expireDueHolds(now);
  },
};
