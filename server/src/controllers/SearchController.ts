// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { VEHICLE_TYPES } from "../constants";
import { sendOk } from "../lib/response";
import { currentUser } from "../middleware/auth";
import { searchService } from "../services/SearchService";

export const searchMobilityOptionsBody = z.object({
  sessionId: z.uuid(),
  criteria: z.object({ purpose: z.string().min(1), originHubId: z.string().min(1), vehicleType: z.enum(VEHICLE_TYPES), minBattery: z.number().int() }),
});
export const confirmOptionSelectionBody = z.object({ sessionId: z.uuid(), optionId: z.string().min(1) });

function scopedSearchId(req: Request, sessionId: string): string {
  return `${currentUser(req).id}:${req.sessionID}:${sessionId}`;
}

export const searchController = {
  /** GET /api/search/form */
  async loadSearchForm(req: Request, res: Response): Promise<void> {
    sendOk(res, await searchService.loadSearchForm());
  },

  /** POST /api/search/options */
  async searchMobilityOptions(req: Request, res: Response): Promise<void> {
    const { criteria, sessionId } = req.body as z.infer<typeof searchMobilityOptionsBody>;
    sendOk(res, await searchService.findSuitableOptions(criteria, scopedSearchId(req, sessionId)));
  },

  /** POST /api/search/selections */
  async confirmOptionSelection(req: Request, res: Response): Promise<void> {
    const { sessionId, optionId } = req.body as z.infer<typeof confirmOptionSelectionBody>;
    sendOk(res, await searchService.confirmOptionSelection(scopedSearchId(req, sessionId), optionId));
  },
};
