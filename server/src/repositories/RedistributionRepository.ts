// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  parkingAllocations,
  processedRequests,
  redistributionItems,
  redistributionOrders,
  sharedVehicles,
  type ParkingSlot,
  type ProcessedRequest,
  type RedistributionItem,
  type RedistributionOrder,
} from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { RedistributionPreview } from "../types/dto";
import { hubRepository } from "./HubRepository";

/**
 * Lệnh điều chuyển kèm các mục xe. Kiểu trả về của sơ đồ là RedistributionOrder;
 * kiểu này là con của nó (thêm `items`) để giao diện hiển thị được tiến độ từng xe.
 */
export type RedistributionOrderWithItems = RedistributionOrder & { items: RedistributionItem[] };

// ---------- Hàm phụ (không có trong sơ đồ) ----------

function readOrder(orderId: string): RedistributionOrder {
  const order = db.select().from(redistributionOrders).where(eq(redistributionOrders.id, orderId)).get();
  if (!order) throw new AppError("NOT_FOUND", "Không tìm thấy lệnh điều chuyển.");
  return order;
}

function readItems(orderId: string): RedistributionItem[] {
  return db.select().from(redistributionItems).where(eq(redistributionItems.orderId, orderId)).all();
}

function readItem(orderId: string, vehicleId: string): RedistributionItem {
  const item = db
    .select()
    .from(redistributionItems)
    .where(and(eq(redistributionItems.orderId, orderId), eq(redistributionItems.vehicleId, vehicleId)))
    .get();
  if (!item) throw new AppError("NOT_FOUND", "Xe không thuộc lệnh điều chuyển này.");
  return item;
}

function withItems(order: RedistributionOrder): RedistributionOrderWithItems {
  return { ...order, items: readItems(order.id) };
}

/** Xe đã nằm trong một lệnh điều chuyển chưa xuất phát (PENDING) → bị khóa, không được đặt hoặc điều chuyển thêm. */
function lockedVehicleIds(): Set<string> {
  const rows = db
    .select({ vehicleId: redistributionItems.vehicleId })
    .from(redistributionItems)
    .where(eq(redistributionItems.status, "PENDING"))
    .all();
  return new Set(rows.map((r) => r.vehicleId));
}

/** Mỗi xe đang chờ đến chiếm một chỗ từ ETA; xe quá ETA vẫn giữ cam kết. */
function inboundArrivalTimes(targetHubId: string, now: Date, excludeItemId?: string): number[] {
  return db
    .select({ eta: redistributionOrders.eta })
    .from(redistributionItems)
    .innerJoin(redistributionOrders, eq(redistributionItems.orderId, redistributionOrders.id))
    .where(
      and(
        eq(redistributionOrders.targetHubId, targetHubId),
        inArray(redistributionItems.status, ["PENDING", "IN_TRANSIT"]),
        excludeItemId ? ne(redistributionItems.id, excludeItemId) : undefined,
      ),
    )
    .all()
    .map(({ eta }) => Math.max(now.getTime(), eta?.getTime() ?? now.getTime()))
    .sort((a, b) => a - b);
}

/** Xe đến sẽ đỗ cho đến khi có nghiệp vụ khác cho xe rời đi; bảo vệ cả đặt chỗ tương lai. */
function readSlotAvailability(hubId: string, now: Date): { slot: ParkingSlot; blockedUntil: number }[] {
  const slots = hubRepository
    .listSlots()
    .filter((s) => s.hubId === hubId && s.status === "IN_SERVICE" && !s.hasCharger);
  if (slots.length === 0) return [];

  const blockedUntil = new Map<string, number>();
  for (const v of hubRepository.listVehicles(hubId)) {
    if (v.slotId) blockedUntil.set(v.slotId, Infinity);
  }
  const allocations = db.select().from(parkingAllocations).where(and(
    inArray(parkingAllocations.slotId, slots.map((s) => s.id)),
    inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
  )).all();
  for (const allocation of allocations) {
    if (allocation.status === "HELD" && (!allocation.holdExpiresAt || allocation.holdExpiresAt <= now)) continue;
    const end = allocation.status === "IN_USE" ? Infinity : allocation.endTime.getTime();
    blockedUntil.set(allocation.slotId, Math.max(blockedUntil.get(allocation.slotId) ?? 0, end));
  }
  return slots.map((slot) => ({ slot, blockedUntil: blockedUntil.get(slot.id) ?? 0 }));
}

function getReceiptOptions(hubId: string, eta: Date, now: Date, excludeItemId?: string) {
  const at = Math.max(now.getTime(), eta.getTime());
  const incoming = inboundArrivalTimes(hubId, now, excludeItemId);
  const availability = readSlotAvailability(hubId, now);
  const slots = availability.filter((entry) => entry.blockedUntil <= at).map((entry) => entry.slot);
  let reserved = incoming.filter((time) => time <= at).length;
  let capacity = slots.length - reserved;
  // Mỗi xe nhận thêm cũng chiếm chỗ tại những ETA sau nó. Chừa đủ chỗ cho các cam kết này.
  for (const time of incoming.slice(reserved)) {
    reserved++;
    const futureSlots = availability.filter((entry) => entry.blockedUntil <= time).length;
    capacity = Math.min(capacity, futureSlots - reserved);
  }
  return { slots, capacity: Math.max(0, capacity) };
}

