// Owner: Nguyễn Hoàng Nhân – UC13 (dùng chung cho UC04, UC05, UC11 và các scheduler cần báo sinh viên / Operator)
// Sequence Sub #2: :NotificationService. Hệ thống không có WebSocket; client đọc thông báo bằng polling.
import { notImplemented } from "../lib/errors";

export interface NotificationResult {
  sent: boolean;
  /** Người nhận chưa gửi được, để gửi lại sau. */
  failedRecipientIds: string[];
}

/** Cảnh báo / yêu cầu hỗ trợ gửi tới Operator (UC04 Ext 6b, UC05 Ext 3c, 7b, 8a). */
export interface OperatorAlert {
  kind: "VERIFICATION" | "RECONCILIATION" | "SUPPORT_REQUEST";
  message: string;
  tripId?: string;
  reservationId?: string;
  vehicleId?: string;
  hubId?: string;
  slotId?: string;
}

/** Thay đổi cần sinh viên đồng ý (UC11 bước 6). */
export interface ConsentRequest {
  studentId: string;
  refId: string;
  description: string;
  /** Hết hạn mà chưa phản hồi thì giữ nguyên phương án cũ (systemConfig.consentResponseDeadlineMinutes). */
  respondBy: Date;
}

export const notificationService = {
  /**
   * UC13 bước 9: báo sinh viên / Operator bị ảnh hưởng bởi phiên bản kế hoạch sạc mới.
   * planId là scheduleVersionId trong sequence.
   */
  async notifyAffectedParties(planId: string, changeSummary: string[]): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyAffectedParties (UC13)");
  },

  /** UC04, UC05: báo Operator cần xác minh / đối soát / hỗ trợ. */
  async notifyOperator(alert: OperatorAlert): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyOperator (UC04, UC05)");
  },

  /** UC11 bước 6: báo sinh viên có lượt giữ / đặt chỗ / chuyến đi / lịch sạc bị ảnh hưởng bởi sự cố. */
  async notifyAffectedUsers(incidentId: string, affectedStudentIds: string[], message: string): Promise<NotificationResult> {
    throw notImplemented("NotificationService.notifyAffectedUsers (UC11)");
  },

  /** UC11 bước 6: gửi yêu cầu đồng ý các thay đổi (đổi chỗ, đổi cổng, đổi giờ). */
  async requestUserConsent(incidentId: string, pendingConsentList: ConsentRequest[]): Promise<NotificationResult> {
    throw notImplemented("NotificationService.requestUserConsent (UC11)");
  },
};
