// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Sequence Sub #2 gọi chung là OperationalRepository; trong code tách theo bảng (xem bảng ánh xạ trong báo cáo).
import type { Incident } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";
import type {
  AffectedContext,
  AffectedScope,
  HandlingPlan,
  IncidentContext,
  ResolutionResult,
} from "../services/IncidentService";
import type { ConsentRequest } from "../services/NotificationService";

export const incidentRepository = {
  findById(incidentId: string): Incident | undefined {
    throw notImplemented("IncidentRepository.findById (UC11)");
  },

  /** UC11 bước 2 (queryResourceStatusAndOpenIncidents). */
  queryResourceStatusAndOpenIncidents(resourceId: string): IncidentContext {
    throw notImplemented("IncidentRepository.queryResourceStatusAndOpenIncidents (UC11)");
  },

  /** UC11 Ext 2a (findIncidentWithAffectedServices). */
  findIncidentWithAffectedServices(incidentId: string): { incident: Incident; affectedContext: AffectedContext } | undefined {
    throw notImplemented("IncidentRepository.findIncidentWithAffectedServices (UC11)");
  },

  /**
   * UC11 bước 3 (createIncidentAndRestrictNewAllocations) – trong db.transaction: requestId đã xử lý → trả sự cố cũ;
   * tạo Incident OPEN, chặn phân bổ mới trên tài nguyên (đổi trạng thái ngừng phục vụ); ghi processed_requests.
   */
  createIncidentAndRestrictNewAllocations(input: {
    requestId: string;
    resourceId: string;
    description: string;
    impactLevel: string;
    affectedScope: AffectedScope;
    operatorId: string;
    now: Date;
  }): Incident {
    throw notImplemented("IncidentRepository.createIncidentAndRestrictNewAllocations (UC11)");
  },

  /** UC11 bước 4 (queryAffectedHoldsBookingsTripsAndSchedules). */
  queryAffectedHoldsBookingsTripsAndSchedules(incidentId: string, now: Date): AffectedContext {
    throw notImplemented("IncidentRepository.queryAffectedHoldsBookingsTripsAndSchedules (UC11)");
  },

  /** UC11 bước 4 (markPriorityHandling). */
  markPriorityHandling(incidentId: string): Incident {
    throw notImplemented("IncidentRepository.markPriorityHandling (UC11)");
  },

  /** UC11 bước 5 (loadIncidentAndAffectedContext). */
  loadIncidentAndAffectedContext(incidentId: string): { incident: Incident; affectedContext: AffectedContext } | undefined {
    throw notImplemented("IncidentRepository.loadIncidentAndAffectedContext (UC11)");
  },

  /** UC11 bước 5 (queryAllocationAvailability): tài nguyên thay thế còn trống cho từng mục cần đổi. */
  queryAllocationAvailability(hubId: string, targetResourceIds: string[], now: Date): Record<string, boolean> {
    throw notImplemented("IncidentRepository.queryAllocationAvailability (UC11)");
  },

  /**
   * UC11 bước 6 (saveHandlingPlanAndProgress) – trong db.transaction: kiểm tra gửi lặp; version phải = expectedVersion;
   * áp dụng phương án cho các mục bị ảnh hưởng, lưu consentPlan, version + 1; ghi processed_requests.
   */
  saveHandlingPlanAndProgress(input: {
    requestId: string;
    incidentId: string;
    handlingPlan: HandlingPlan;
    consentPlan: ConsentRequest[];
    expectedVersion: number;
    operatorId: string;
    now: Date;
  }): Incident {
    throw notImplemented("IncidentRepository.saveHandlingPlanAndProgress (UC11)");
  },

  /** UC11 Ext 6a (markNotificationPending). */
  markNotificationPending(incidentId: string): void {
    throw notImplemented("IncidentRepository.markNotificationPending (UC11)");
  },

  /** UC11 bước 7 (saveIncidentProgress): ghi kết quả khắc phục, kiểm tra gửi lặp. */
  saveIncidentProgress(input: {
    requestId: string;
    incidentId: string;
    resolutionResult: ResolutionResult;
    operatorId: string;
    now: Date;
  }): Incident {
    throw notImplemented("IncidentRepository.saveIncidentProgress (UC11)");
  },

  /** UC11 bước 8 (queryResourceAndRemainingImpacts): tài nguyên đã hoạt động lại chưa, còn mục nào chưa xử lý. */
  queryResourceAndRemainingImpacts(incidentId: string): { resourceReady: boolean; remaining: AffectedContext } {
    throw notImplemented("IncidentRepository.queryResourceAndRemainingImpacts (UC11)");
  },

  /** UC11 bước 8 – trong db.transaction: RESOLVED và đưa tài nguyên hoạt động lại. */
  closeIncidentAndRestoreService(incidentId: string, now: Date): Incident {
    throw notImplemented("IncidentRepository.closeIncidentAndRestoreService (UC11)");
  },

  /** UC11 Ext 8a – trong db.transaction: RESOLVED nhưng tài nguyên vẫn ngừng phục vụ. */
  closeIncidentKeepResourceRestricted(incidentId: string, now: Date): Incident {
    throw notImplemented("IncidentRepository.closeIncidentKeepResourceRestricted (UC11)");
  },
};
