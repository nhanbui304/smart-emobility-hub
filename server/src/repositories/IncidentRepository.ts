// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import type { Incident } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const incidentRepository = {
  findById(incidentId: string): Incident | undefined {
    throw notImplemented("IncidentRepository.findById (UC11)");
  },

  /** UC11 – trong db.transaction: tạo Incident OPEN và đưa tài nguyên sang trạng thái ngừng phục vụ. */
  atomicReportIncident(input: {
    resourceType: string;
    resourceId: string;
    description: string;
    impactLevel: string;
    now: Date;
  }): Incident {
    throw notImplemented("IncidentRepository.atomicReportIncident (UC11)");
  },

  /** UC11 – áp dụng phương án xử lý cho các đặt chỗ bị ảnh hưởng; version + 1. */
  atomicApplyHandlingPlan(input: { incidentId: string; handlingPlan: unknown; expectedVersion: number }): Incident {
    throw notImplemented("IncidentRepository.atomicApplyHandlingPlan (UC11)");
  },

  /** UC11 – xác nhận khắc phục: RESOLVED và đưa tài nguyên hoạt động lại. */
  atomicResolve(input: { incidentId: string; resolutionResult: unknown; now: Date }): Incident {
    throw notImplemented("IncidentRepository.atomicResolve (UC11)");
  },
};
