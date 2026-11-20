// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { IncidentImpact } from "../../constants";
import { eq } from "drizzle-orm";
import { incidents } from "../../db/schema";
import type { AffectedContext, ConsentPlan, HandlingPlan, IncidentContext, IncidentDetails, IncidentResult, ResolutionResult, VerificationContext } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const incidentOps = {
  markIncidentNotificationPending(incidentId: string): void {
    db.update(incidents)
      .set({ notificationPending: true, updatedAt: new Date() })
      .where(eq(incidents.id, incidentId))
      .run();
  },

  queryResourceStatusAndOpenIncidents(resourceId: string): IncidentContext {
    throw notImplemented("OperationalRepository.queryResourceStatusAndOpenIncidents");
  },

  findIncidentWithAffectedServices(incidentId: string): IncidentDetails {
    throw notImplemented("OperationalRepository.findIncidentWithAffectedServices");
  },

  createIncidentAndRestrictNewAllocations(
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: IncidentImpact,
    affectedScope: string,
  ): IncidentResult {
    throw notImplemented("OperationalRepository.createIncidentAndRestrictNewAllocations");
  },

  queryAffectedHoldsBookingsTripsAndSchedules(resourceId: string, affectedScope: string): AffectedContext {
    throw notImplemented("OperationalRepository.queryAffectedHoldsBookingsTripsAndSchedules");
  },

  queryAllocationAvailability(changes: string[]): boolean {
    throw notImplemented("OperationalRepository.queryAllocationAvailability");
  },

  checkChangePermission(plan: HandlingPlan, avail: boolean): boolean {
    throw notImplemented("OperationalRepository.checkChangePermission");
  },

  saveHandlingPlanAndProgress(
    requestId: string,
    incidentId: string,
    plan: HandlingPlan,
    consentPlan: ConsentPlan,
    expectedVersion: number,
  ): IncidentResult {
    throw notImplemented("OperationalRepository.saveHandlingPlanAndProgress");
  },

  saveIncidentProgress(requestId: string, incidentId: string, result: ResolutionResult): IncidentResult {
    throw notImplemented("OperationalRepository.saveIncidentProgress");
  },

  queryResourceAndRemainingImpacts(incidentId: string): VerificationContext {
    throw notImplemented("OperationalRepository.queryResourceAndRemainingImpacts");
  },

  checkOtherActiveIncidentsOrRestrictions(context: VerificationContext): boolean {
    throw notImplemented("OperationalRepository.checkOtherActiveIncidentsOrRestrictions");
  },

  closeIncidentKeepResourceRestricted(requestId: string, incidentId: string, auditEntry: string): IncidentResult {
    throw notImplemented("OperationalRepository.closeIncidentKeepResourceRestricted");
  },

  closeIncidentAndRestoreService(requestId: string, incidentId: string, auditEntry: string): IncidentResult {
    throw notImplemented("OperationalRepository.closeIncidentAndRestoreService");
  },
};
