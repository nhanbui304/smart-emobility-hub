// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq, inArray } from "drizzle-orm";
import { systemConfig } from "../../config/systemConfig";
import type { VehicleStatus } from "../../constants";
import {
  hubs,
  parkingAllocations,
  parkingSlots,
  sharedVehicles,
  trips,
  type ParkingAllocation,
  type Trip,
} from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type { TimeRange } from "../../lib/schemas";
import type {
  HubReturnContext,
  LockResult,
  ReturnAllocation,
  ReturnHandoverContext,
  ReturnSlotPlan,
} from "../../types/dto";
import { previousResultId, recordProcessedRequest } from "./common";
import { findUsableBooking, isSlotFree, listFreeSlots, listServingSlots } from "./parkingOps";

export const returnOps = {
  findTripForReturn(tripId: string): Trip | undefined {
    return db.select().from(trips).where(eq(trips.id, tripId)).get();
  },

  /**
   * UC05 bước 3: Hub có tiếp nhận không, đặt chỗ đã xác nhận phù hợp với xe (nếu có, còn dùng được)
   * và các vị trí còn trống. Xét cả lượt giữ tạm còn hạn và phân bổ còn hiệu lực.
   */
  queryHubReturnContext(hubId: string, vehicleId: string, studentId: string, now: Date): HubReturnContext {
    const hub = db.select().from(hubs).where(eq(hubs.id, hubId)).get();
    if (!hub) return { hubId, accepting: false, availableSlots: [] };
    const window = returnWindow(now);
    const booking = findUsableBooking(hubId, vehicleId, studentId, now);
    // Ext 3c: vị trí của đặt chỗ đang sự cố hoặc bị chiếm thì không dùng (không hủy đặt chỗ)
    const bookingUsable = booking && isSlotFree(booking.slot, window, now, booking.allocation.id);
    return {
      hubId,
      accepting: listServingSlots(hubId).length > 0,
      confirmedBooking: bookingUsable ? booking.allocation : undefined,
      availableSlots: listFreeSlots(hubId, window, now),
    };
  },

  /**
   * UC05 bước 4 – gọi trong db.transaction: kiểm tra lại và phân bổ vị trí (dùng đặt chỗ đã xác nhận nếu có),
   * Trip → RETURN_IN_PROGRESS. Phân bổ cho lượt trả xe có trạng thái IN_USE, không hết hạn theo giờ.
   * Không giữ hai chỗ cho cùng lần trả: đổi Hub thì trả lại chỗ cũ. Gửi lặp → trả kết quả cũ.
   */
  atomicAllocateReturnSlot(
    requestId: string,
    tripId: string,
    hubId: string,
    slotPlan: ReturnSlotPlan,
  ): ReturnAllocation {
    const now = new Date();
    const trip = getTrip(tripId);
    const doneId = previousResultId(requestId, trip.studentId, "PREPARE_RETURN");
    if (doneId) return { trip, allocation: getAllocation(doneId) };
    if (trip.status !== "ACTIVE" && trip.status !== "RETURN_IN_PROGRESS") {
      throw new AppError("CONFLICT", "Chuyến đi không ở trạng thái có thể trả xe.");
    }

    const current = findReturnAllocation(trip);
    if (current) {
      if (trip.returnHubId === hubId) return { trip, allocation: current };
      releaseReturnAllocation(trip, current);
    }

    const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, slotPlan.slotId)).get();
    if (!slot || slot.hubId !== hubId) throw new AppError("CONFLICT", "Vị trí không thuộc Hub đã chọn.");

    let allocation: ParkingAllocation;
    if (slotPlan.bookingId) {
      const booking = getAllocation(slotPlan.bookingId);
      if (booking.status !== "CONFIRMED" || booking.studentId !== trip.studentId || booking.slotId !== slot.id) {
        throw new AppError("CONFLICT", "Đặt chỗ không còn dùng được cho lượt trả xe này.");
      }
      allocation = setStatus(booking.id, "IN_USE");
    } else {
      // Ext 4a: chỗ vừa được phân bổ cho yêu cầu khác → báo để service chọn chỗ khác
      if (!isSlotFree(slot, returnWindow(now), now)) {
        throw new AppError("CONFLICT", "Vị trí vừa được phân bổ cho yêu cầu khác.", { code: "SLOT_TAKEN" });
      }
      allocation = db
        .insert(parkingAllocations)
        .values({
          studentId: trip.studentId,
          slotId: slot.id,
          vehicleRef: trip.vehicleId,
          startTime: now,
          endTime: returnWindow(now).endTime,
          status: "IN_USE",
        })
        .returning()
        .get();
    }

    const updatedTrip = db
      .update(trips)
      .set({ status: "RETURN_IN_PROGRESS", returnHubId: hubId, returnSlotId: slot.id })
      .where(eq(trips.id, tripId))
      .returning()
      .get()!;
    recordProcessedRequest(requestId, trip.studentId, "PREPARE_RETURN", allocation.id);
    return { trip: updatedTrip, allocation };
  },

  /** UC05 bước 5–6: thông tin bàn giao của lượt trả xe đang làm (xe, Hub, vị trí, phân bổ). */
  findReturnHandoverContext(tripId: string, studentId: string): ReturnHandoverContext | undefined {
    const trip = returnOps.findTripForReturn(tripId);
    if (!trip || trip.studentId !== studentId || !trip.returnHubId || !trip.returnSlotId) return undefined;
    const allocation = findReturnAllocation(trip);
    if (!allocation) return undefined;
    return {
      tripId,
      vehicleId: trip.vehicleId,
      hubId: trip.returnHubId,
      slotId: trip.returnSlotId,
      allocationId: allocation.id,
      // Phân bổ đến từ đặt chỗ UC06 (từng là lượt giữ) thì có holdExpiresAt
      bookingId: allocation.holdExpiresAt ? allocation.id : undefined,
    };
  },

  /**
   * UC05 bước 6: xe đã ở vị trí, bắt đầu bàn giao (xe HANDING_OVER tại Hub/vị trí trả).
   * Đang bàn giao rồi → từ chối, không gửi lệnh khóa lần hai (Ext 6b khi bấm lặp).
   */
  markHandoverInProgress(requestId: string, tripId: string, vehicleId: string, slotId: string): void {
    const vehicle = getVehicle(vehicleId);
    if (vehicle.status === "HANDING_OVER") {
      throw new AppError("CONFLICT", "Yêu cầu trả xe đang được xử lý, vui lòng chờ kết quả.");
    }
    const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, slotId)).get();
    if (!slot) throw new AppError("NOT_FOUND", "Không tìm thấy vị trí đỗ.");
    db.update(sharedVehicles)
      .set({ status: "HANDING_OVER", hubId: slot.hubId, slotId, lastUpdatedAt: new Date() })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
  },

  /**
   * UC05 Ext 7a – khóa xe FAILED: chưa xác nhận bàn giao. Trip vẫn RETURN_IN_PROGRESS,
   * xe vẫn ở vị trí (chỗ không cấp cho ai khác) và trở lại IN_USE để sinh viên thử khóa lại.
   */
  recordLockFailure(requestId: string, tripId: string): void {
    const trip = getTrip(tripId);
    db.update(sharedVehicles)
      .set({ status: "IN_USE", lastUpdatedAt: new Date() })
      .where(eq(sharedVehicles.id, trip.vehicleId))
      .run();
  },

  /** UC05 Ext 7b – chưa rõ kết quả khóa: Trip chờ đối soát, xe chờ xác minh; xe và chỗ không được cấp lại. */
  markPendingVerification(tripId: string, vehicleId: string, slotId: string): Trip {
    db.update(sharedVehicles)
      .set({ status: "PENDING_VERIFICATION", lastUpdatedAt: new Date() })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
    return db
      .update(trips)
      .set({ status: "PENDING_RECONCILIATION", returnSlotId: slotId })
      .where(eq(trips.id, tripId))
      .returning()
      .get()!;
  },

  /**
   * UC05 bước 8–9 – gọi trong db.transaction sau khi khóa SUCCESS: Trip ENDED, ghi thời điểm trả,
   * xe ở vị trí mới với trạng thái theo pin/tình trạng kỹ thuật, phân bổ (hoặc đặt chỗ) → USED.
   * Gửi lặp hoặc chuyến đã kết thúc → trả lại chuyến đi đã ghi, không cập nhật trùng (Ext 2b, 6b).
   */
  atomicCompleteReturn(
    requestId: string,
    tripId: string,
    vehicleId: string,
    slotId: string,
    returnedAt: Date,
    bookingId: string | undefined,
    vehicleServiceStatus: VehicleStatus,
  ): Trip {
    const trip = getTrip(tripId);
    if (previousResultId(requestId, trip.studentId, "CONFIRM_RETURN") || trip.status === "ENDED") return trip;

    const slot = db.select().from(parkingSlots).where(eq(parkingSlots.id, slotId)).get();
    if (!slot) throw new AppError("NOT_FOUND", "Không tìm thấy vị trí đỗ.");

    const allocation = findReturnAllocation(trip);
    const usedId = bookingId ?? allocation?.id;
    if (usedId) setStatus(usedId, "USED");

    db.update(sharedVehicles)
      .set({ status: vehicleServiceStatus, hubId: slot.hubId, slotId, lastUpdatedAt: returnedAt })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
    db.update(hubs).set({ lastUpdatedAt: returnedAt }).where(eq(hubs.id, slot.hubId)).run();
    const ended = db
      .update(trips)
      .set({ status: "ENDED", endedAt: returnedAt, returnHubId: slot.hubId, returnSlotId: slotId })
      .where(eq(trips.id, tripId))
      .returning()
      .get()!;
    recordProcessedRequest(requestId, trip.studentId, "CONFIRM_RETURN", tripId);
    return ended;
  },

  /**
   * UC05 Ext 8a – xe đã khóa nhưng ghi nhận trả xe lỗi: lưu thông tin bàn giao để đối soát.
   * Trip chờ đối soát, xe ở vị trí và chờ xác minh – không cấp cho người khác.
   */
  saveHandoverForReconciliation(tripId: string, vehicleId: string, slotId: string, lockResult: LockResult): Trip {
    db.update(sharedVehicles)
      .set({ status: "PENDING_VERIFICATION", batteryLevel: lockResult.batteryLevel, lastUpdatedAt: new Date() })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
    return db
      .update(trips)
      .set({ status: "PENDING_RECONCILIATION", returnSlotId: slotId })
      .where(eq(trips.id, tripId))
      .returning()
      .get()!;
  },

  /**
   * UC05 Ext 5a – gọi trong db.transaction: sinh viên dừng trước khi bàn giao. Chỉ giải phóng phân bổ MỚI
   * của lượt trả này (đặt chỗ trước thì trả về CONFIRMED, không hủy) và chỉ khi xe chưa chiếm vị trí.
   * Trip về ACTIVE.
   */
  releaseNewReturnAllocation(requestId: string, allocationId: string): ParkingAllocation {
    const allocation = getAllocation(allocationId);
    const doneId = previousResultId(requestId, allocation.studentId, "ABANDON_RETURN");
    if (doneId) return getAllocation(doneId);

    const trip = db
      .select()
      .from(trips)
      .where(and(eq(trips.vehicleId, allocation.vehicleRef), eq(trips.status, "RETURN_IN_PROGRESS")))
      .get();
    if (!trip) throw new AppError("CONFLICT", "Không có lượt trả xe đang thực hiện.");
    if (getVehicle(trip.vehicleId).slotId === allocation.slotId) {
      throw new AppError(
        "CONFLICT",
        "Xe đã ở vị trí trả nên không thể dừng trả xe. Hãy xác nhận trả xe lại hoặc liên hệ Operator.",
      );
    }
    const released = releaseReturnAllocation(trip, allocation);
    recordProcessedRequest(requestId, allocation.studentId, "ABANDON_RETURN", released.id);
    return released;
  },
};

