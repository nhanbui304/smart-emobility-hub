// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation, mục 2.3.1
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, asc, desc, eq, inArray, isNotNull, lte, ne } from "drizzle-orm";
import {
  hubs,
  parkingAllocations,
  parkingSlots,
  privateVehicles,
  redistributionItems,
  redistributionOrders,
  sharedVehicles,
  type ParkingAllocation,
  type ParkingSlot,
  type PrivateVehicle,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type { TimeRange } from "../../lib/schemas";
import type { HubAcceptance, SlotQueryResult } from "../../types/dto";
import { previousResultId, recordProcessedRequest } from "./common";

export const parkingOps = {
  /** UC06 bước 2 (Ext 2b): xe cá nhân có thuộc sinh viên không. UC08 dùng chung. */
  findVehicleRight(studentId: string, vehicleId: string): PrivateVehicle | undefined {
    return db
      .select()
      .from(privateVehicles)
      .where(and(eq(privateVehicles.id, vehicleId), eq(privateVehicles.ownerId, studentId)))
      .get();
  },

  /**
   * UC06 bước 2 (Ext 2c), UC05 bước 3: Hub có tồn tại và còn vị trí đang phục vụ để tiếp nhận xe không.
   * Mọi vị trí thường đều nhận cả xe đạp điện lẫn xe máy điện nên không xét loại xe.
   */
  queryHubAcceptance(hubId: string, vehicleId: string): HubAcceptance {
    const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
    if (!hub) return { hub: undefined, accepting: false };
    return { hub, accepting: listServingSlots(hubId).length > 0 };
  },

  /** UC06 bước 3: vị trí trống trong khoảng thời gian yêu cầu. Chỉ xem, không giữ chỗ. */
  queryAvailableSlots(hubId: string, vehicleId: string, timeRange: TimeRange, now: Date): SlotQueryResult {
    return { options: [], verified: true, slots: listFreeSlots(hubId, timeRange, now) };
  },

  /**
   * UC06 bước 5 – gọi trong db.transaction: kiểm tra lại vị trí còn trống trong khoảng thời gian,
   * tạo ParkingAllocation HELD với holdExpiresAt = holdDeadline (service tính theo mục 2.3.1).
   * HELD đã quá holdExpiresAt không còn chặn chỗ, kể cả khi tác vụ định kỳ chưa chạy.
   * Gửi lặp cùng requestId → trả lại lượt giữ đã tạo (Ext 8d).
   */
  atomicCheckAndHold(
    requestId: string,
    studentId: string,
    slotId: string,
    timeRange: TimeRange,
    holdDeadline: Date,
    vehicleId?: string,
  ): ParkingAllocation {
    const now = new Date();
    const doneId = previousResultId(requestId, studentId, "HOLD_PARKING_SLOT");
    if (doneId) return getAllocation(doneId);

    const activeHold = parkingOps.findActiveHold(studentId, now);
    if (activeHold) {
      throw new AppError(
        "CONFLICT",
        "Bạn đang có một lượt giữ chỗ còn hạn. Hãy xác nhận hoặc bỏ lượt giữ đó trước khi chọn vị trí khác.",
        { activeHold },
      );
    }

    const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, slotId)).get();
    if (!slot || slot.status !== "IN_SERVICE" || slot.hasCharger) {
      throw new AppError("CONFLICT", "Vị trí này không còn phục vụ đặt chỗ đỗ, vui lòng chọn vị trí khác.");
    }
    if (!isSlotFree(slot, timeRange, now)) {
      throw new AppError("CONFLICT", "Vị trí vừa được người khác giữ hoặc đặt. Danh sách vị trí đã được cập nhật.", {
        slots: listFreeSlots(slot.hubId, timeRange, now),
      });
    }
    if (!hasCapacityForNewAllocation(slot.hubId, timeRange, now)) {
      throw new AppError(
        "CONFLICT",
        "Hub không còn đủ sức chứa tiếp nhận (vị trí trống đã được giữ cho xe điều chuyển).",
        { slots: [] },
      );
    }

    // Lưu đúng xe sinh viên đã chọn (tham số vehicleId tùy chọn giữ tương thích chữ ký sơ đồ Sub #3).
    const vehicle = vehicleId
      ? parkingOps.findVehicleRight(studentId, vehicleId)
      : db.select().from(privateVehicles).where(eq(privateVehicles.ownerId, studentId)).get();
    if (!vehicle) throw new AppError("FORBIDDEN", "Bạn không có quyền sử dụng phương tiện này.");

    const hold = db
      .insert(parkingAllocations)
      .values({
        studentId,
        slotId,
        vehicleRef: vehicle.id,
        startTime: timeRange.startTime,
        endTime: timeRange.endTime,
        status: "HELD",
        holdExpiresAt: holdDeadline,
      })
      .returning()
      .get();
    recordProcessedRequest(requestId, studentId, "HOLD_PARKING_SLOT", hold.id);
    return hold;
  },

  /**
   * UC06 bước 8 – gọi trong db.transaction: HELD còn hạn → CONFIRMED trên CÙNG bản ghi (không tạo phân bổ thứ hai).
   * Lượt giữ đã quá hạn → đánh dấu EXPIRED; vị trí ngừng phục vụ → CANCELLED (Ext 8b).
   * Trả về bản ghi sau khi xử lý; service xem status để báo kết quả.
   */
  atomicConfirmHold(requestId: string, studentId: string, holdToken: string, now: Date): ParkingAllocation {
    const doneId = previousResultId(requestId, studentId, "CONFIRM_PARKING_RESERVATION");
    if (doneId) return getAllocation(doneId);

    const allocation = getOwnAllocation(holdToken, studentId);
    if (allocation.status !== "HELD") return allocation;

    if (!allocation.holdExpiresAt || allocation.holdExpiresAt <= now) {
      return setStatus(allocation.id, "EXPIRED");
    }
    const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, allocation.slotId)).get();
    if (!slot || slot.status !== "IN_SERVICE") {
      return setStatus(allocation.id, "CANCELLED");
    }
    const confirmed = setStatus(allocation.id, "CONFIRMED");
    recordProcessedRequest(requestId, studentId, "CONFIRM_PARKING_RESERVATION", confirmed.id);
    return confirmed;
  },

  /** UC06 Ext 7a – gọi trong db.transaction: sinh viên bỏ lượt giữ, HELD → CANCELLED (quá hạn thì EXPIRED). */
  atomicReleaseHold(requestId: string, studentId: string, holdToken: string): ParkingAllocation {
    const doneId = previousResultId(requestId, studentId, "CANCEL_PARKING_HOLD");
    if (doneId) return getAllocation(doneId);

    const allocation = getOwnAllocation(holdToken, studentId);
    if (allocation.status !== "HELD") return allocation;

    const expired = !allocation.holdExpiresAt || allocation.holdExpiresAt <= new Date();
    const released = setStatus(allocation.id, expired ? "EXPIRED" : "CANCELLED");
    recordProcessedRequest(requestId, studentId, "CANCEL_PARKING_HOLD", released.id);
    return released;
  },

  /** Lượt giữ HELD còn hạn của sinh viên (Ext 5b, 7b: mở lại ứng dụng vẫn thấy lượt giữ, không gia hạn). */
  findActiveHold(studentId: string, now: Date): ParkingAllocation | undefined {
    return db
      .select()
      .from(parkingAllocations)
      .where(and(eq(parkingAllocations.studentId, studentId), eq(parkingAllocations.status, "HELD")))
      .orderBy(desc(parkingAllocations.createdAt))
      .all()
      .find((a) => a.holdExpiresAt !== null && a.holdExpiresAt > now);
  },

  /**
   * Mục 2.3.1 – gọi trong db.transaction: HELD đã quá hạn giữ → EXPIRED;
   * đặt chỗ CONFIRMED chưa được dùng khi khung giờ đã kết thúc → EXPIRED. Trả về id các bản ghi đã giải phóng.
   */
  atomicExpireHolds(now: Date): string[] {
    const due = db
      .select()
      .from(parkingAllocations)
      .where(inArray(parkingAllocations.status, ["HELD", "CONFIRMED"]))
      .all()
      .filter((a) =>
        a.status === "HELD" ? a.holdExpiresAt === null || a.holdExpiresAt <= now : a.endTime <= now,
      );
    if (due.length === 0) return [];
    const ids = due.map((a) => a.id);
    db.update(parkingAllocations).set({ status: "EXPIRED" }).where(inArray(parkingAllocations.id, ids)).run();
    return ids;
  },

  /** Cancel Parking Reservation – gọi trong db.transaction: hủy đặt chỗ CONFIRMED khi khung giờ chưa bắt đầu. */
  atomicCancelBooking(studentId: string, bookingId: string, now: Date): ParkingAllocation {
    const booking = getOwnAllocation(bookingId, studentId);
    if (booking.status === "CANCELLED") return booking;
    if (booking.status !== "CONFIRMED") {
      throw new AppError("CONFLICT", "Chỉ hủy được đặt chỗ đã xác nhận và chưa sử dụng.");
    }
    if (booking.startTime <= now) {
      throw new AppError("CONFLICT", "Đã đến khung giờ sử dụng nên không thể hủy đặt chỗ này.");
    }
    return setStatus(booking.id, "CANCELLED");
  },
};

