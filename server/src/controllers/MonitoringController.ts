// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { parseOrThrow } from "../middleware/validate";
import { monitoringService } from "../services/MonitoringService";

export const monitoringController = {
  /** GET /api/monitoring/overview */
  async overview(_req: Request, res: Response): Promise<void> {
    sendOk(res, await monitoringService.getNetworkOverview());
  },

  /** GET /api/monitoring/hubs/:hubId */
  async hubDetail(req: Request, res: Response): Promise<void> {
    const { hubId } = parseOrThrow(z.object({ hubId: z.string().min(1) }), req.params);
    sendOk(res, await monitoringService.getHubDetail(hubId));
  },
};
