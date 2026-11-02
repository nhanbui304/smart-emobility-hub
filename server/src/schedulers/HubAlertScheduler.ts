// Owner: Nguyễn Hoàng Nhân – Mục 2.3.3 Tự động cảnh báo Hub thiếu xe hoặc gần hết chỗ
import { notImplemented } from "../lib/errors";

export const hubAlertScheduler = {
  /**
   * So sánh trạng thái từng Hub với ngưỡng trong systemConfig (lowVehicleThreshold, nearFullThreshold,
   * dataStaleSeconds). Vượt ngưỡng → alertRepository.upsertActive + emitToOperators(ALERT_RAISED);
   * hết vượt ngưỡng → clear + ALERT_CLEARED. Trả về số cảnh báo thay đổi.
   */
  evaluateHubAlerts(now: Date): number {
    throw notImplemented("HubAlertScheduler.evaluateHubAlerts (2.3.3)");
  },
};