// ---------- Hàm hỗ trợ (không phải method của class); returnOps dùng chung ----------

type AllocationStatus = ParkingAllocation["status"];

function getAllocation(id: string): ParkingAllocation {
  const allocation = db.select().from(parkingAllocations).where(eq(parkingAllocations.id, id)).get();
  if (!allocation) throw new AppError("NOT_FOUND", "Không tìm thấy lượt giữ hoặc đặt chỗ.");
  return allocation;
}

function getOwnAllocation(id: string, studentId: string): ParkingAllocation {
  const allocation = getAllocation(id);
  if (allocation.studentId !== studentId) {
    throw new AppError("FORBIDDEN", "Lượt giữ hoặc đặt chỗ này không thuộc về bạn.");
  }
  return allocation;
}

function setStatus(id: string, status: AllocationStatus): ParkingAllocation {
  return db.update(parkingAllocations).set({ status }).where(eq(parkingAllocations.id, id)).returning().get()!;
}

/** Vị trí thường (không có cổng sạc) đang phục vụ của Hub. Vị trí có cổng sạc dành cho UC07, UC08. */
export function listServingSlots(hubId: string): ParkingSlot[] {
  return db
    .select()
    .from(parkingSlots)
    .where(
      and(eq(parkingSlots.hubId, hubId), eq(parkingSlots.status, "IN_SERVICE"), eq(parkingSlots.hasCharger, false)),
    )
    .orderBy(asc(parkingSlots.code))
    .all();
}

