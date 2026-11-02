// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import type { Request, Response } from "express";
import { z } from "zod";
import { VehicleType, enumValues } from "@hub/shared";
import { sendOk } from "../lib/response";
import { parseOrThrow } from "../middleware/validate";
import { searchService } from "../services/SearchService";

export const searchCriteriaSchema = z.object({
  purpose: z.enum(["RENT_VEHICLE", "PARK", "CHARGE"]),
  originHubId: z.string().optional(),
  vehicleType: z.enum(enumValues(VehicleType)).optional(),
  minBattery: z.number().int().min(0).max(100).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
});
export const filterSchema = searchCriteriaSchema.extend({ sessionId: z.string().min(1) });
export const selectSchema = z.object({ optionId: z.string().min(1) });

export const searchController = {
  /** POST /api/search/options */
  async findOptions(req: Request, res: Response): Promise<void> {
    sendOk(res, await searchService.findSuitableOptions(req.body));
  },

  /** POST /api/search/filter */
  async filterOptions(req: Request, res: Response): Promise<void> {
    const { sessionId, ...criteria } = req.body;
    sendOk(res, await searchService.filterSuitableOptions(criteria, { sessionId }));
  },

  /** POST /api/search/sessions/:sessionId/select */
  async selectOption(req: Request, res: Response): Promise<void> {
    const { sessionId } = parseOrThrow(z.object({ sessionId: z.string().min(1) }), req.params);
    sendOk(res, await searchService.confirmOptionSelection(sessionId, req.body.optionId));
  },
};
