// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC13.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import {
  chargingPorts,
  chargingRequests,
  chargingReservations,
  chargingScheduleVersions,
  chargingSessions,
  hubs,
  incidents,
  parkingAllocations,
  parkingSlots,
  processedRequests,
  sharedVehicles,
  users,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type { TimeRange } from "../../lib/schemas";
import type {
  ApplyResult,
  BatteryReading,
  ChargingContext,
  ChargingDemand,
  PlanDraft,
  PositionHold,
  ResourceRestriction,
} from "../../types/dto";
import { commonOps } from "./common";

/** Lưu bản nháp kế hoạch sạc trong phiên điều phối của Operator (UC13 bước 4–8). */
export interface StoredPlanDraft {
  draft: PlanDraft;
  hubId: string;
  timeRange: TimeRange;
  ruleId: string;
  baseVersion: number;
  demandPortMap: Map<string, string>; // demandId -> portId
  createdAt: Date;
}

const planDraftStore = new Map<string, StoredPlanDraft>();

export function savePlanDraft(entry: StoredPlanDraft): void {
  planDraftStore.set(entry.draft.planDraftId, entry);
}

export function getStoredPlanDraft(planDraftId: string): StoredPlanDraft | undefined {
  return planDraftStore.get(planDraftId);
}

export function getLatestScheduleVersionNumber(hubId: string): number {
  const latest = db
    .select()
    .from(chargingScheduleVersions)
    .where(eq(chargingScheduleVersions.hubId, hubId))
    .orderBy(desc(chargingScheduleVersions.version))
    .get();
  return latest?.version ?? 0;
}

export function listHubChargingPortsWithSlots(hubId: string) {
  return db
    .select({
      port: chargingPorts,
      slot: parkingSlots,
    })
    .from(chargingPorts)
    .innerJoin(parkingSlots, eq(chargingPorts.slotId, parkingSlots.id))
    .where(eq(parkingSlots.hubId, hubId))
    .orderBy(parkingSlots.code)
    .all();
}

