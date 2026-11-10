// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Chữ ký method theo Sequence Submission #2 (Hình 2.51–2.54).
// operatorId (tham số cuối) lấy từ phiên đăng nhập, dùng để ghi vết người thao tác.
import type { ImpactLevel, ResourceType } from "../constants";
import type { Incident } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface AffectedScope {
  resourceType: ResourceType;
  /** Các đặt chỗ/lịch sạc/đặt xe bị ảnh hưởng (do Operator xác nhận). */
  affectedReservationIds: string[];
}

/** UC11 bước 1–2 (incidentContext): tình trạng tài nguyên và sự cố đang mở. */
export interface IncidentContext {
  resourceId: string;
  resourceType: ResourceType;
  resourceStatus: string;
  hubId: string;
  /** Sự cố đang mở trên tài nguyên này (Ext 2a: mở chi tiết thay vì tạo trùng). */
  openIncidents: Incident[];
}

/** Một lượt giữ / đặt chỗ / chuyến đi / lịch sạc bị ảnh hưởng (UC11 bước 4). */
export interface AffectedItem {
  refId: string;
  kind: "PARKING_HOLD" | "PARKING_BOOKING" | "VEHICLE_RESERVATION" | "TRIP" | "CHARGING_RESERVATION" | "CHARGING_REQUEST";
  studentId: string;
  startTime?: Date;
}

/** UC11 bước 4: affectedContext. */
export interface AffectedContext {
  items: AffectedItem[];
  /** true nếu có mục cần xử lý trước (markPriorityHandling). */
  priorityHandling: boolean;
}

/** UC11 Ext 2a (getIncidentDetails): sự cố kèm dịch vụ bị ảnh hưởng. */
export interface IncidentDetail {
  incident: Incident;
  affectedContext: AffectedContext;
}

/** UC11 bước 3–4: incidentCreated(incidentRecord, affectedContext). */
export interface IncidentCreated {
  incident: Incident;
  affectedContext: AffectedContext;
}

export interface HandlingPlan {
  expectedVersion: number;
  actions: Array<{
    reservationId: string;
    action: "REALLOCATE" | "CANCEL" | "KEEP";
    targetResourceId?: string;
  }>;
}

/** UC11 bước 6: kết quả xử lý (progress, consent đang chờ, thông báo). */
export interface HandlingResult {
  incident: Incident;
  /** refId các thay đổi đang chờ sinh viên đồng ý. */
  pendingConsentRefIds: string[];
  /** true nếu gửi thông báo thất bại và đã đánh dấu gửi lại sau (Ext 6a). */
  notificationPending: boolean;
}

export interface ResolutionResult {
  resolved: boolean;
  note?: string;
}

export const incidentService = {
  /** UC11 bước 1–2: tình trạng tài nguyên và sự cố đang mở (queryResourceStatusAndOpenIncidents). */
  async getIncidentContext(resourceId: string): Promise<IncidentContext> {
    throw notImplemented("IncidentService.getIncidentContext (UC11)");
  },

  /** UC11 Ext 2a: chi tiết sự cố đang mở (findIncidentWithAffectedServices). */
  async getIncidentDetails(incidentId: string): Promise<IncidentDetail> {
    throw notImplemented("IncidentService.getIncidentDetails (UC11)");
  },

  /**
   * UC11 bước 3–4: kiểm tra gửi lặp (findProcessedRequest); ghi nhận sự cố và chặn phân bổ mới
   * (createIncidentAndRestrictNewAllocations); tìm phần bị ảnh hưởng (queryAffectedHoldsBookingsTripsAndSchedules);
   * đánh dấu ưu tiên (markPriorityHandling).
   */
  async reportIncident(
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: ImpactLevel,
    affectedScope: AffectedScope,
    operatorId: string,
  ): Promise<IncidentCreated> {
    throw notImplemented("IncidentService.reportIncident (UC11)");
  },

  /**
   * UC11 bước 5–6: tải sự cố và phần bị ảnh hưởng (loadIncidentAndAffectedContext), kiểm tra tài nguyên thay thế
   * (queryAllocationAvailability), lưu phương án (saveHandlingPlanAndProgress, kiểm tra expectedVersion);
   * thông báo (notifyAffectedUsers) và xin đồng ý (requestUserConsent); thất bại thì markNotificationPending.
   */
  async processHandlingPlan(
    requestId: string,
    incidentId: string,
    handlingPlan: HandlingPlan,
    operatorId: string,
  ): Promise<HandlingResult> {
    throw notImplemented("IncidentService.processHandlingPlan (UC11)");
  },

  /**
   * UC11 bước 7–8: ghi tiến độ (saveIncidentProgress); kiểm tra tài nguyên và ảnh hưởng còn lại
   * (queryResourceAndRemainingImpacts); đóng sự cố và khôi phục dịch vụ (closeIncidentAndRestoreService)
   * hoặc đóng nhưng vẫn hạn chế tài nguyên (closeIncidentKeepResourceRestricted).
   */
  async verifyResolution(
    requestId: string,
    incidentId: string,
    resolutionResult: ResolutionResult,
    operatorId: string,
  ): Promise<Incident> {
    throw notImplemented("IncidentService.verifyResolution (UC11)");
  },
};
