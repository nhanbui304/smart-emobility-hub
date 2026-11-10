// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Sequence Sub #2 gọi chung là OperationalRepository; trong code tách theo bảng (xem bảng ánh xạ trong báo cáo).
import type { ChargingPlan } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";
import type { ChargingContext, PlanDraft } from "../services/SmartChargingService";

/** Kế hoạch nháp lưu tạm trong bộ nhớ theo planDraftId (mất khi khởi động lại server thì lập lại). */
const planDraftStore = new Map<string, PlanDraft>();

export const chargingPlanRepository = {
  findCurrentByHub(hubId: string): ChargingPlan | undefined {
    throw notImplemented("ChargingPlanRepository.findCurrentByHub (UC13)");
  },

  /**
   * UC13 bước 2 (queryChargingContext): đọc cổng sạc, xe dùng chung cần sạc, lịch đã xác nhận,
   * yêu cầu sạc đang chờ, phiên đang chạy và hạn chế do sự cố của Hub trong khung giờ. Chỉ đọc.
   */
  loadChargingContext(hubId: string, startTime: Date, endTime: Date): ChargingContext {
    throw notImplemented("ChargingPlanRepository.loadChargingContext (UC13)");
  },

  /** UC13 bước 4–6: lưu / cập nhật kế hoạch nháp. */
  saveDraft(draft: PlanDraft): void {
    throw notImplemented("ChargingPlanRepository.saveDraft (UC13)");
  },

  findDraft(planDraftId: string): PlanDraft | undefined {
    throw notImplemented("ChargingPlanRepository.findDraft (UC13)");
  },

  /**
   * UC13 bước 8 (atomicApplyChargingSchedule) – trong db.transaction: requestId đã xử lý → trả kế hoạch cũ;
   * version hiện tại phải = baseVersion; kiểm tra lại hạn chế do sự cố; ghi kế hoạch mới (version + 1),
   * cập nhật phân bổ cổng cho yêu cầu sạc; ghi processed_requests. Thất bại thì không cập nhật một phần.
   */
  atomicApplyPlan(input: {
    requestId: string;
    planDraftId: string;
    baseVersion: number;
    operatorId: string;
    now: Date;
  }): ChargingPlan {
    throw notImplemented("ChargingPlanRepository.atomicApplyPlan (UC13)");
  },

  /** UC13 Ext 9a: đánh dấu kế hoạch cần gửi lại thông báo. */
  markNotificationPending(planId: string): void {
    throw notImplemented("ChargingPlanRepository.markNotificationPending (UC13)");
  },
};
