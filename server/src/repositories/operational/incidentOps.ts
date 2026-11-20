// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/mtriet-submission3/Draw-io/UC11.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { IncidentImpact, ResourceType } from "../../constants";
import {
  chargingPorts,
  chargingRequests,
  chargingReservations,
  chargingSessions,
  hubs,
  incidents,
  parkingAllocations,
  parkingSlots,
  processedRequests,
  sharedVehicles,
  trips,
  users,
  vehicleReservations,
  type Incident,
  type ProcessedRequest,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type {
  AffectedContext,
  ConsentPlan,
  HandlingPlan,
  IncidentContext,
  IncidentDetails,
  IncidentResult,
  ResolutionResult,
  VerificationContext,
} from "../../types/dto";
import { commonOps } from "./common";

interface ResolvedResource {
  id: string;
  resourceType: ResourceType;
  status: string;
  hubId: string | null;
  slotId?: string | null;
  label: string;
}

export interface IncidentResourceOption {
  id: string;
  resourceType: ResourceType;
  status: string;
  hubName: string;
  label: string;
}

function findProcessedRequestSafe(requestId: string): ProcessedRequest | undefined {
  try {
    return commonOps.findProcessedRequest(requestId);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_IMPLEMENTED") {
      return db
        .select()
        .from(processedRequests)
        .where(eq(processedRequests.requestId, requestId))
        .get();
    }
    throw err;
  }
}

function getOperatorActorId(): string {
  const op =
    db.select().from(users).where(eq(users.role, "OPERATOR")).get() ??
    db.select().from(users).get();
  if (!op) {
    throw new AppError("INTERNAL_ERROR", "Không tìm thấy tài khoản Operator trong hệ thống.");
  }
  return op.id;
}

function resolveResource(resourceId: string): ResolvedResource | undefined {
  const port = db.select().from(chargingPorts).where(eq(chargingPorts.id, resourceId)).get();
  if (port) {
    const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, port.slotId)).get();
    return {
      id: port.id,
      resourceType: "CHARGING_PORT",
      status: port.status,
      hubId: slot?.hubId ?? null,
      slotId: port.slotId,
      label: `Cổng sạc ${slot?.code ?? port.id.slice(0, 8)} (${port.connectorType})`,
    };
  }

  const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, resourceId)).get();
  if (slot) {
    return {
      id: slot.id,
      resourceType: "PARKING_SLOT",
      status: slot.status,
      hubId: slot.hubId,
      slotId: slot.id,
      label: `Vị trí đỗ ${slot.code}`,
    };
  }

  const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, resourceId)).get();
  if (vehicle) {
    return {
      id: vehicle.id,
      resourceType: "SHARED_VEHICLE",
      status: vehicle.status,
      hubId: vehicle.hubId,
      slotId: vehicle.slotId,
      label: `Xe dùng chung ${vehicle.code}`,
    };
  }

  return undefined;
}

/**
 * UC11 Ext 5a (BTL1 tr. 39): Kiểm tra tài nguyên có đang được sử dụng thực tế không
 * (xe đang trong chuyến đi IN_USE, cổng đang có phiên sạc ACTIVE/IN_USE, vị trí đỗ đang IN_USE).
 */
function isResourceCurrentlyInUse(resource: ResolvedResource): boolean {
  if (resource.resourceType === "SHARED_VEHICLE") {
    if (resource.status === "IN_USE") return true;
    const activeTrip = db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.vehicleId, resource.id), inArray(trips.status, ["ACTIVE", "RETURN_IN_PROGRESS"])))
      .get();
    return Boolean(activeTrip);
  }
  if (resource.resourceType === "CHARGING_PORT") {
    if (resource.status === "IN_USE") return true;
    const activeSession = db
      .select({ id: chargingSessions.id })
      .from(chargingSessions)
      .where(and(eq(chargingSessions.portId, resource.id), eq(chargingSessions.status, "ACTIVE")))
      .get();
    return Boolean(activeSession);
  }
  if (resource.resourceType === "PARKING_SLOT") {
    const activeParking = db
      .select({ id: parkingAllocations.id })
      .from(parkingAllocations)
      .where(and(eq(parkingAllocations.slotId, resource.id), eq(parkingAllocations.status, "IN_USE")))
      .get();
    return Boolean(activeParking);
  }
  return false;
}