/**
 * Phân bổ còn chặn chỗ trong khoảng thời gian: HELD còn hạn, CONFIRMED chồng lấn thời gian,
 * IN_USE (đang dùng cho lượt trả xe) luôn chặn.
 */
interface ParkingWindow {
  startTime: Date;
  endTime?: Date;
}

function blocks(a: ParkingAllocation, range: ParkingWindow, now: Date): boolean {
  if (a.status === "IN_USE") return true;
  const overlaps = (!range.endTime || a.startTime < range.endTime) && a.endTime > range.startTime;
  if (a.status === "CONFIRMED") return overlaps;
  if (a.status === "HELD") return overlaps && a.holdExpiresAt !== null && a.holdExpiresAt > now;
  return false;
}

function blockedSlotIds(
  slotIds: string[], range: ParkingWindow, now: Date, excludeAllocationId?: string, excludeVehicleId?: string,
): Set<string> {
  const blocked = new Set<string>();
  if (slotIds.length === 0) return blocked;
  // Xe dùng chung đang đỗ chiếm vị trí cho tới khi được nhận đi
  for (const v of db
    .select({ slotId: sharedVehicles.slotId })
    .from(sharedVehicles)
    .where(and(
      isNotNull(sharedVehicles.slotId),
      inArray(sharedVehicles.slotId, slotIds),
      excludeVehicleId ? ne(sharedVehicles.id, excludeVehicleId) : undefined,
    ))
    .all()) {
    if (v.slotId) blocked.add(v.slotId);
  }
  for (const a of db
    .select()
    .from(parkingAllocations)
    .where(
      and(
        inArray(parkingAllocations.slotId, slotIds),
        inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
      ),
    )
    .all()) {
    if (a.id !== excludeAllocationId && blocks(a, range, now)) blocked.add(a.slotId);
  }
  return blocked;
}

