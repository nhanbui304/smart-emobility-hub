// Owner: Nguyễn Hoàng Nhân (UC13) – dùng chung cho UC05, UC11 và các scheduler
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC13.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { operationalRepository } from "../repositories/OperationalRepository";
import type { AffectedContext, ChangeSummary, NotificationResult, OperatorAlert } from "../types/dto";

export const notificationService = {
  /**
   * UC13 bước 9: Thông báo cho sinh viên / Operator liên quan khi áp dụng phiên bản kế hoạch sạc mới.
   * Trong phạm vi MVP (BTL1 mục 1.4 & 1.6), hệ thống ghi nhận thông báo nội bộ, không tích hợp SMS/Email ngoài.
   */
  async notifyAffectedParties(
    scheduleVersionId: string,
    changeSummary: ChangeSummary,
  ): Promise<NotificationResult> {
    console.log(
      `[notification] Kế hoạch sạc ${scheduleVersionId} đã áp dụng với ${changeSummary.allocations.length} phân bổ.`,
    );
    return {
      sent: true,
      failedRecipientIds: [],
    };
  },

  /** UC11 bước 7: Thông báo cho người dùng có đặt chỗ / lịch sạc bị ảnh hưởng bởi sự cố. */
  async notifyAffectedUsers(
    incidentId: string,
    affectedContext: AffectedContext,
  ): Promise<NotificationResult> {
    const totalAffected =
      affectedContext.affectedHolds.length +
      affectedContext.affectedBookings.length +
      affectedContext.affectedTrips.length +
      affectedContext.affectedSchedules.length;
    console.log(`[notification] Sự cố ${incidentId}: thông báo tới ${totalAffected} dịch vụ bị ảnh hưởng.`);
    return {
      sent: true,
      failedRecipientIds: [],
    };
  },

  /** UC11 Ext 6a: Gửi yêu cầu lấy xác nhận đồng ý đổi tài nguyên / lịch đã đặt của sinh viên. */
  async requestUserConsent(
    incidentId: string,
    pendingChanges: string[],
    deadline: Date,
  ): Promise<NotificationResult> {
    console.log(
      `[notification] Sự cố ${incidentId}: yêu cầu xác nhận ${pendingChanges.length} thay đổi trước ${deadline.toISOString()}.`,
    );
    return {
      sent: true,
      failedRecipientIds: [],
    };
  },

  /** UC11 Ext 7a: Đánh dấu sự cố chưa gửi được thông báo để thử lại sau. */
  async markNotificationPending(incidentId: string): Promise<void> {
    operationalRepository.markIncidentNotificationPending(incidentId);
  },

  /** UC04 / UC05: Gửi cảnh báo nội bộ cho Operator khi cần xác minh mở/khóa xe hoặc đối soát. */
  async notifyOperator(alert: OperatorAlert): Promise<NotificationResult> {
    console.log(`[notification] Cảnh báo Operator (${alert.alertType}): ${alert.message}`);
    return {
      sent: true,
      failedRecipientIds: [],
    };
  },
};
