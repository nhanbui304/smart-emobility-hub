// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Chữ ký method theo Sequence Submission #2 (Hình 2.55–2.56).
import type { ChargingPlan } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

/** Bối cảnh sạc của một Hub trong khung giờ (UC13 bước 2). */
export interface ChargingContext {
  hubId: string;
  timeRange: TimeRange;
  capturedAt: Date;
  currentPlanVersion: number;
  ports: Array<{ portId: string; status: string; maxPowerKw: number }>;
  /** Cổng / vị trí đang bị hạn chế do sự cố (UC11 bước 4): đánh dấu, không đưa vào phương án. */
  restrictedPortIds: string[];
  /** Nhu cầu sạc: xe dùng chung, lịch đã xác nhận, yêu cầu sạc đang chờ, phiên đang chạy. */
  demand: Array<{
    refId: string;
    kind: "SHARED_VEHICLE" | "RESERVATION" | "REQUEST" | "ACTIVE_SESSION";
    batteryLevel?: number;
    /** Lịch Confirmed, phiên Charging / AwaitingDisconnect: UC13 không được thay đổi (Ext 6b). */
    isProtected: boolean;
  }>;
}

export interface PlanAssignment {
  portId: string;
  refId: string;
  startTime: Date;
  endTime: Date;
}

/** Kế hoạch nháp (UC13 bước 4–6). Lưu tạm qua chargingPlanRepository.saveDraft. */
export interface PlanDraft {
  planDraftId: string;
  hubId: string;
  timeRange: TimeRange;
  ruleId: string;
  /** Phiên bản kế hoạch đang hiệu lực lúc lập nháp; gửi lại khi áp dụng để phát hiện thay đổi (Ext 8a). */
  baseVersion: number;
  assignments: PlanAssignment[];
  /** refId được phục vụ trong kế hoạch. */
  servedRequests: string[];
  /** refId chưa phục vụ được, vẫn chờ (Ext 4a); không tự hủy lịch đã xác nhận. */
  waitingRequests: string[];
  warnings: string[];
  /** true sau khi validatePlan không phát hiện xung đột. */
  validated: boolean;
}

/** Kết quả áp dụng (UC13 bước 9: scheduleResult). */
export interface ChargingScheduleResult {
  plan: ChargingPlan;
  allocations: PlanAssignment[];
  /** true nếu gửi thông báo thất bại và đã đánh dấu gửi lại sau (Ext 9a). */
  notificationPending: boolean;
}

export const smartChargingService = {
  /**
   * UC13 bước 1–2: đọc bối cảnh sạc rồi đánh giá độ đầy đủ (assessDataCompleteness).
   * Dữ liệu thiếu hoặc cũ → AppError CONFLICT kèm chi tiết (Ext 2a).
   */
  async getChargingContext(hubId: string, timeRange: TimeRange): Promise<ChargingContext> {
    throw notImplemented("SmartChargingService.getChargingContext (UC13)");
  },

  /**
   * UC13 bước 3–4: kiểm tra quy tắc ưu tiên (validatePriorityRule), tính ưu tiên, tối ưu phân bổ;
   * lưu nháp. Không có phương án khả thi → AppError CONFLICT kèm ràng buộc (Ext 4b).
   */
  async generateProposedSchedule(hubId: string, timeRange: TimeRange, ruleId: string): Promise<PlanDraft> {
    throw notImplemented("SmartChargingService.generateProposedSchedule (UC13)");
  },

  /**
   * UC13 bước 5–6: áp dụng điều chỉnh của Operator vào nháp (applyAdjustments) rồi kiểm tra toàn bộ
   * kế hoạch (validateScheduleConstraints): xung đột tài nguyên, công suất (Ext 6a), cam kết đã có (Ext 6b).
   */
  async validatePlan(planDraftId: string, adjustments: PlanAssignment[]): Promise<PlanDraft> {
    throw notImplemented("SmartChargingService.validatePlan (UC13)");
  },

  /**
   * UC13 bước 7–9: áp dụng trong một thao tác (atomicApplyPlan): kiểm tra gửi lặp, baseVersion,
   * kiểm tra lại nhu cầu / tài nguyên / hạn chế sự cố; lưu phiên bản mới. Sau đó thông báo các bên
   * bị ảnh hưởng (notificationService.notifyAffectedParties); thất bại thì markNotificationPending.
   */
  async applyChargingSchedule(
    requestId: string,
    planDraftId: string,
    baseVersion: number,
    operatorId: string,
  ): Promise<ChargingScheduleResult> {
    throw notImplemented("SmartChargingService.applyChargingSchedule (UC13)");
  },
};
