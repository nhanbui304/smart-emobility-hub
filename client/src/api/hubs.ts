// Owner: Lê Quốc Linh – View Hub and Resource Status, View My Reservations
import type { HubDetail, HubStatus } from "../types";
import { api } from "./client";

export const hubApi = {
  list: () => api.get<HubStatus[]>("/hubs"),
  detail: (id: string) => api.get<HubDetail>(`/hubs/${id}`),
  myReservations: () => api.get<unknown>("/me/reservations"),
};
