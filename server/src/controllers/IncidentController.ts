// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { INCIDENT_IMPACTS } from "../constants";
import { sendOk } from "../lib/response";
import { requestIdField } from "../lib/schemas";
import { parseOrThrow } from "../middleware/validate";
import { incidentService } from "../services/IncidentService";

export const submitIncidentBody = z.object({
  requestId: requestIdField,
  resourceId: z.string().min(1),
  description: z.string().min(1),
  impactLevel: z.enum(INCIDENT_IMPACTS),
  affectedScope: z.string().min(1),
});
export const submitHandlingPlanBody = z.object({
  requestId: requestIdField,
  plan: z.object({ actionType: z.string().min(1), allocationChanges: z.array(z.string().min(1)) }),
});
export const submitResolutionResultBody = z.object({
  requestId: requestIdField,
  result: z.object({ isResolved: z.boolean(), evidence: z.string().min(1) }),
});

export const incidentController = {
  /** GET /api/incidents (hỗ trợ UI Operator lấy danh sách sự cố và tài nguyên của các Hub) */
  async listOverview(_req: Request, res: Response): Promise<void> {
    sendOk(res, await incidentService.listOverview());
  },

  /** GET /api/incidents/resources/:resourceId */
  async openIncidentManagement(req: Request, res: Response): Promise<void> {
    const { resourceId } = parseOrThrow(z.object({ resourceId: z.string().min(1) }), req.params);
    sendOk(res, await incidentService.getIncidentContext(resourceId));
  },

  /** GET /api/incidents/:incidentId */
  async openExistingIncident(req: Request, res: Response): Promise<void> {
    const { incidentId } = parseOrThrow(z.object({ incidentId: z.string().min(1) }), req.params);
    sendOk(res, await incidentService.getIncidentDetails(incidentId));
  },

  /** POST /api/incidents */
  async submitIncident(req: Request, res: Response): Promise<void> {
    const { requestId, resourceId, description, impactLevel, affectedScope } = req.body as z.infer<typeof submitIncidentBody>;
    sendOk(res, await incidentService.reportIncident(requestId, resourceId, description, impactLevel, affectedScope));
  },

  /** POST /api/incidents/:incidentId/handling-plan */
  async submitHandlingPlan(req: Request, res: Response): Promise<void> {
    const { incidentId } = parseOrThrow(z.object({ incidentId: z.string().min(1) }), req.params);
    const { requestId, plan } = req.body as z.infer<typeof submitHandlingPlanBody>;
    sendOk(res, await incidentService.processHandlingPlan(requestId, incidentId, plan));
  },

  /** POST /api/incidents/:incidentId/resolution */
  async submitResolutionResult(req: Request, res: Response): Promise<void> {
    const { incidentId } = parseOrThrow(z.object({ incidentId: z.string().min(1) }), req.params);
    const { requestId, result } = req.body as z.infer<typeof submitResolutionResultBody>;
    sendOk(res, await incidentService.verifyResolution(requestId, incidentId, result));
  },
};
