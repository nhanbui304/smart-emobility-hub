// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
import type { AlertDto, HubDetail, HubStatus } from "../types/dto";
import { notImplemented } from "../lib/errors";

export interface NetworkOverview {
  hubs: HubStatus[];
  activeAlerts: AlertDto[];
  generatedAt: string;
}

export interface OperatorHubDetail extends HubDetail {
  activeAlerts: AlertDto[];
  /** Hub có dữ liệu quá dataStaleSeconds giây chưa cập nhật. */
  isDataStale: boolean;
}

export const monitoringService = {
  /**
   * UC10 bước 1–2: tổng quan mạng lưới kèm cảnh báo đang mở.
   * Gợi ý: dùng lại hubService.getAllHubStatuses() + alertRepository.findActive().
   */
  async getNetworkOverview(): Promise<NetworkOverview> {
    throw notImplemented("MonitoringService.getNetworkOverview (UC10)");
  },

  /** UC10 bước 3: chi tiết một Hub cho Operator (xe, cổng, cảnh báo, dữ liệu cũ). */
  async getHubDetail(hubId: string): Promise<OperatorHubDetail> {
    throw notImplemented("MonitoringService.getHubDetail (UC10)");
  },
};
