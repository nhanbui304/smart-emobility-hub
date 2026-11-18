// Owner: Nguyễn Hoàng Nhân (UC13) – dùng chung cho UC05, UC11 và các scheduler
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { AffectedContext, ChangeSummary, NotificationResult, OperatorAlert } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const notificationService = {
  /**
   * UC13 bước 9: báo sinh viên / Operator bị ảnh hưởng bởi phiên bản kế hoạch sạc mới.
   */
  async notifyAffectedParties(scheduleVersionId: string, changeSummary: ChangeSummary): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyAffectedParties");
  },

  async notifyAffectedUsers(incidentId: string, affectedContext: AffectedContext): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyAffectedUsers");
  },

  async requestUserConsent(incidentId: string, pendingChanges: string[], deadline: Date): Promise<NotificationResult> {
    throw notImplemented("NotificationService.requestUserConsent");
  },

  async markNotificationPending(incidentId: string): Promise<void> {
    throw notImplemented("NotificationService.markNotificationPending");
  },

  async notifyOperator(alert: OperatorAlert): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyOperator");
  },
};