function setResourceRestrictedStatus(resourceType: ResourceType, resourceId: string, now: Date): void {
  if (resourceType === "CHARGING_PORT") {
    db.update(chargingPorts)
      .set({ status: "OUT_OF_SERVICE", updatedAt: now })
      .where(eq(chargingPorts.id, resourceId))
      .run();
  } else if (resourceType === "PARKING_SLOT") {
    db.update(parkingSlots)
      .set({ status: "OUT_OF_SERVICE", updatedAt: now })
      .where(eq(parkingSlots.id, resourceId))
      .run();
  } else if (resourceType === "SHARED_VEHICLE") {
    db.update(sharedVehicles)
      .set({ status: "UNDER_MAINTENANCE", lastUpdatedAt: now, updatedAt: now })
      .where(eq(sharedVehicles.id, resourceId))
      .run();
  }
}

function restoreResourceOperationalStatus(resourceType: ResourceType, resourceId: string, now: Date): void {
  if (resourceType === "CHARGING_PORT") {
    db.update(chargingPorts)
      .set({ status: "AVAILABLE", updatedAt: now })
      .where(eq(chargingPorts.id, resourceId))
      .run();
  } else if (resourceType === "PARKING_SLOT") {
    db.update(parkingSlots)
      .set({ status: "IN_SERVICE", updatedAt: now })
      .where(eq(parkingSlots.id, resourceId))
      .run();
  } else if (resourceType === "SHARED_VEHICLE") {
    db.update(sharedVehicles)
      .set({ status: "AVAILABLE", lastUpdatedAt: now, updatedAt: now })
      .where(eq(sharedVehicles.id, resourceId))
      .run();
  }
}

export function listIncidentsAndResources(): {
  incidents: Incident[];
  resources: IncidentResourceOption[];
} {
  const allIncidents = db.select().from(incidents).orderBy(desc(incidents.updatedAt)).all();
  const hubById = new Map(db.select().from(hubs).all().map((h) => [h.id, h.name]));
  const resources: IncidentResourceOption[] = [];

  const portsWithSlots = db
    .select({ port: chargingPorts, slot: parkingSlots })
    .from(chargingPorts)
    .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
    .orderBy(parkingSlots.code)
    .all();
  for (const { port, slot } of portsWithSlots) {
    resources.push({
      id: port.id,
      resourceType: "CHARGING_PORT",
      status: port.status,
      hubName: hubById.get(slot.hubId) ?? slot.hubId,
      label: `Cổng sạc ${slot.code} (${port.connectorType}, ${port.maxPowerKw} kW)`,
    });
  }

  const allSlots = db.select().from(parkingSlots).orderBy(parkingSlots.code).all();
  for (const slot of allSlots) {
    resources.push({
      id: slot.id,
      resourceType: "PARKING_SLOT",
      status: slot.status,
      hubName: hubById.get(slot.hubId) ?? slot.hubId,
      label: `Vị trí đỗ ${slot.code}${slot.hasCharger ? " (có sạc)" : ""}`,
    });
  }

  const allVehicles = db.select().from(sharedVehicles).orderBy(sharedVehicles.code).all();
  for (const v of allVehicles) {
    resources.push({
      id: v.id,
      resourceType: "SHARED_VEHICLE",
      status: v.status,
      hubName: v.hubId ? (hubById.get(v.hubId) ?? v.hubId) : "Đang di chuyển",
      label: `Xe ${v.code} (${v.type}, pin ${v.batteryLevel}%)`,
    });
  }

  return { incidents: allIncidents, resources };
}

