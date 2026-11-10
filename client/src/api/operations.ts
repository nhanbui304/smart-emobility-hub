// Owner: Nguyễn Hoàng Nhân (UC10, UC13, UC14), Ngô Minh Triết (UC11), Lê Quốc Linh (UC12)
import { api } from "./client";

export const operationsApi = {
  overview: () => api.get<unknown>("/monitoring/overview"),
  hubDetail: (hubId: string) => api.get<unknown>(`/monitoring/hubs/${hubId}`),
  incidentContext: (resourceId: string) => api.get<unknown>("/incidents/context", { resourceId }),
  incidentDetail: (incidentId: string) => api.get<unknown>(`/incidents/${incidentId}`),
  /** body gồm requestId (crypto.randomUUID()), resourceId, description, impactLevel, affectedScope. */
  reportIncident: (body: Record<string, unknown>) => api.post<unknown>("/incidents", body),
  processHandlingPlan: (incidentId: string, requestId: string, handlingPlan: Record<string, unknown>) =>
    api.post<unknown>(`/incidents/${incidentId}/handling-plan`, { requestId, handlingPlan }),
  verifyResolution: (incidentId: string, requestId: string, resolutionResult: { resolved: boolean; note?: string }) =>
    api.post<unknown>(`/incidents/${incidentId}/verify`, { requestId, resolutionResult }),
  createRedistributionOrder: (body: Record<string, unknown>) => api.post<unknown>("/redistribution-orders", body),
  chargingContext: (params: { hubId: string; startTime: string; endTime: string }) =>
    api.get<unknown>("/charging-schedules/context", params),
  proposeSchedule: (body: Record<string, unknown>) => api.post<unknown>("/charging-schedules/proposals", body),
  validatePlan: (planDraftId: string, adjustments: Array<Record<string, unknown>>) =>
    api.post<unknown>(`/charging-schedules/proposals/${planDraftId}/validate`, { adjustments }),
  /** requestId: crypto.randomUUID() sinh một lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã. */
  applySchedule: (requestId: string, planDraftId: string, baseVersion: number) =>
    api.post<unknown>("/charging-schedules/apply", { requestId, planDraftId, baseVersion }),
  captureSnapshot: (body: Record<string, unknown>) => api.post<unknown>("/simulations/snapshots", body),
  acceptStaleSnapshot: (snapshotId: string) => api.post<unknown>(`/simulations/snapshots/${snapshotId}/accept-stale`, {}),
  prepareScenario: (body: Record<string, unknown>) => api.post<unknown>("/simulations/scenarios", body),
  startSimulation: (requestId: string, scenarioDraftId: string) =>
    api.post<unknown>("/simulations/runs", { requestId, scenarioDraftId }),
  stopSimulation: (runId: string) => api.post<unknown>(`/simulations/runs/${runId}/stop`, {}),
  simulationResult: (runId: string) => api.get<unknown>(`/simulations/runs/${runId}`),
  retrySaveSimulation: (runId: string) => api.post<unknown>(`/simulations/runs/${runId}/retry-save`, {}),
  prepareHandoff: (runId: string, recommendationId: string) =>
    api.post<unknown>(`/simulations/runs/${runId}/handoff`, { recommendationId }),
};