// ---------- Hàm hỗ trợ (không phải method của class) ----------

/** Chuyến đi chưa kết thúc của sinh viên (dùng cho trang Chuyến đi – thêm ngoài sơ đồ). */
export function findCurrentTrip(studentId: string): Trip | undefined {
  return db
    .select()
    .from(trips)
    .where(
      and(eq(trips.studentId, studentId), inArray(trips.status, ["ACTIVE", "RETURN_IN_PROGRESS", "PENDING_RECONCILIATION"])),
    )
    .orderBy(desc(trips.startedAt))
    .get();
}

function returnWindow(now: Date): TimeRange {
  return { startTime: now, endTime: new Date(now.getTime() + systemConfig.returnAllocationMinutes * 60_000) };
}

function getTrip(tripId: string): Trip {
  const trip = returnOps.findTripForReturn(tripId);
  if (!trip) throw new AppError("NOT_FOUND", "Không tìm thấy chuyến đi.");
  return trip;
}

function getVehicle(vehicleId: string) {
  const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
  if (!vehicle) throw new AppError("NOT_FOUND", "Không tìm thấy xe.");
  return vehicle;
}

function getAllocation(id: string): ParkingAllocation {
  const allocation = db.select().from(parkingAllocations).where(eq(parkingAllocations.id, id)).get();
  if (!allocation) throw new AppError("NOT_FOUND", "Không tìm thấy phân bổ chỗ đỗ.");
  return allocation;
}

