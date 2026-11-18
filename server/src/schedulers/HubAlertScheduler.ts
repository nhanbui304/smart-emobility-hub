// Owner: Nguyễn Hoàng Nhân – Mục 2.3.3 Tự động cảnh báo Hub thiếu xe hoặc gần hết chỗ
import { notImplemented } from "../lib/errors";

export const hubAlertScheduler = {
  /**
   * So sánh trạng thái từng Hub với ngưỡng trong systemConfig (lowVehicleThreshold, nearFullThreshold,
   * dataStaleSeconds). Vượt ngưỡng → alertRepository.upsertActive; hết vượt ngưỡng → alertRepository.clear.
   * Dashboard đọc cảnh báo qua API (gọi lại mỗi 3 giây). Trả về số cảnh báo tạo mới hoặc cập nhật.
   */
  evaluateHubAlerts(now: Date): number {
    throw notImplemented("HubAlertScheduler.evaluateHubAlerts (2.3.3)");
  },
};
