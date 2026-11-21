// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC11.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import { INCIDENT_IMPACTS, type IncidentImpact } from "../constants";
import type { Incident } from "../db/schema";
import { AppError } from "../lib/errors";
import { operationalRepository } from "../repositories/OperationalRepository";
import {
  listIncidentsAndResources,
  type IncidentResourceOption,
} from "../repositories/operational/incidentOps";
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
  /** Hỗ trợ UI Operator tải danh sách sự cố và tài nguyên của các Hub (đi qua Service đúng phân tầng). */
  async listOverview(): Promise<{ incidents: Incident[]; resources: IncidentResourceOption[] }> {
    return listIncidentsAndResources();
  },

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
    operatorId: string,
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
      operatorId,
    );
  },

  /** UC11 bước 4–6: xử lý các đặt chỗ bị ảnh hưởng, xin đồng ý nếu đổi cam kết, và thông báo sinh viên. */
  async processHandlingPlan(
    requestId: string,
    incidentId: string,
    plan: HandlingPlan,
    operatorId: string,
  ): Promise<IncidentResult> {
    const previous = operationalRepository.findProcessedRequest(requestId);
    if (previous) {
      if (
        previous.actorId !== operatorId ||
        previous.operation !== "PROCESS_INCIDENT_HANDLING_PLAN" ||
        previous.resultId !== incidentId
      ) {
        throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho một thao tác khác.");
      }
      return { success: true, message: "Phương án xử lý sự cố đã được lưu trước đó.", incidentId };
    }
    const details = operationalRepository.findIncidentWithAffectedServices(incidentId);
    const affectedContext = operationalRepository.queryAffectedHoldsBookingsTripsAndSchedules(
      details.incident.resourceId,
      details.incident.affectedScope,
    );

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
      operatorId,
    );

    // Thông báo cho sinh viên bị ảnh hưởng (bọc an toàn để chạy được cả khi NotificationService chưa merge main)
    await safelyNotifyIncidentParties(incidentId, affectedContext, pendingChanges, responseDeadline);

    return result;
  },

  /** UC11 bước 7 & Ext 8a / 9a: xác nhận kết quả khắc phục; đóng sự cố & khôi phục tài nguyên (hoặc giữ hạn chế nếu còn sự cố khác). */
  async verifyResolution(
    requestId: string,
    incidentId: string,
    result: ResolutionResult,
    operatorId: string,
  ): Promise<IncidentResult> {
    const context = operationalRepository.queryResourceAndRemainingImpacts(incidentId);

    // UC11 Ext 8a: Chưa khắc phục xong → lưu tiến độ thành công, giữ trạng thái IN_PROGRESS & giữ hạn chế
    if (!result.isResolved) {
      if (!result.evidence || result.evidence.trim().length === 0) {
        throw new AppError("VALIDATION_ERROR", "Vui lòng nhập ghi chú tiến độ xử lý sự cố.");
      }
      return operationalRepository.saveIncidentProgress(requestId, incidentId, result, operatorId);
    }

    // UC11 Ext 9a: Operator yêu cầu đóng sự cố (isResolved = true) nhưng chưa đủ căn cứ xác nhận khắc phục
    if (!evaluateResolutionEvidence(result, context)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Chưa đủ căn cứ xác nhận khắc phục. Vui lòng bổ sung kết quả kiểm tra kỹ thuật chi tiết trước khi đóng sự cố.",
      );
    }

    const auditEntry = `Đã xác nhận khắc phục: ${result.evidence.trim()}`;
    const hasOtherRestrictions = operationalRepository.checkOtherActiveIncidentsOrRestrictions(context);

    if (hasOtherRestrictions) {
      return operationalRepository.closeIncidentKeepResourceRestricted(
        requestId,
        incidentId,
        auditEntry,
        operatorId,
      );
    }

    return operationalRepository.closeIncidentAndRestoreService(requestId, incidentId, auditEntry, operatorId);
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
  } catch {
    await safelyMarkNotificationPending(incidentId);
  }
}

async function safelyMarkNotificationPending(incidentId: string): Promise<void> {
  try {
    await notificationService.markNotificationPending(incidentId);
  } catch {
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

/** private (–) trong class diagram: đánh giá bằng chứng xác minh sự cố đã khắc phục hoàn tất hay chưa (tối thiểu 5 ký tự). */
function evaluateResolutionEvidence(
  result: ResolutionResult,
  _context: VerificationContext,
): boolean {
  return Boolean(result.isResolved) && Boolean(result.evidence && result.evidence.trim().length >= 5);
}
