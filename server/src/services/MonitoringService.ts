// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { NetworkOverview, OperatorHubDetail } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const monitoringService = {
  /**
   * UC10 bước 1–2: tổng quan mạng lưới kèm cảnh báo đang mở.
   * Gợi ý: dùng lại hubService.getAllHubStatuses() + alertRepository.findActive().
   */
  async getNetworkOverview(): Promise<NetworkOverview> {
    throw notImplemented("MonitoringService.getNetworkOverview");
  },

  /** UC10 bước 3: chi tiết một Hub cho Operator (xe, cổng, cảnh báo, dữ liệu cũ). */
  async getHubDetail(hubId: string): Promise<OperatorHubDetail> {
    throw notImplemented("MonitoringService.getHubDetail");
  },
};
