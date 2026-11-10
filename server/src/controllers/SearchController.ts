// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import type { Request, Response } from "express";
import { z } from "zod";
import { VEHICLE_TYPES } from "../constants";
import { sendOk } from "../lib/response";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { searchService } from "../services/SearchService";

export const searchCriteriaSchema = z
  .object({
    purpose: z.enum(["RENT_VEHICLE", "PARK", "CHARGE"]),
    originHubId: z.string().optional(),
    vehicleType: z.enum(VEHICLE_TYPES).optional(),
    minBattery: z.number().int().min(0).max(100).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
  })
  .refine((c) => !c.startTime || !c.endTime || c.endTime > c.startTime, {
    message: "Thời điểm kết thúc phải sau thời điểm bắt đầu.",
  });
export const selectSchema = z.object({ optionId: z.string().min(1) });

export const searchController = {
  /**
   * POST /api/search/options – Sequence: searchMobilityOptions(criteria).
   * Đổi tiêu chí (Ext 4a) thì gọi lại endpoint này.
   */
  async findOptions(req: Request, res: Response): Promise<void> {
    sendOk(res, await searchService.findSuitableOptions(currentUser(req).id, req.body));
  },

  /** POST /api/search/sessions/:sessionId/select – Sequence: confirmOptionSelection(sessionId, optionId) */
  async selectOption(req: Request, res: Response): Promise<void> {
    const { sessionId } = parseOrThrow(z.object({ sessionId: z.string().min(1) }), req.params);
    sendOk(res, await searchService.confirmOptionSelection(currentUser(req).id, sessionId, req.body.optionId));
  },
};