function setStatus(id: string, status: ParkingAllocation["status"]): ParkingAllocation {
  return db.update(parkingAllocations).set({ status }).where(eq(parkingAllocations.id, id)).returning().get()!;
}

/** Phân bổ IN_USE đang giữ vị trí trả cho chuyến đi. */
function findReturnAllocation(trip: Trip): ParkingAllocation | undefined {
  if (!trip.returnSlotId) return undefined;
  return db
    .select()
    .from(parkingAllocations)
    .where(
      and(
        eq(parkingAllocations.slotId, trip.returnSlotId),
        eq(parkingAllocations.vehicleRef, trip.vehicleId),
        eq(parkingAllocations.status, "IN_USE"),
      ),
    )
    .get();
}

/** Trả lại chỗ của lượt trả: phân bổ mới → CANCELLED, đặt chỗ trước → CONFIRMED; Trip về ACTIVE. */
function releaseReturnAllocation(trip: Trip, allocation: ParkingAllocation): ParkingAllocation {
  if (getVehicle(trip.vehicleId).slotId === allocation.slotId) {
    throw new AppError("CONFLICT", "Xe đã ở vị trí trả trước đó nên không thể đổi Hub. Hãy xác nhận trả xe.");
  }
  const released = setStatus(allocation.id, allocation.holdExpiresAt ? "CONFIRMED" : "CANCELLED");
  db.update(trips).set({ status: "ACTIVE", returnHubId: null, returnSlotId: null }).where(eq(trips.id, trip.id)).run();
  return released;
}
