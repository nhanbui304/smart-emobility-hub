// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Gọi API của IncidentController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { HandlingPlan, IncidentContext, IncidentDetails, IncidentImpact, IncidentResult, ResolutionResult } from "../types";
import { api } from "./client";

export const incidentApi = {
  /** GET /api/incidents/resources/:resourceId */
  openIncidentManagement: (resourceId: string) =>
    api.get<IncidentContext>(`/incidents/resources/${resourceId}`),
  /** GET /api/incidents/:incidentId */
  openExistingIncident: (incidentId: string) =>
    api.get<IncidentDetails>(`/incidents/${incidentId}`),
  /** POST /api/incidents */
  submitIncident: (
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: IncidentImpact,
    affectedScope: string,
  ) =>
    api.post<IncidentResult>("/incidents", { requestId, resourceId, description, impactLevel, affectedScope }),
  /** POST /api/incidents/:incidentId/handling-plan */
  submitHandlingPlan: (requestId: string, incidentId: string, plan: HandlingPlan) =>
    api.post<IncidentResult>(`/incidents/${incidentId}/handling-plan`, { requestId, plan }),
  /** POST /api/incidents/:incidentId/resolution */
  submitResolutionResult: (requestId: string, incidentId: string, result: ResolutionResult) =>
    api.post<IncidentResult>(`/incidents/${incidentId}/resolution`, { requestId, result }),
};
