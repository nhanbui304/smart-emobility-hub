// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { IncidentImpact } from "../constants";
import type { HandlingPlan, IncidentContext, IncidentDetails, IncidentResult, ResolutionResult, VerificationContext } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const incidentService = {
  async getIncidentContext(resourceId: string): Promise<IncidentContext> {
    throw notImplemented("IncidentService.getIncidentContext");
  },

  async getIncidentDetails(incidentId: string): Promise<IncidentDetails> {
    throw notImplemented("IncidentService.getIncidentDetails");
  },

  /** UC11 bước 1–3: ghi nhận sự cố cho một tài nguyên. */
  async reportIncident(
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: IncidentImpact,
    affectedScope: string,
  ): Promise<IncidentResult> {
    throw notImplemented("IncidentService.reportIncident");
  },

  /** UC11 bước 4–6: xử lý các đặt chỗ bị ảnh hưởng, thông báo sinh viên (notificationService.notifyAffectedUsers). */
  async processHandlingPlan(requestId: string, incidentId: string, plan: HandlingPlan): Promise<IncidentResult> {
    throw notImplemented("IncidentService.processHandlingPlan");
  },

  /** UC11 bước 7: xác nhận đã khắc phục. */
  async verifyResolution(requestId: string, incidentId: string, result: ResolutionResult): Promise<IncidentResult> {
    throw notImplemented("IncidentService.verifyResolution");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function validateIncidentData(
  resourceId: string,
  description: string,
  impactLevel: IncidentImpact,
  affectedScope: string,
): boolean {
  throw notImplemented("IncidentService.validateIncidentData");
}

/** private (–) trong class diagram. */
function identifyChangesToConfirmedCommitments(plan: HandlingPlan): string[] {
  throw notImplemented("IncidentService.identifyChangesToConfirmedCommitments");
}

/** private (–) trong class diagram. */
function evaluateResolutionEvidence(result: ResolutionResult, context: VerificationContext): boolean {
  throw notImplemented("IncidentService.evaluateResolutionEvidence");
}
