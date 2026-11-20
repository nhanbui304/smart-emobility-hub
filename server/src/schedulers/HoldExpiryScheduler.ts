// Owner: Bùi Quang Nhân – Mục 2.3.1 Giữ chỗ đỗ tạm thời và tự động giải phóng
import { parkingService } from "../services/ParkingService";

export const holdExpiryScheduler = {
  /**
   * Gọi parkingService.expireDueHolds(now): HELD đã quá holdExpiresAt → EXPIRED
   * (operationalRepository.atomicExpireHolds). Trả về số lượt giữ đã giải phóng.
   */
  expireDueHolds(now: Date): number {
    const released = parkingService.expireDueHolds(now);
    if (released > 0) console.log(`[scheduler] Đã giải phóng ${released} lượt giữ/đặt chỗ đỗ hết hạn.`);
    return released;
  },
};
