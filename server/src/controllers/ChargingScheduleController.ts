// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField, timeRangeSchema, versionField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { smartChargingService } from "../services/SmartChargingService";

const contextQuery = z.object({ hubId: z.string().min(1), startTime: z.coerce.date(), endTime: z.coerce.date() });
export const proposalSchema = z.object({
  hubId: z.string().min(1),
  timeRange: timeRangeSchema,
  ruleId: z.string().min(1),
});
export const validatePlanSchema = z.object({
  adjustments: z.array(
    z.object({
      portId: z.string().min(1),
      refId: z.string().min(1),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
    }),
  ),
});
export const applyPlanSchema = z.object({
  requestId: requestIdField,
  planDraftId: z.string().min(1),
  baseVersion: versionField,
});

export const chargingScheduleController = {
  /** GET /api/charging-schedules/context?hubId=&startTime=&endTime= */
  async context(req: Request, res: Response): Promise<void> {
    const q = parseOrThrow(contextQuery, req.query);
    const timeRange = parseOrThrow(timeRangeSchema, { startTime: q.startTime, endTime: q.endTime });
    sendOk(res, await smartChargingService.getChargingContext(q.hubId, timeRange));
  },

  /** POST /api/charging-schedules/proposals */
  async propose(req: Request, res: Response): Promise<void> {
    const { hubId, timeRange, ruleId } = req.body;
    sendOk(res, await smartChargingService.generateProposedSchedule(hubId, timeRange, ruleId));
  },

  /** POST /api/charging-schedules/proposals/:planDraftId/validate */
  async validate(req: Request, res: Response): Promise<void> {
    const { planDraftId } = parseOrThrow(z.object({ planDraftId: z.string().min(1) }), req.params);
    sendOk(res, await smartChargingService.validatePlan(planDraftId, req.body.adjustments));
  },

  /** POST /api/charging-schedules/apply */
  async apply(req: Request, res: Response): Promise<void> {
    const { requestId, planDraftId, baseVersion } = req.body;
    sendOk(
      res,
      await smartChargingService.applyChargingSchedule(requestId, planDraftId, baseVersion, currentUser(req).id),
    );
  },
};
