// Owner: Lê Quốc Linh – View Hub and Resource Status (luồng mẫu cho cả nhóm)
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { parseOrThrow } from "../middleware/validate";
import { hubService } from "../services/HubService";

const hubIdParams = z.object({ id: z.string().min(1) });

/**
 * Controller CHỈ: đọc request → gọi service → trả response.
 * Không viết nghiệp vụ ở đây.
 */
export const hubController = {
  /** GET /api/hubs */
  list(_req: Request, res: Response): void {
    sendOk(res, hubService.getAllHubStatuses());
  },

  /** GET /api/hubs/:id */
  detail(req: Request, res: Response): void {
    const { id } = parseOrThrow(hubIdParams, req.params);
    sendOk(res, hubService.getHubDetail(id));
  },
};
