// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Gọi API của ChargingScheduleController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type {
  ChargingContext,
  ChargingScheduleVersion,
  PlanAdjustment,
  PlanDraft,
  ScheduleResult,
  TimeRange,
  ValidatedPlan,
} from "../types";
import { api } from "./client";

export const chargingScheduleApi = {
  /** GET /api/charging-schedules/latest?hubId=... */
  getLatestSchedule: (hubId: string) =>
    api.get<ChargingScheduleVersion | null>("/charging-schedules/latest", { hubId }),
  /** GET /api/charging-schedules/context */
  loadChargingContext: (hubId: string, timeRange: TimeRange) =>
    api.get<ChargingContext>("/charging-schedules/context", { hubId, startTime: timeRange.startTime, endTime: timeRange.endTime }),
  /** POST /api/charging-schedules/proposals */
  generateProposedSchedule: (hubId: string, timeRange: TimeRange, ruleId: string) =>
    api.post<PlanDraft>("/charging-schedules/proposals", { hubId, timeRange, ruleId }),
  /** POST /api/charging-schedules/proposals/:planDraftId/validate */
  validatePlan: (planDraftId: string, adjustments: PlanAdjustment[]) =>
    api.post<ValidatedPlan>(`/charging-schedules/proposals/${planDraftId}/validate`, { adjustments }),
  /** POST /api/charging-schedules/apply */
  applyChargingSchedule: (requestId: string, planDraftId: string, baseVersion: number) =>
    api.post<ScheduleResult>("/charging-schedules/apply", { requestId, planDraftId, baseVersion }),
};