/**
 * Số xe đang được điều chuyển tới Hub (UC12: IN_TRANSIT luôn giữ chỗ; PENDING giữ chỗ khi không có ETA hoặc ETA <= range.endTime).
 * Dùng chung giữa UC06 (đặt chỗ), UC05 (trả xe) và UC12 (điều chuyển) để không cấp trùng sức chứa ở Hub đích.
 */
export function inboundRedistributionCount(hubId: string, range: ParkingWindow): number {
  return db
    .select({ status: redistributionItems.status, eta: redistributionOrders.eta })
    .from(redistributionItems)
    .innerJoin(redistributionOrders, eq(redistributionItems.orderId, redistributionOrders.id))
    .where(
      and(
        eq(redistributionOrders.targetHubId, hubId),
        inArray(redistributionItems.status, ["PENDING", "IN_TRANSIT"]),
      ),
    )
    .all()
    .filter((row) => row.status === "IN_TRANSIT" || !row.eta || !range.endTime || row.eta <= range.endTime).length;
}

/** Vị trí thường chưa bị xe đỗ hay phân bổ chặn (chưa trừ phần sức chứa giữ cho điều chuyển). */
function rawFreeSlots(hubId: string, range: ParkingWindow, now: Date, excludeAllocationId?: string): ParkingSlot[] {
  const slots = listServingSlots(hubId);
  const blocked = blockedSlotIds(
    slots.map((s) => s.id),
    range,
    now,
    excludeAllocationId,
  );
  return slots.filter((s) => !blocked.has(s.id));
}

/** Hub còn dư ít nhất 1 chỗ sau khi trừ sức chứa giữ cho các xe điều chuyển tới Hub đích. */
export function hasCapacityForNewAllocation(
  hubId: string, range: ParkingWindow, now: Date, excludeAllocationId?: string,
): boolean {
  return rawFreeSlots(hubId, range, now, excludeAllocationId).length > inboundRedistributionCount(hubId, range);
}

/** Vị trí thường còn trống của Hub trong khoảng thời gian (trả rỗng nếu toàn bộ chỗ trống đã giữ cho xe điều chuyển). */
export function listFreeSlots(hubId: string, range: ParkingWindow, now: Date): ParkingSlot[] {
  const free = rawFreeSlots(hubId, range, now);
  if (free.length <= inboundRedistributionCount(hubId, range)) return [];
  return free;
}

/** Vị trí có trống trong khoảng thời gian không (bỏ qua một phân bổ, ví dụ đặt chỗ của chính lượt trả xe). */
export function isSlotFree(
  slot: ParkingSlot, range: ParkingWindow, now: Date, excludeAllocationId?: string, excludeVehicleId?: string,
): boolean {
  if (slot.status !== "IN_SERVICE" || slot.hasCharger) return false;
  return !blockedSlotIds([slot.id], range, now, excludeAllocationId, excludeVehicleId).has(slot.id);
}

/** Đặt chỗ đã xác nhận của sinh viên cho xe tại Hub, đang trong khung giờ (UC05 bước 3). */
export function findUsableBooking(hubId: string, vehicleId: string, studentId: string, now: Date) {
  return db
    .select({ allocation: parkingAllocations, slot: parkingSlots })
    .from(parkingAllocations)
    .innerJoin(parkingSlots, eq(parkingAllocations.slotId, parkingSlots.id))
    .where(
      and(
        eq(parkingSlots.hubId, hubId),
        eq(parkingAllocations.studentId, studentId),
        eq(parkingAllocations.vehicleRef, vehicleId),
        eq(parkingAllocations.status, "CONFIRMED"),
        lte(parkingAllocations.startTime, now),
      ),
    )
    .all()
    .find((row) => row.allocation.endTime > now);
}
