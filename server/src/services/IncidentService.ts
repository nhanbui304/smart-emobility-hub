// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC11.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import { INCIDENT_IMPACTS, type IncidentImpact } from "../constants";
import { AppError } from "../lib/errors";
import { operationalRepository } from "../repositories/OperationalRepository";
import type {
  ConsentPlan,
  HandlingPlan,
  IncidentContext,
  IncidentDetails,
  IncidentResult,
  ResolutionResult,
  VerificationContext,
} from "../types/dto";
import { notificationService } from "./NotificationService";

export const incidentService = {
  async getIncidentContext(resourceId: string): Promise<IncidentContext> {
    if (!resourceId || !resourceId.trim()) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng cung cấp mã tài nguyên hợp lệ.");
    }
    return operationalRepository.queryResourceStatusAndOpenIncidents(resourceId);
  },

  async getIncidentDetails(incidentId: string): Promise<IncidentDetails> {
    if (!incidentId || !incidentId.trim()) {
      throw new AppError("VALIDATION_ERROR", "Vui lòng cung cấp mã sự cố hợp lệ.");
    }
    return operationalRepository.findIncidentWithAffectedServices(incidentId);
  },

  /** UC11 bước 1–3: ghi nhận sự cố cho một tài nguyên và hạn chế phân bổ mới. */
  async reportIncident(
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: IncidentImpact,
    affectedScope: string,
  ): Promise<IncidentResult> {
    if (!validateIncidentData(resourceId, description, impactLevel, affectedScope)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Thông tin báo cáo sự cố chưa đầy đủ hoặc mức ảnh hưởng không hợp lệ.",
      );
    }

    return operationalRepository.createIncidentAndRestrictNewAllocations(
      requestId,
      resourceId,
      description,
      impactLevel,
      affectedScope,
    );
  },

  /** UC11 bước 4–6: xử lý các đặt chỗ bị ảnh hưởng, xin đồng ý nếu đổi cam kết, và thông báo sinh viên. */
  async processHandlingPlan(
    requestId: string,
    incidentId: string,
    plan: HandlingPlan,
  ): Promise<IncidentResult> {
    const details = operationalRepository.findIncidentWithAffectedServices(incidentId);
    const affectedContext = operationalRepository.queryAffectedHoldsBookingsTripsAndSchedules(
      details.incident.resourceId,
      details.incident.affectedScope,
    );

    const avail = operationalRepository.queryAllocationAvailability(plan.allocationChanges);
    if (!operationalRepository.checkChangePermission(plan, avail)) {
      throw new AppError(
        "CONFLICT",
        "Phương án xử lý không hợp lệ hoặc tài nguyên thay thế được chọn hiện không khả dụng.",
      );
    }

    const pendingChanges = identifyChangesToConfirmedCommitments(plan);
    const responseDeadline = new Date(
      Date.now() + systemConfig.consentResponseDeadlineMinutes * 60_000,
    );
    const consentPlan: ConsentPlan = {
      pendingChanges,
      responseDeadline,
    };

    const result = operationalRepository.saveHandlingPlanAndProgress(
      requestId,
      incidentId,
      plan,
      consentPlan,
      details.incident.version,
    );

    // Thông báo cho sinh viên bị ảnh hưởng (bọc an toàn để chạy được cả khi NotificationService chưa merge main)
    await safelyNotifyIncidentParties(incidentId, affectedContext, pendingChanges, responseDeadline);

    return result;
  },

  /** UC11 bước 7: xác nhận kết quả khắc phục; đóng sự cố & khôi phục tài nguyên (hoặc giữ hạn chế nếu còn sự cố khác). */
  async verifyResolution(
    requestId: string,
    incidentId: string,
    result: ResolutionResult,
  ): Promise<IncidentResult> {
    const context = operationalRepository.queryResourceAndRemainingImpacts(incidentId);

    if (!evaluateResolutionEvidence(result, context)) {
      return operationalRepository.saveIncidentProgress(requestId, incidentId, result);
    }

    const auditEntry = `Đã xác nhận khắc phục: ${result.evidence.trim()}`;
    const hasOtherRestrictions = operationalRepository.checkOtherActiveIncidentsOrRestrictions(context);

    if (hasOtherRestrictions) {
      return operationalRepository.closeIncidentKeepResourceRestricted(
        requestId,
        incidentId,
        auditEntry,
      );
    }

    return operationalRepository.closeIncidentAndRestoreService(requestId, incidentId, auditEntry);
  },
};

async function safelyNotifyIncidentParties(
  incidentId: string,
  affectedContext: ReturnType<typeof operationalRepository.queryAffectedHoldsBookingsTripsAndSchedules>,
  pendingChanges: string[],
  responseDeadline: Date,
): Promise<void> {
  try {
    const notifyRes = await notificationService.notifyAffectedUsers(incidentId, affectedContext);
    let allSent = notifyRes.sent;
    if (pendingChanges.length > 0) {
      const consentRes = await notificationService.requestUserConsent(
        incidentId,
        pendingChanges,
        responseDeadline,
      );
      allSent = allSent && consentRes.sent;
    }
    if (!allSent) {
      await safelyMarkNotificationPending(incidentId);
    }
  } catch (err) {
    // Trên nhánh độc lập của Triết, NotificationService vẫn là stub notImplemented → không đánh fail luồng UC11
    if (err instanceof AppError && err.code === "NOT_IMPLEMENTED") {
      return;
    }
    await safelyMarkNotificationPending(incidentId);
  }
}

async function safelyMarkNotificationPending(incidentId: string): Promise<void> {
  try {
    await notificationService.markNotificationPending(incidentId);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_IMPLEMENTED") {
      operationalRepository.markIncidentNotificationPending(incidentId);
      return;
    }
    operationalRepository.markIncidentNotificationPending(incidentId);
  }
}

// ---------- Bước nội bộ (method private "–" trong class diagram UC11.drawio) ----------

/** private (–) trong class diagram: kiểm tra tính đầy đủ và hợp lệ của thông tin báo sự cố. */
function validateIncidentData(
  resourceId: string,
  description: string,
  impactLevel: IncidentImpact,
  affectedScope: string,
): boolean {
  if (!resourceId || resourceId.trim().length === 0) return false;
  if (!description || description.trim().length < 3) return false;
  if (!(INCIDENT_IMPACTS as readonly string[]).includes(impactLevel)) return false;
  if (!affectedScope || affectedScope.trim().length === 0) return false;
  return true;
}

/** private (–) trong class diagram: xác định các thay đổi chạm tới cam kết đã xác nhận cần xin đồng ý sinh viên. */
function identifyChangesToConfirmedCommitments(plan: HandlingPlan): string[] {
  return plan.allocationChanges.filter((item) => item.trim().length > 0);
}

/** private (–) trong class diagram: đánh giá bằng chứng xác minh sự cố đã khắc phục hoàn tất hay chưa. */
function evaluateResolutionEvidence(
  result: ResolutionResult,
  _context: VerificationContext,
): boolean {
  return Boolean(result.isResolved) && Boolean(result.evidence && result.evidence.trim().length > 0);
}