export const chargingScheduleOps = {
  /**
   * UC13 bước 2: Tải nhu cầu sạc, mức pin, phiên đang chạy, lịch đã xác nhận,
   * các lượt giữ vị trí còn hiệu lực, khả năng cung cấp điện tại Hub và tài nguyên bị hạn chế do sự cố.
   */
  queryChargingContext(hubId: string, timeRange: TimeRange): ChargingContext {
    const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
    if (!hub) {
      throw new AppError("NOT_FOUND", "Không tìm thấy Mobility Hub.");
    }

    const now = new Date();
    const hubSlots = db.select().from(parkingSlots).where(eq(parkingSlots.hubId, hubId)).all();
    const hubPortsWithSlots = listHubChargingPortsWithSlots(hubId);
    const hubVehicles = db
      .select()
      .from(sharedVehicles)
      .where(eq(sharedVehicles.hubId, hubId))
      .orderBy(sharedVehicles.code)
      .all();

    const portIds = hubPortsWithSlots.map((p) => p.port.id);
    const slotIds = hubSlots.map((s) => s.id);
    const vehicleIds = hubVehicles.map((v) => v.id);

    // 1. Tài nguyên bị hạn chế do ngừng phục vụ hoặc sự cố đang mở (UC11 bước 4 & UC13 bước 2)
    const restrictedResources: ResourceRestriction[] = [];
    const restrictedSet = new Set<string>();

    for (const s of hubSlots) {
      if (s.status === "OUT_OF_SERVICE") {
        restrictedSet.add(s.id);
        restrictedResources.push({
          resourceId: s.id,
          reason: `Vị trí đỗ ${s.code} đang ngừng hoạt động`,
        });
      }
    }
    for (const { port, slot } of hubPortsWithSlots) {
      if (port.status === "OUT_OF_SERVICE") {
        restrictedSet.add(port.id);
        restrictedResources.push({
          resourceId: port.id,
          reason: `Cổng sạc tại ô ${slot.code} đang ngừng hoạt động`,
        });
      }
    }
    for (const v of hubVehicles) {
      if (v.status === "UNDER_MAINTENANCE") {
        restrictedSet.add(v.id);
        restrictedResources.push({
          resourceId: v.id,
          reason: `Xe ${v.code} đang bảo trì kỹ thuật`,
        });
      }
    }

    // Kiểm tra thêm bảng incidents (OPEN / IN_PROGRESS)
    const openIncidents = db
      .select()
      .from(incidents)
      .where(inArray(incidents.status, ["OPEN", "IN_PROGRESS"]))
      .all();
    for (const inc of openIncidents) {
      const belongsToHub =
        portIds.includes(inc.resourceId) ||
        slotIds.includes(inc.resourceId) ||
        vehicleIds.includes(inc.resourceId);
      if (belongsToHub && !restrictedSet.has(inc.resourceId)) {
        restrictedSet.add(inc.resourceId);
        restrictedResources.push({
          resourceId: inc.resourceId,
          reason: `Sự cố đang xử lý: ${inc.description}`,
        });
      }
    }

    // 2. Phiên sạc đang chạy (ACTIVE) tại các cổng của Hub
    const activeSessions =
      portIds.length === 0
        ? []
        : db
            .select()
            .from(chargingSessions)
            .where(and(inArray(chargingSessions.portId, portIds), eq(chargingSessions.status, "ACTIVE")))
            .all();

    // 3. Lịch sạc đã xác nhận (CONFIRMED, CHARGING, AWAITING_DISCONNECT) giao với khoảng thời gian điều phối
    const confirmedReservations =
      portIds.length === 0
        ? []
        : db
            .select()
            .from(chargingReservations)
            .where(
              and(
                inArray(chargingReservations.portId, portIds),
                inArray(chargingReservations.status, ["CONFIRMED", "CHARGING", "AWAITING_DISCONNECT"]),
                lt(chargingReservations.startTime, timeRange.endTime),
                gt(chargingReservations.endTime, timeRange.startTime),
              ),
            )
            .all();

    // 4. Các lượt giữ vị trí đỗ còn hiệu lực (HELD còn hạn, CONFIRMED, IN_USE) trên các vị trí có cổng sạc
    const chargerSlotIds = hubPortsWithSlots.map((p) => p.slot.id);
    const overlappingAllocations =
      chargerSlotIds.length === 0
        ? []
        : db
            .select()
            .from(parkingAllocations)
            .where(
              and(
                inArray(parkingAllocations.slotId, chargerSlotIds),
                inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
                lt(parkingAllocations.startTime, timeRange.endTime),
                gt(parkingAllocations.endTime, timeRange.startTime),
              ),
            )
            .all()
            .filter((a) => a.status !== "HELD" || !a.holdExpiresAt || a.holdExpiresAt > now);

    const activeHolds: PositionHold[] = overlappingAllocations.map((a) => ({
      positionId: a.slotId,
      timeRange: {
        startTime: a.startTime,
        endTime: a.endTime,
      },
    }));

    // 5. Tổng hợp nhu cầu sạc (demands) và mức pin (batteryLevels)
    const demands: ChargingDemand[] = [];
    const seenVehicleIds = new Set<string>();
    const batteryMap = new Map<string, number>();

    for (const v of hubVehicles) {
      batteryMap.set(v.id, v.batteryLevel);
    }

    // 5a. Nhu cầu từ bảng charging_requests (yêu cầu sạc do sinh viên gửi tại Hub)
    const hubRequests = db
      .select()
      .from(chargingRequests)
      .where(
        and(
          eq(chargingRequests.hubId, hubId),
          inArray(chargingRequests.status, ["WAITING", "ALLOCATED", "CHARGING"]),
        ),
      )
      .orderBy(chargingRequests.createdAt)
      .all();

    for (const req of hubRequests) {
      if (restrictedSet.has(req.vehicleId)) continue;
      demands.push({
        demandId: req.id,
        vehicleId: req.vehicleId,
        chargingNeed: {
          currentBattery: req.currentBattery,
          targetBattery: req.targetBattery,
        },
      });
      seenVehicleIds.add(req.vehicleId);
      if (!batteryMap.has(req.vehicleId)) {
        batteryMap.set(req.vehicleId, req.currentBattery);
      }
    }

    // 5b. Nhu cầu sạc của xe dùng chung tại Hub (BTL1 trang 25: "Sau khi xe dùng chung đã được trả,
    // nhu cầu sạc của xe thuộc phạm vi điều phối vận hành")
    for (const v of hubVehicles) {
      if (seenVehicleIds.has(v.id) || restrictedSet.has(v.id)) continue;
      const needsCharging =
        v.status === "CHARGING" || (v.status === "AVAILABLE" && v.batteryLevel < 85);
      if (needsCharging) {
        demands.push({
          demandId: `demand-${v.code}`,
          vehicleId: v.id,
          chargingNeed: {
            currentBattery: v.batteryLevel,
            targetBattery: 90,
          },
        });
        seenVehicleIds.add(v.id);
      }
    }

    const batteryLevels: BatteryReading[] = Array.from(batteryMap.entries()).map(
      ([vehicleId, batteryLevel]) => ({
        vehicleId,
        batteryLevel,
      }),
    );

    // 6. Khả năng cung cấp điện tại Hub (hubPowerCapacityKw):
    // Tính tổng công suất các cổng đang hoạt động (không bị OUT_OF_SERVICE), áp hệ số tải lưới trạm 85%
    const totalActivePortPowerKw = hubPortsWithSlots
      .filter((p) => !restrictedSet.has(p.port.id) && !restrictedSet.has(p.slot.id))
      .reduce((sum, p) => sum + p.port.maxPowerKw, 0);
    const hubPowerCapacityKw = Math.round(totalActivePortPowerKw * 0.85 * 10) / 10;

    return {
      demands,
      batteryLevels,
      activeSessions,
      confirmedReservations,
      activeHolds,
      hubPowerCapacityKw,
      restrictedResources,
    };
  },

  /**
   * UC13 bước 8: Áp dụng kế hoạch sạc mới trong một giao dịch nhất quán (db.transaction):
   * - Kiểm tra gửi lặp bằng requestId (Ext 8c) -> trả lại kết quả cũ nếu đã xử lý.
   * - Kiểm tra baseVersion khớp với phiên bản hiện tại của Hub (Ext 8a).
   * - Kiểm tra lại các cổng / vị trí trong kế hoạch không phát sinh sự cố mới (Ext 8a).
   * - Lưu bản ghi mới vào bảng charging_schedule_versions và processed_requests.
   * - Không tự ghi nhận xe đã bắt đầu sạc (Bước 9).
   */
  atomicApplyChargingSchedule(requestId: string, planDraftId: string, baseVersion: number): ApplyResult {
    return db.transaction(() => {
      // 1. Kiểm tra gửi lặp (UC13 Ext 8c)
      const existingReq = commonOps.findProcessedRequest(requestId);
      if (existingReq) {
        const prevVersion = db
          .select()
          .from(chargingScheduleVersions)
          .where(eq(chargingScheduleVersions.id, existingReq.resultId))
          .get();
        if (prevVersion) {
          return {
            scheduleVersionId: prevVersion.id,
            allocations: prevVersion.allocations,
            changeSummary: { allocations: prevVersion.allocations },
            appliedNow: false,
          };
        }
      }

      // 2. Tìm bản nháp kế hoạch
      const stored = getStoredPlanDraft(planDraftId);
      if (!stored) {
        throw new AppError(
          "NOT_FOUND",
          "Không tìm thấy bản nháp kế hoạch sạc hoặc bản nháp đã hết hạn. Vui lòng tạo lại đề xuất.",
        );
      }

      // 3. Kiểm tra baseVersion (UC13 Ext 8a: Nhu cầu, tài nguyên hoặc kế hoạch đã thay đổi)
      const currentVersion = getLatestScheduleVersionNumber(stored.hubId);
      if (currentVersion !== baseVersion) {
        throw new AppError(
          "VERSION_CONFLICT",
          `Kế hoạch sạc tại Hub đã thay đổi (phiên bản hiện tại: v${currentVersion}, phiên bản đang sửa: v${baseVersion}). Vui lòng tải lại dữ liệu.`,
          { currentVersion, baseVersion },
        );
      }

      // 4. Kiểm tra lại tài nguyên trong kế hoạch không bị sự cố mới phát sinh sau bước 5 (UC13 Ext 8a)
      const freshContext = this.queryChargingContext(stored.hubId, stored.timeRange);
      const restrictedIds = new Set(freshContext.restrictedResources.map((r) => r.resourceId));
      for (const alloc of stored.draft.proposedAllocations) {
        if (restrictedIds.has(alloc.portId) || restrictedIds.has(alloc.positionId)) {
          throw new AppError(
            "CONFLICT",
            "Tài nguyên sạc trong kế hoạch vừa bị hạn chế do sự cố mới phát sinh. Vui lòng tải lại dữ liệu.",
          );
        }
      }

      const totalAllocatedKw = stored.draft.proposedAllocations.reduce(
        (sum, a) => sum + a.allocatedPowerKw,
        0,
      );
      if (totalAllocatedKw > freshContext.hubPowerCapacityKw + 1e-6) {
        throw new AppError(
          "CONFLICT",
          `Công suất khả dụng tại Hub đã thay đổi (${freshContext.hubPowerCapacityKw} kW < ${totalAllocatedKw.toFixed(1)} kW). Vui lòng tải lại dữ liệu.`,
        );
      }

      // 5. Lưu phiên bản kế hoạch mới (version = baseVersion + 1)
      const now = new Date();
      const inserted = db
        .insert(chargingScheduleVersions)
        .values({
          hubId: stored.hubId,
          version: baseVersion + 1,
          allocations: stored.draft.proposedAllocations,
          appliedAt: now,
          notificationPending: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get()!;

      // Cập nhật cổng được phân bổ cho các yêu cầu sạc WAITING thuộc servedRequests (không tự bắt đầu phiên sạc)
      for (const demandId of stored.draft.servedRequests) {
        const assignedPortId = stored.demandPortMap.get(demandId);
        if (assignedPortId && !demandId.startsWith("demand-")) {
          db.update(chargingRequests)
            .set({
              assignedPortId,
              status: "ALLOCATED",
              updatedAt: now,
            })
            .where(and(eq(chargingRequests.id, demandId), eq(chargingRequests.status, "WAITING")))
            .run();
        }
      }

      // 6. Ghi nhận processed_requests chống gửi lặp
      const operatorUser =
        db.select().from(users).where(eq(users.role, "OPERATOR")).get() ??
        db.select().from(users).get()!;

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: operatorUser.id,
          operation: "APPLY_CHARGING_PLAN",
          resultId: inserted.id,
          createdAt: now,
        })
        .run();

      return {
        scheduleVersionId: inserted.id,
        allocations: inserted.allocations,
        changeSummary: { allocations: inserted.allocations },
        appliedNow: true,
      };
    });
  },

  /** UC13 Ext 9a: đánh dấu kế hoạch cần gửi lại thông báo khi gửi thông báo thất bại. */
  markNotificationPending(scheduleVersionId: string): void {
    db.update(chargingScheduleVersions)
      .set({
        notificationPending: true,
        updatedAt: new Date(),
      })
      .where(eq(chargingScheduleVersions.id, scheduleVersionId))
      .run();
  },
};
