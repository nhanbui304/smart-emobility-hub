// Owner: Nguyễn Hoàng Nhân – UC13 (dùng chung cho UC11 và các scheduler cần báo sinh viên)
// Sequence Sub #2, Hình 2.56: :NotificationService. Hệ thống không có WebSocket; client đọc thông báo bằng polling.
import { notImplemented } from "../lib/errors";

export interface NotificationResult {
  sent: boolean;
  /** Người nhận chưa gửi được, để gửi lại sau. */
  failedRecipientIds: string[];
}

export const notificationService = {
  /**
   * UC13 bước 9: báo sinh viên / Operator bị ảnh hưởng bởi phiên bản kế hoạch sạc mới.
   * planId là scheduleVersionId trong sequence.
   */
  async notifyAffectedParties(planId: string, changeSummary: string[]): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyAffectedParties (UC13)");
  },
};
