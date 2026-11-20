// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField, timeRangeSchema } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { smartChargingService } from "../services/SmartChargingService";

const loadChargingContextQuery = z.object({
  hubId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});
export const generateProposedScheduleBody = z.object({
  hubId: z.string().min(1),
  timeRange: timeRangeSchema,
  ruleId: z.string().min(1),
});
export const validatePlanBody = z.object({
  adjustments: z.array(z.object({ demandId: z.string().min(1).optional(), portId: z.string().min(1), positionId: z.string().min(1), timeRange: timeRangeSchema, allocatedPowerKw: z.number() })),
});
export const applyChargingScheduleBody = z.object({
  requestId: requestIdField,
  planDraftId: z.string().min(1),
  baseVersion: z.number().int().nonnegative(),
});

export const chargingScheduleController = {
  /** GET /api/charging-schedules/context */
  async loadChargingContext(req: Request, res: Response): Promise<void> {
    const { hubId, startTime, endTime } = parseOrThrow(loadChargingContextQuery, req.query);
    const timeRange = parseOrThrow(timeRangeSchema, { startTime, endTime });
    sendOk(res, await smartChargingService.getChargingContext(hubId, timeRange));
  },

  /** POST /api/charging-schedules/proposals */
  async generateProposedSchedule(req: Request, res: Response): Promise<void> {
    const { hubId, timeRange, ruleId } = req.body as z.infer<typeof generateProposedScheduleBody>;
    sendOk(res, await smartChargingService.generateProposedSchedule(hubId, timeRange, ruleId));
  },

  /** POST /api/charging-schedules/proposals/:planDraftId/validate */
  async validatePlan(req: Request, res: Response): Promise<void> {
    const { planDraftId } = parseOrThrow(z.object({ planDraftId: z.string().min(1) }), req.params);
    const { adjustments } = req.body as z.infer<typeof validatePlanBody>;
    sendOk(res, await smartChargingService.validatePlan(planDraftId, adjustments));
  },

  /** POST /api/charging-schedules/apply */
  async applyChargingSchedule(req: Request, res: Response): Promise<void> {
    const { requestId, planDraftId, baseVersion } = req.body as z.infer<typeof applyChargingScheduleBody>;
    sendOk(res, await smartChargingService.applyChargingSchedule(requestId, planDraftId, baseVersion, currentUser(req).id));
  },
};
