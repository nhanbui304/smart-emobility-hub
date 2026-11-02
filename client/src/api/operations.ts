// Owner: Nguyễn Hoàng Nhân (UC10, UC13, UC14), Ngô Minh Triết (UC11), Lê Quốc Linh (UC12)
import { api } from "./client";

export const operationsApi = {
  overview: () => api.get<unknown>("/monitoring/overview"),
  hubDetail: (hubId: string) => api.get<unknown>(`/monitoring/hubs/${hubId}`),
  reportIncident: (body: Record<string, unknown>) => api.post<unknown>("/incidents", body),
  createRedistributionOrder: (body: Record<string, unknown>) => api.post<unknown>("/redistribution-orders", body),
  chargingContext: (params: { hubId: string; startTime: string; endTime: string }) =>
    api.get<unknown>("/charging-schedules/context", params),
  proposeSchedule: (body: Record<string, unknown>) => api.post<unknown>("/charging-schedules/proposals", body),
  captureSnapshot: (body: Record<string, unknown>) => api.post<unknown>("/simulations/snapshots", body),
  startSimulation: (requestId: string, scenarioDraftId: string) =>
    api.post<unknown>("/simulations/runs", { requestId, scenarioDraftId }),
};