export const redistributionRepository = {
  listOrders(): (RedistributionOrderWithItems & { vehicleCodes: Record<string, string> })[] {
    const vehicleCodes = new Map(hubRepository.listVehicles().map((vehicle) => [vehicle.id, vehicle.code]));
    return db.select().from(redistributionOrders).orderBy(desc(redistributionOrders.createdAt)).all().map((order) => {
      const view = withItems(order);
      return {
        ...view,
        vehicleCodes: Object.fromEntries(view.items.map(({ vehicleId }) => [vehicleId, vehicleCodes.get(vehicleId) ?? vehicleId])),
      };
    });
  },

  findOrderWithItems(orderId: string): RedistributionOrderWithItems {
    return withItems(readOrder(orderId));
  },

  /** UC12 bước 2–4: xe có thể điều chuyển ở Hub nguồn (AVAILABLE, chưa bị khóa) và sức chứa còn lại của Hub đích tại ETA. */
  findRedistributionOptions(
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
  ): RedistributionPreview {
    const sourceHub = hubRepository.findById(sourceHubId);
    const targetHub = hubRepository.findById(targetHubId);
    if (!sourceHub || !targetHub) throw new AppError("NOT_FOUND", "Không tìm thấy Hub nguồn hoặc Hub đích.");

    const locked = lockedVehicleIds();
    let vehicles = hubRepository
      .listVehicles(sourceHubId)
      .filter((v) => v.status === "AVAILABLE" && !locked.has(v.id));
    if (vehicleIds.length > 0) vehicles = vehicles.filter((v) => vehicleIds.includes(v.id));

    const { capacity: availableCapacity } = getReceiptOptions(targetHubId, eta, new Date());
    return { sourceHub, targetHub, vehicles, eta, availableCapacity };
  },

  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    return db.select().from(processedRequests).where(eq(processedRequests.requestId, requestId)).get();
  },

  /** UC12 – trong db.transaction: xe phải AVAILABLE tại Hub nguồn; tạo lệnh + từng item PENDING, xe bị khóa đặt. */
  atomicCreateOrder(
    requestId: string,
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
    createdBy: string,
    now: Date,
  ): RedistributionOrder {
    const locked = lockedVehicleIds();
    for (const vehicleId of vehicleIds) {
      const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
      if (!vehicle || vehicle.hubId !== sourceHubId || vehicle.status !== "AVAILABLE" || locked.has(vehicleId)) {
        throw new AppError("CONFLICT", "Có xe không còn khả dụng để điều chuyển. Vui lòng xem lại phương án.");
      }
    }
    const { capacity } = getReceiptOptions(targetHubId, eta, now);
    if (capacity < vehicleIds.length) {
      throw new AppError("CONFLICT", "Sức chứa của Hub đích không còn đủ. Vui lòng xem lại phương án.");
    }

    const order = db
      .insert(redistributionOrders)
      .values({ sourceHubId, targetHubId, createdBy, eta, status: "CREATED" })
      .returning()
      .get();
    for (const vehicleId of vehicleIds) {
      db.insert(redistributionItems).values({ orderId: order.id, vehicleId, status: "PENDING" }).run();
    }
    db.insert(processedRequests)
      .values({ requestId, actorId: createdBy, operation: "CREATE_REDISTRIBUTION_ORDER", resultId: order.id })
      .run();
    return withItems(order);
  },

  /** UC12 – xe rời Hub nguồn: item IN_TRANSIT, xe IN_TRANSIT, giải phóng vị trí đỗ. */
  atomicMarkDeparted(requestId: string, orderId: string, vehicleId: string, now: Date, operatorId?: string): RedistributionItem {
    const order = readOrder(orderId);
    const item = readItem(orderId, vehicleId);
    if (order.status !== "CREATED" && order.status !== "IN_PROGRESS") {
      throw new AppError("CONFLICT", "Lệnh điều chuyển đã kết thúc.");
    }
    if (item.status !== "PENDING") {
      throw new AppError("CONFLICT", "Xe này đã xuất phát hoặc đã bị hủy khỏi lệnh.");
    }
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    if (!vehicle || vehicle.hubId !== order.sourceHubId || vehicle.status !== "AVAILABLE") {
      throw new AppError("CONFLICT", "Xe không còn sẵn sàng ở Hub nguồn nên không thể xác nhận xuất phát.");
    }

    const departed = db
      .update(redistributionItems)
      .set({ status: "IN_TRANSIT", departedAt: now })
      .where(eq(redistributionItems.id, item.id))
      .returning()
      .get();
    db.update(sharedVehicles)
      .set({ status: "IN_TRANSIT", hubId: null, slotId: null, lastUpdatedAt: now })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
    if (order.status === "CREATED") {
      db.update(redistributionOrders).set({ status: "IN_PROGRESS" }).where(eq(redistributionOrders.id, orderId)).run();
    }
    db.insert(processedRequests)
      .values({ requestId, actorId: operatorId ?? order.createdBy, operation: "CONFIRM_REDISTRIBUTION_DEPARTURE", resultId: departed.id })
      .run();
    return departed;
  },

  /** UC12 – xe tới Hub đích: item ARRIVED, xe AVAILABLE tại vị trí mới; cập nhật trạng thái lệnh. */
  atomicMarkArrived(requestId: string, orderId: string, vehicleId: string, now: Date, operatorId?: string): RedistributionItem {
    const order = readOrder(orderId);
    const item = readItem(orderId, vehicleId);
    if (item.status !== "IN_TRANSIT") {
      throw new AppError("CONFLICT", "Xe này chưa xuất phát hoặc đã được tiếp nhận.");
    }

    const { slots, capacity } = getReceiptOptions(order.targetHubId, now, now, item.id);
    const slot = slots.sort((a, b) => a.code.localeCompare(b.code))[0];
    if (capacity === 0 || !slot) throw new AppError("CONFLICT", "Hub đích hiện không còn vị trí trống để tiếp nhận xe.");

    const arrived = db
      .update(redistributionItems)
      .set({ status: "ARRIVED", arrivedAt: now })
      .where(eq(redistributionItems.id, item.id))
      .returning()
      .get();
    db.update(sharedVehicles)
      .set({ status: "AVAILABLE", hubId: order.targetHubId, slotId: slot.id, lastUpdatedAt: now })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
    // Lệnh vẫn IN_PROGRESS cho tới khi Operator đóng lệnh (atomicCloseOrder) và ghi kết quả cuối.
    db.insert(processedRequests)
      .values({ requestId, actorId: operatorId ?? order.createdBy, operation: "CONFIRM_REDISTRIBUTION_ARRIVAL", resultId: arrived.id })
      .run();
    return arrived;
  },

  /** UC12 – hủy các item còn PENDING; lệnh → CANCELLED hoặc PARTIALLY_COMPLETED. */
  atomicCancelPendingItems(requestId: string, orderId: string, now: Date, operatorId?: string): RedistributionOrder {
    const order = readOrder(orderId);
    const pending = readItems(orderId).filter((i) => i.status === "PENDING");
    if (pending.length === 0) throw new AppError("CONFLICT", "Không còn xe nào chưa xuất phát để hủy.");

    for (const item of pending) {
      db.update(redistributionItems).set({ status: "CANCELLED" }).where(eq(redistributionItems.id, item.id)).run();
    }
    // Xe chưa xuất phát vẫn ở Hub nguồn (AVAILABLE) nên không đổi vị trí; chỉ hết bị khóa vì item không còn PENDING.
    const remaining = readItems(orderId);
    const nextStatus = remaining.every((i) => i.status === "CANCELLED")
      ? "CANCELLED"
      : remaining.some((i) => i.status === "IN_TRANSIT")
        ? "IN_PROGRESS"
        : "PARTIALLY_COMPLETED";
    db.update(redistributionOrders).set({ status: nextStatus }).where(eq(redistributionOrders.id, order.id)).run();
    db.insert(processedRequests)
      .values({ requestId, actorId: operatorId ?? order.createdBy, operation: "CANCEL_REDISTRIBUTION_ITEMS", resultId: order.id })
      .run();
    return withItems(readOrder(orderId));
  },

  /** UC12 bước 10: đóng lệnh, ghi rõ kết quả: hoàn tất, hủy toàn bộ hoặc hoàn tất một phần. */
  atomicCloseOrder(requestId: string, orderId: string, now: Date, operatorId?: string): RedistributionOrder {
    const order = readOrder(orderId);
    const items = readItems(orderId);
    if (items.some((i) => i.status === "PENDING" || i.status === "IN_TRANSIT")) {
      throw new AppError("CONFLICT", "Còn xe chưa xuất phát hoặc đang trên đường; chưa thể đóng lệnh.");
    }
    const finalStatus = items.every((i) => i.status === "ARRIVED")
      ? "COMPLETED"
      : items.every((i) => i.status === "CANCELLED")
        ? "CANCELLED"
        : "PARTIALLY_COMPLETED";
    db.update(redistributionOrders).set({ status: finalStatus }).where(eq(redistributionOrders.id, order.id)).run();
    db.insert(processedRequests)
      .values({ requestId, actorId: operatorId ?? order.createdBy, operation: "CLOSE_REDISTRIBUTION_ORDER", resultId: order.id })
      .run();
    return withItems(readOrder(orderId));
  },

  /** UC12 9a: đã tiếp nhận xe nhưng cập nhật dữ liệu lỗi → đánh dấu xe chờ đối soát, không cấp lại xe / chỗ đỗ. */
  markReconciliationRequired(orderId: string, vehicleId: string, now: Date): RedistributionItem {
    return db.transaction(() => {
      const item = readItem(orderId, vehicleId);
      db.update(sharedVehicles)
        .set({ status: "PENDING_VERIFICATION", lastUpdatedAt: now })
        .where(eq(sharedVehicles.id, vehicleId))
        .run();
      return item;
    });
  },
};
