// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import type { ChargingPlan } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

export interface ChargingContext {
  hubId: string;
  timeRange: TimeRange;
  currentPlanVersion: number;
  ports: Array<{ portId: string; status: string; maxPowerKw: number }>;
  demand: Array<{ refId: string; kind: "SHARED_VEHICLE" | "RESERVATION" | "REQUEST"; batteryLevel?: number }>;
}

export interface PlanDraft {
  planDraftId: string;
  hubId: string;
  baseVersion: number;
  assignments: Array<{ portId: string; refId: string; startTime: Date; endTime: Date }>;
  warnings: string[];
}

export const smartChargingService = {
  /** UC13 bước 1–2: dữ liệu đầu vào (cổng, xe cần sạc, lịch đã đặt). */
  async getChargingContext(hubId: string, timeRange: TimeRange): Promise<ChargingContext> {
    throw notImplemented("SmartChargingService.getChargingContext (UC13)");
  },

  /** UC13 bước 3: sinh lịch đề xuất theo quy tắc (ruleId), ví dụ ưu tiên pin thấp. */
  async generateProposedSchedule(hubId: string, timeRange: TimeRange, ruleId: string): Promise<PlanDraft> {
    throw notImplemented("SmartChargingService.generateProposedSchedule (UC13)");
  },

  /** UC13 bước 4: Operator chỉnh tay, hệ thống kiểm tra xung đột. */
  async validatePlan(planDraftId: string, adjustments: PlanDraft["assignments"]): Promise<PlanDraft> {
    throw notImplemented("SmartChargingService.validatePlan (UC13)");
  },

  /** UC13 bước 5–6: áp dụng lịch, kiểm tra baseVersion, thông báo sinh viên bị ảnh hưởng. */
  async applyChargingSchedule(
    requestId: string,
    planDraftId: string,
    baseVersion: number,
    operatorId: string,
  ): Promise<ChargingPlan> {
    throw notImplemented("SmartChargingService.applyChargingSchedule (UC13)");
  },
};