export const incidentOps = {
  /** UC11 bước 1: Lấy trạng thái hiện tại của tài nguyên và danh sách sự cố đang mở (OPEN / IN_PROGRESS). */
  queryResourceStatusAndOpenIncidents(resourceId: string): IncidentContext {
    const resource = resolveResource(resourceId);
    if (!resource) {
      throw new AppError("NOT_FOUND", "Không tìm thấy tài nguyên yêu cầu trong hệ thống.");
    }

    const openIncidents = db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.resourceId, resourceId),
          inArray(incidents.status, ["OPEN", "IN_PROGRESS"]),
        ),
      )
      .orderBy(desc(incidents.createdAt))
      .all();

    return {
      resourceId,
      resourceStatus: resource.status,
      openIncidents,
    };
  },

  /** UC11 bước 4: Tải chi tiết sự cố kèm danh sách các dịch vụ / đặt chỗ đang bị ảnh hưởng. */
  findIncidentWithAffectedServices(incidentId: string): IncidentDetails {
    const incident = db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
    if (!incident) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi sự cố.");
    }

    const affected = this.queryAffectedHoldsBookingsTripsAndSchedules(
      incident.resourceId,
      incident.affectedScope,
    );

    const affectedServices: string[] = [
      ...affected.affectedHolds.map((id) => `HOLD:${id}`),
      ...affected.affectedBookings.map((id) => `BOOKING:${id}`),
      ...affected.affectedTrips.map((id) => `TRIP:${id}`),
      ...affected.affectedSchedules.map((id) => `SCHEDULE:${id}`),
    ];

    return {
      incident,
      affectedServices,
    };
  },

  /**
   * UC11 bước 3 – trong db.transaction:
   * - Kiểm tra chống gửi lặp requestId (REPORT_INCIDENT).
   * - Tạo bản ghi sự cố OPEN.
   * - Chuyển ngay trạng thái tài nguyên sang OUT_OF_SERVICE / UNDER_MAINTENANCE để chặn cấp mới
   *   (tự động đồng bộ với UC09, UC10 RESOURCE_FAULT và UC13).
   */
  createIncidentAndRestrictNewAllocations(
    requestId: string,
    resourceId: string,
    description: string,
    impactLevel: IncidentImpact,
    affectedScope: string,
  ): IncidentResult {
    return db.transaction(() => {
      const existingReq = findProcessedRequestSafe(requestId);
      if (existingReq) {
        if (existingReq.operation !== "REPORT_INCIDENT") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        return {
          success: true,
          message: "Sự cố đã được ghi nhận trước đó.",
          incidentId: existingReq.resultId,
        };
      }

      const resource = resolveResource(resourceId);
      if (!resource) {
        throw new AppError("NOT_FOUND", "Không tìm thấy tài nguyên cần báo sự cố.");
      }

      const now = new Date();
      const operatorId = getOperatorActorId();
      const currentlyInUse = isResourceCurrentlyInUse(resource);

      const inserted = db
        .insert(incidents)
        .values({
          resourceType: resource.resourceType,
          resourceId: resource.id,
          description: description.trim(),
          impactLevel,
          affectedScope: affectedScope.trim(),
          status: "OPEN",
          reportedBy: operatorId,
          // UC11 Ext 5a: tài nguyên đang được sử dụng → đánh dấu ưu tiên xử lý
          priorityHandling: impactLevel === "HIGH" || currentlyInUse,
          notificationPending: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get()!;

      // UC11 bước 4 & Ext 5a: chặn phân bổ mới qua bản ghi incidents mở;
      // chỉ chuyển status tài nguyên sang OUT_OF_SERVICE / UNDER_MAINTENANCE khi chưa đang IN_USE
      // (không coi việc chặn phân bổ mới là đã dừng sử dụng hoặc giải phóng chỗ đỗ).
      if (!currentlyInUse) {
        setResourceRestrictedStatus(resource.resourceType, resource.id, now);
      }

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: operatorId,
          operation: "REPORT_INCIDENT",
          resultId: inserted.id,
          createdAt: now,
        })
        .run();

      return {
        success: true,
        message: currentlyInUse
          ? `Đã ghi nhận sự cố ưu tiên cho ${resource.label} (đang được sử dụng) và chặn phân bổ mới.`
          : `Đã ghi nhận sự cố cho ${resource.label} và hạn chế phân bổ mới.`,
        incidentId: inserted.id,
      };
    });
  },

  /** UC11 bước 4: Truy vấn các lượt giữ tạm, đặt chỗ, chuyến đi và lịch sạc bị ảnh hưởng bởi sự cố. */
  queryAffectedHoldsBookingsTripsAndSchedules(resourceId: string, _affectedScope: string): AffectedContext {
    const now = new Date();
    const resource = resolveResource(resourceId);
    const affectedHolds: string[] = [];
    const affectedBookings: string[] = [];
    const affectedTrips: string[] = [];
    const affectedSchedules: string[] = [];

    if (!resource) {
      return { affectedHolds, affectedBookings, affectedTrips, affectedSchedules };
    }

    if (resource.resourceType === "PARKING_SLOT" || resource.resourceType === "CHARGING_PORT") {
      const slotId = resource.slotId ?? resource.id;
      const allocs = db
        .select()
        .from(parkingAllocations)
        .where(
          and(
            eq(parkingAllocations.slotId, slotId),
            inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
          ),
        )
        .all();
      for (const a of allocs) {
        if (a.status === "HELD") {
          if (!a.holdExpiresAt || a.holdExpiresAt > now) affectedHolds.push(a.id);
        } else {
          affectedBookings.push(a.id);
        }
      }

      const portIds =
        resource.resourceType === "CHARGING_PORT"
          ? [resource.id]
          : db
              .select({ id: chargingPorts.id })
              .from(chargingPorts)
              .where(eq(chargingPorts.slotId, slotId))
              .all()
              .map((p) => p.id);

      if (portIds.length > 0) {
        const resList = db
          .select({ id: chargingReservations.id })
          .from(chargingReservations)
          .where(
            and(
              inArray(chargingReservations.portId, portIds),
              inArray(chargingReservations.status, ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"]),
            ),
          )
          .all();
        affectedSchedules.push(...resList.map((r) => r.id));

        const reqList = db
          .select({ id: chargingRequests.id })
          .from(chargingRequests)
          .where(
            and(
              inArray(chargingRequests.assignedPortId, portIds),
              inArray(chargingRequests.status, ["ALLOCATED", "CHARGING"]),
            ),
          )
          .all();
        affectedSchedules.push(...reqList.map((r) => r.id));
      }
    }

    if (resource.resourceType === "SHARED_VEHICLE") {
      const vRes = db
        .select({ id: vehicleReservations.id })
        .from(vehicleReservations)
        .where(
          and(
            eq(vehicleReservations.vehicleId, resource.id),
            inArray(vehicleReservations.status, ["RESERVED", "HANDING_OVER", "PENDING_VERIFICATION"]),
          ),
        )
        .all();
      affectedBookings.push(...vRes.map((r) => r.id));

      const activeTrips = db
        .select({ id: trips.id })
        .from(trips)
        .where(
          and(
            eq(trips.vehicleId, resource.id),
            inArray(trips.status, ["ACTIVE", "RETURN_IN_PROGRESS"]),
          ),
        )
        .all();
      affectedTrips.push(...activeTrips.map((t) => t.id));
    }

    return { affectedHolds, affectedBookings, affectedTrips, affectedSchedules };
  },

  /** Kiểm tra các tài nguyên thay thế được liệt kê trong phương án xử lý (nếu có dạng REASSIGN:<resourceId>) có khả dụng không. */
  queryAllocationAvailability(changes: string[]): boolean {
    const openRestrictedIds = new Set(
      db
        .select({ resourceId: incidents.resourceId })
        .from(incidents)
        .where(inArray(incidents.status, ["OPEN", "IN_PROGRESS"]))
        .all()
        .map((i) => i.resourceId),
    );

    for (const change of changes) {
      if (change.startsWith("REASSIGN:")) {
        const targetId = change.slice("REASSIGN:".length).trim();
        const target = resolveResource(targetId);
        if (!target) return false;
        if (openRestrictedIds.has(target.id)) return false;
        if (target.status === "OUT_OF_SERVICE" || target.status === "UNDER_MAINTENANCE") return false;
      }
    }
    return true;
  },

  /** Kiểm tra quyền và tính hợp lệ khi áp dụng phương án xử lý sự cố. */
  checkChangePermission(plan: HandlingPlan, avail: boolean): boolean {
    if (!plan.actionType || plan.actionType.trim().length === 0) return false;
    return avail;
  },

  /** UC11 bước 5 – trong db.transaction: lưu phương án xử lý + kế hoạch xin đồng ý, tăng version, chuyển IN_PROGRESS. */
  saveHandlingPlanAndProgress(
    requestId: string,
    incidentId: string,
    plan: HandlingPlan,
    consentPlan: ConsentPlan,
    expectedVersion: number,
  ): IncidentResult {
    return db.transaction(() => {
      const existingReq = findProcessedRequestSafe(requestId);
      if (existingReq) {
        if (existingReq.operation !== "PROCESS_INCIDENT_HANDLING_PLAN") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        return {
          success: true,
          message: "Phương án xử lý sự cố đã được lưu trước đó.",
          incidentId: existingReq.resultId,
        };
      }

      const current = db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
      if (!current) {
        throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi sự cố.");
      }
      if (current.status === "CLOSED") {
        throw new AppError("CONFLICT", "Sự cố đã được đóng trước đó, không thể cập nhật phương án xử lý.");
      }
      if (current.version !== expectedVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          `Sự cố đã được cập nhật trước đó (phiên bản hiện tại v${current.version}, bạn gửi v${expectedVersion}). Vui lòng tải lại.`,
        );
      }

      const now = new Date();
      const updated = db
        .update(incidents)
        .set({
          status: "IN_PROGRESS",
          handlingPlan: plan,
          consentPlan,
          version: expectedVersion + 1,
          updatedAt: now,
        })
        .where(and(eq(incidents.id, incidentId), eq(incidents.version, expectedVersion)))
        .returning()
        .get();

      if (!updated) {
        throw new AppError("VERSION_CONFLICT", "Sự cố vừa bị thay đổi đồng thời. Vui lòng tải lại.");
      }

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: getOperatorActorId(),
          operation: "PROCESS_INCIDENT_HANDLING_PLAN",
          resultId: updated.id,
          createdAt: now,
        })
        .run();

      return {
        success: true,
        message: "Đã lưu phương án xử lý sự cố và chuyển sang trạng thái Đang xử lý.",
        incidentId: updated.id,
      };
    });
  },

  /** UC11 Ext 7a: Sự cố chưa khắc phục hoàn tất → lưu ghi nhận tiến độ, giữ trạng thái IN_PROGRESS & tiếp tục hạn chế tài nguyên. */
  saveIncidentProgress(requestId: string, incidentId: string, result: ResolutionResult): IncidentResult {
    return db.transaction(() => {
      const existingReq = findProcessedRequestSafe(requestId);
      if (existingReq) {
        if (existingReq.operation !== "VERIFY_INCIDENT_RESOLUTION") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        return {
          success: true,
          message: "Tiến độ khắc phục sự cố đã được ghi nhận trước đó.",
          incidentId: existingReq.resultId,
        };
      }

      const current = db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
      if (!current) {
        throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi sự cố.");
      }
      if (current.status === "CLOSED") {
        throw new AppError("CONFLICT", "Sự cố đã đóng, không thể ghi nhận thêm tiến độ.");
      }

      const now = new Date();
      const updated = db
        .update(incidents)
        .set({
          status: "IN_PROGRESS",
          resolutionNote: result.evidence.trim(),
          version: current.version + 1,
          updatedAt: now,
        })
        .where(eq(incidents.id, incidentId))
        .returning()
        .get()!;

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: getOperatorActorId(),
          operation: "VERIFY_INCIDENT_RESOLUTION",
          resultId: updated.id,
          createdAt: now,
        })
        .run();

      return {
        success: true,
        message: "Đã ghi nhận tiến độ khắc phục; sự cố tiếp tục được theo dõi và tài nguyên vẫn bị hạn chế.",
        incidentId: updated.id,
      };
    });
  },

  /** UC11 bước 7: Truy vấn trạng thái tài nguyên và các ràng buộc / sự cố khác còn tồn tại. */
  queryResourceAndRemainingImpacts(incidentId: string): VerificationContext {
    const incident = db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
    if (!incident) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi sự cố.");
    }

    const resource = resolveResource(incident.resourceId);
    const otherOpenIncidents = db
      .select({ id: incidents.id })
      .from(incidents)
      .where(
        and(
          eq(incidents.resourceId, incident.resourceId),
          ne(incidents.id, incident.id),
          inArray(incidents.status, ["OPEN", "IN_PROGRESS"]),
        ),
      )
      .all();

    const remainingImpacts: string[] = otherOpenIncidents.map((i) => `OTHER_INCIDENT:${i.id}`);

    return {
      resourceStatus: resource?.status ?? "UNKNOWN",
      remainingImpacts,
    };
  },

  /** Kiểm tra tài nguyên còn bị chặn bởi sự cố mở khác hoặc hạn chế chưa gỡ hay không. */
  checkOtherActiveIncidentsOrRestrictions(context: VerificationContext): boolean {
    return context.remainingImpacts.some((item) => item.startsWith("OTHER_INCIDENT:"));
  },

  /** UC11 bước 7 (còn sự cố khác trên cùng tài nguyên): Đóng sự cố này nhưng giữ nguyên hạn chế tài nguyên. */
  closeIncidentKeepResourceRestricted(requestId: string, incidentId: string, auditEntry: string): IncidentResult {
    return db.transaction(() => {
      const existingReq = findProcessedRequestSafe(requestId);
      if (existingReq) {
        if (existingReq.operation !== "VERIFY_INCIDENT_RESOLUTION") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        return {
          success: true,
          message: "Kết quả đóng sự cố đã được xử lý trước đó.",
          incidentId: existingReq.resultId,
        };
      }

      const current = db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
      if (!current) {
        throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi sự cố.");
      }

      const now = new Date();
      const updated = db
        .update(incidents)
        .set({
          status: "CLOSED",
          resolutionNote: auditEntry,
          resolvedAt: now,
          version: current.version + 1,
          updatedAt: now,
        })
        .where(eq(incidents.id, incidentId))
        .returning()
        .get()!;

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: getOperatorActorId(),
          operation: "VERIFY_INCIDENT_RESOLUTION",
          resultId: updated.id,
          createdAt: now,
        })
        .run();

      return {
        success: true,
        message: "Đã đóng sự cố nhưng giữ nguyên hạn chế tài nguyên do vẫn còn sự cố khác đang mở.",
        incidentId: updated.id,
      };
    });
  },

  /** UC11 bước 7 (không còn sự cố nào khác): Đóng sự cố và khôi phục trạng thái phục vụ bình thường của tài nguyên. */
  closeIncidentAndRestoreService(requestId: string, incidentId: string, auditEntry: string): IncidentResult {
    return db.transaction(() => {
      const existingReq = findProcessedRequestSafe(requestId);
      if (existingReq) {
        if (existingReq.operation !== "VERIFY_INCIDENT_RESOLUTION") {
          throw new AppError("CONFLICT", "Mã yêu cầu (requestId) đã được dùng cho một thao tác khác.");
        }
        return {
          success: true,
          message: "Kết quả khắc phục sự cố đã được xử lý trước đó.",
          incidentId: existingReq.resultId,
        };
      }

      const current = db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
      if (!current) {
        throw new AppError("NOT_FOUND", "Không tìm thấy bản ghi sự cố.");
      }

      const now = new Date();
      const updated = db
        .update(incidents)
        .set({
          status: "CLOSED",
          resolutionNote: auditEntry,
          resolvedAt: now,
          version: current.version + 1,
          updatedAt: now,
        })
        .where(eq(incidents.id, incidentId))
        .returning()
        .get()!;

      const resource = resolveResource(current.resourceId);
      if (!resource || !isResourceCurrentlyInUse(resource)) {
        restoreResourceOperationalStatus(current.resourceType, current.resourceId, now);
      }

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: getOperatorActorId(),
          operation: "VERIFY_INCIDENT_RESOLUTION",
          resultId: updated.id,
          createdAt: now,
        })
        .run();

      return {
        success: true,
        message: "Đã xác nhận khắc phục, đóng sự cố và khôi phục trạng thái phục vụ bình thường của tài nguyên.",
        incidentId: updated.id,
      };
    });
  },

  /** UC11 Ext 7a: Đánh dấu sự cố cần gửi lại thông báo (đồng bộ với NotificationService trên main). */
  markIncidentNotificationPending(incidentId: string): void {
    db.update(incidents)
      .set({
        notificationPending: true,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId))
      .run();
  },
};
