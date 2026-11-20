// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC10.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import type { Alert } from "../db/schema";
import { alertRepository } from "../repositories/AlertRepository";
import { hubAlertScheduler } from "../schedulers/HubAlertScheduler";
import type { AlertDto, NetworkOverview, OperatorHubDetail } from "../types/dto";
import { hubService } from "./HubService";

export const monitoringService = {
  /**
   * UC10 bước 1–4: Tải tổng quan mạng lưới các Hub kèm danh sách cảnh báo đang mở
   * và thời điểm tổng hợp dữ liệu (generatedAt).
   * Đánh giá lại cảnh báo trước khi trả về để đảm bảo độ trễ phản ánh trên Dashboard <= 3 giây (NFR 3.1).
   */
  async getNetworkOverview(): Promise<NetworkOverview> {
    const now = new Date();
    hubAlertScheduler.evaluateHubAlerts(now);

    const hubs = hubService.getAllHubStatuses(now);
    const activeAlerts = alertRepository.findActive().map(toAlertDto);

    return {
      hubs,
      activeAlerts,
      generatedAt: now,
    };
  },

  /**
   * UC10 bước 5–6: Xem chi tiết một Hub dành cho Operator (danh sách xe, mức pin, cảnh báo của Hub,
   * cờ đánh dấu dữ liệu cũ isDataStale theo Ext 2b, và các lượt đặt xe / đặt chỗ / lịch sạc liên quan).
   */
  async getHubDetail(hubId: string): Promise<OperatorHubDetail> {
    const now = new Date();
    hubAlertScheduler.evaluateHubAlerts(now);

    const detail = hubService.getHubDetail(hubId, now);
    const activeAlerts = alertRepository
      .findActive()
      .filter((a) => a.hubId === hubId)
      .map(toAlertDto);

    const lastUpdated = new Date(detail.lastUpdatedAt);
    const ageSeconds = Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000));
    const isDataStale = ageSeconds > systemConfig.dataStaleSeconds;

    const reservations = hubService.getHubReservations(hubId, now);

    return {
      ...detail,
      activeAlerts,
      isDataStale,
      reservations,
    };
  },
};

function toAlertDto(alert: Alert): AlertDto {
  return {
    id: alert.id,
    hubId: alert.hubId,
    type: alert.type,
    value: alert.value,
    threshold: alert.threshold,
    active: alert.active,
    updatedAt: alert.updatedAt,
    evaluationWindow: alert.evaluationWindow ?? undefined,
  };
}
