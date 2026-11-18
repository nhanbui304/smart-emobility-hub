// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { parseOrThrow } from "../middleware/validate";
import { monitoringService } from "../services/MonitoringService";

export const monitoringController = {
  /** GET /api/monitoring/overview */
  async overview(req: Request, res: Response): Promise<void> {
    sendOk(res, await monitoringService.getNetworkOverview());
  },

  /** GET /api/monitoring/hubs/:hubId */
  async hubDetail(req: Request, res: Response): Promise<void> {
    const { hubId } = parseOrThrow(z.object({ hubId: z.string().min(1) }), req.params);
    sendOk(res, await monitoringService.getHubDetail(hubId));
  },
};
