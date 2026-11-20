// Owner: Nguyễn Hoàng Nhân – Mục 2.3.3 Tự động cảnh báo Hub thiếu xe hoặc gần hết chỗ
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC10.drawio).
import { systemConfig } from "../config/systemConfig";
import type { TimeRange } from "../lib/schemas";
import { alertRepository } from "../repositories/AlertRepository";
import { hubRepository } from "../repositories/HubRepository";
import { hubService } from "../services/HubService";

/** Khoảng thời gian đánh giá sức chứa tiếp nhận mặc định: 60 phút kể từ thời điểm đánh giá (TC-UC10-01). */
const EVALUATION_WINDOW_MINUTES = 60;

export const hubAlertScheduler = {
  /**
   * Mục 2.3.3 & BTL3 tr. 47 (HubAlertScheduler.evaluateHubAlerts):
   * - Đọc tình trạng từng Hub từ HubService và đối chiếu với ngưỡng cấu hình trong systemConfig.
   * - LOW_VEHICLE: phát cảnh báo khi số xe đủ điều kiện cho mượn < lowVehicleThreshold.
   * - NEAR_FULL: phát cảnh báo khi số vị trí có thể tiếp nhận trong khoảng đánh giá <= nearFullThreshold
   *   (lưu kèm evaluationWindow để dashboard hiển thị).
   * - RESOURCE_FAULT: phát cảnh báo khi có xe bảo trì, vị trí đỗ hoặc cổng sạc ngừng hoạt động tại Hub.
   * - DATA_STALE: phát cảnh báo khi dữ liệu Hub quá dataStaleSeconds giây chưa được cập nhật.
   * - Khi điều kiện không còn vi phạm -> gọi alertRepository.clear để kết thúc cảnh báo.
   * - Trả về tổng số cảnh báo được tạo mới hoặc cập nhật trong lần đánh giá.
   */
  evaluateHubAlerts(now: Date = new Date()): number {
    const hubStatuses = hubService.getAllHubStatuses(now);
    const allSlots = hubRepository.listSlots();
    const allVehicles = hubRepository.listVehicles();
    const allPorts = hubRepository.listPortsWithHub();

    const evaluationWindow: TimeRange = {
      startTime: now,
      endTime: new Date(now.getTime() + EVALUATION_WINDOW_MINUTES * 60_000),
    };

    let upsertedCount = 0;

    for (const hub of hubStatuses) {
      // 1. Kiểm tra dữ liệu quá hạn (Mục 2.3.3 ý 6 & UC10 Ext 2b)
      const lastUpdated = new Date(hub.lastUpdatedAt);
      const ageSeconds = Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000));
      if (ageSeconds > systemConfig.dataStaleSeconds) {
        alertRepository.upsertActive(hub.id, "DATA_STALE", ageSeconds, systemConfig.dataStaleSeconds);
        upsertedCount++;
      } else {
        const existingStale = alertRepository.findActiveByHubAndType(hub.id, "DATA_STALE");
        if (existingStale) alertRepository.clear(existingStale.id);
      }

      // 2. Kiểm tra cảnh báo thiếu xe: availableVehicles < lowVehicleThreshold (Mục 2.3.3 ý 4 & TC-UC10-01)
      if (hub.availableVehicles < systemConfig.lowVehicleThreshold) {
        alertRepository.upsertActive(
          hub.id,
          "LOW_VEHICLE",
          hub.availableVehicles,
          systemConfig.lowVehicleThreshold,
        );
        upsertedCount++;
      } else {
        const existingLow = alertRepository.findActiveByHubAndType(hub.id, "LOW_VEHICLE");
        if (existingLow) alertRepository.clear(existingLow.id);
      }

      // 3. Kiểm tra cảnh báo gần hết chỗ: receivableSlots <= nearFullThreshold (Mục 2.3.3 ý 3–4 & TC-UC10-01)
      const receivableSlots = hubService.getReceivableSlotCount(hub.id, evaluationWindow, now);
      if (receivableSlots <= systemConfig.nearFullThreshold) {
        alertRepository.upsertActive(
          hub.id,
          "NEAR_FULL",
          receivableSlots,
          systemConfig.nearFullThreshold,
          evaluationWindow,
        );
        upsertedCount++;
      } else {
        const existingNearFull = alertRepository.findActiveByHubAndType(hub.id, "NEAR_FULL");
        if (existingNearFull) alertRepository.clear(existingNearFull.id);
      }

      // 4. Kiểm tra cảnh báo tài nguyên gặp sự cố (UC10 bước 4)
      const faultVehicles = allVehicles.filter(
        (v) => v.hubId === hub.id && v.status === "UNDER_MAINTENANCE",
      ).length;
      const faultSlots = allSlots.filter(
        (s) => s.hubId === hub.id && s.status === "OUT_OF_SERVICE",
      ).length;
      const faultPorts = allPorts.filter(
        (p) => p.hubId === hub.id && p.port.status === "OUT_OF_SERVICE",
      ).length;
      const totalFaults = faultVehicles + faultSlots + faultPorts;

      if (totalFaults > 0) {
        alertRepository.upsertActive(hub.id, "RESOURCE_FAULT", totalFaults, 0);
        upsertedCount++;
      } else {
        const existingFault = alertRepository.findActiveByHubAndType(hub.id, "RESOURCE_FAULT");
        if (existingFault) alertRepository.clear(existingFault.id);
      }
    }

    return upsertedCount;
  },
};
