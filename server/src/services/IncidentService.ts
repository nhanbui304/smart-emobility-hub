// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import type { ImpactLevel, ResourceType } from "@hub/shared";
import type { Incident } from "../db/schema";
import { notImplemented } from "../lib/errors";

// operatorId (tham số cuối) lấy từ phiên đăng nhập, dùng cho runIdempotent và ghi vết người thao tác.

export interface AffectedScope {
  resourceType: ResourceType;
  /** Các đặt chỗ/lịch sạc/đặt xe bị ảnh hưởng (do Operator xác nhận). */
  affectedReservationIds: string[];
}

export interface HandlingPlan {
  expectedVersion: number;
  actions: Array<{
    reservationId: string;
    action: "REALLOCATE" | "CANCEL" | "KEEP";
    targetResourceId?: string;
  }>;
}

export interface ResolutionResult {
  resolved: boolean;
  note?: string;
}

export const incidentService = {
  /** UC11 bước 1–3: ghi nhận sự cố cho một tài nguyên. */
  async reportIncident(
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: ImpactLevel,
    affectedScope: AffectedScope,
    operatorId: string,
  ): Promise<Incident> {
    throw notImplemented("IncidentService.reportIncident (UC11)");
  },

  /** UC11 bước 4–6: xử lý các đặt chỗ bị ảnh hưởng, thông báo sinh viên (emitToUser). */
  async processHandlingPlan(
    requestId: string,
    incidentId: string,
    handlingPlan: HandlingPlan,
    operatorId: string,
  ): Promise<Incident> {
    throw notImplemented("IncidentService.processHandlingPlan (UC11)");
  },

  /** UC11 bước 7: xác nhận đã khắc phục. */
  async verifyResolution(
    requestId: string,
    incidentId: string,
    resolutionResult: ResolutionResult,
    operatorId: string,
  ): Promise<Incident> {
    throw notImplemented("IncidentService.verifyResolution (UC11)");
  },
};
