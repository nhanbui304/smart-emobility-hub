// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, eq } from "drizzle-orm";
import { systemConfig } from "../config/systemConfig";
import type { DeviceCommandResult } from "../constants";
import {
  hubs,
  processedRequests,
  sharedVehicles,
  trips,
  vehicleReservations,
  type ProcessedRequest,
  type Trip,
  type VehicleReservation,
} from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { PickUpContext } from "../types/dto";

function readReservation(reservationId: string): VehicleReservation {
  const reservation = db.select().from(vehicleReservations).where(eq(vehicleReservations.id, reservationId)).get();
  if (!reservation) throw new AppError("NOT_FOUND", "Không tìm thấy đặt xe.");
  return reservation;
}

export const pickUpRepository = {
  /** Đặt xe + xe + Hub nhận xe của đặt xe. `now` giữ theo sơ đồ (việc xét hết hạn do Service làm). */
  loadPickUpContext(reservationId: string, now: Date): PickUpContext {
    const reservation = readReservation(reservationId);
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, reservation.vehicleId)).get();
    const hub = db.select().from(hubs).where(eq(hubs.id, reservation.hubId)).get();
    if (!vehicle || !hub) throw new AppError("NOT_FOUND", "Không tìm thấy xe hoặc Hub của đặt xe.");
    return { reservation, vehicle, hub };
  },

  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    return db.select().from(processedRequests).where(eq(processedRequests.requestId, requestId)).get();
  },

  /**
   * Hàm phụ ngoài sơ đồ (ghi trong GHI_CHU_CODE_LINH.md): lấy chuyến đi của đặt xe,
   * dùng để trả lại kết quả khi gửi lặp / mất kết nối sau khi nhận xe (UC04 bước 9a).
   */
  findTripByReservation(reservationId: string): Trip | undefined {
    return db.select().from(trips).where(eq(trips.reservationId, reservationId)).get();
  },

  /**
   * Hết hạn nhận xe (mục 2.3.2, UC04 3a): RESERVED đã quá hạn → EXPIRED, xe RESERVED → AVAILABLE.
   * Kiểm tra lại trạng thái trước khi ghi; đặt xe đang bàn giao / chờ xác minh thì giữ nguyên.
   */
  expireReservation(reservationId: string, now: Date): VehicleReservation {
    return db.transaction(() => {
      const reservation = readReservation(reservationId);
      if (reservation.status !== "RESERVED" || reservation.pickupDeadline.getTime() > now.getTime()) return reservation;
      const expired = db
        .update(vehicleReservations)
        .set({ status: "EXPIRED" })
        .where(eq(vehicleReservations.id, reservationId))
        .returning()
        .get();
      db.update(sharedVehicles)
        .set({ status: "AVAILABLE", lastUpdatedAt: now })
        .where(and(eq(sharedVehicles.id, reservation.vehicleId), eq(sharedVehicles.status, "RESERVED")))
        .run();
      return expired;
    });
  },

  /**
   * UC04 4b: xe gặp sự cố / không đủ pin nên không bàn giao được → đặt xe bị ảnh hưởng.
   * MVP: đặt xe chuyển CANCELLED (do hệ thống); xe chỉ về AVAILABLE nếu đang được giữ (RESERVED),
   * xe đã hỏng/bảo trì thì giữ nguyên trạng thái.
   */
  markReservationAffected(reservationId: string): VehicleReservation {
    return db.transaction(() => {
      const reservation = readReservation(reservationId);
      if (reservation.status !== "RESERVED") return reservation;
      const affected = db
        .update(vehicleReservations)
        .set({ status: "CANCELLED" })
        .where(eq(vehicleReservations.id, reservationId))
        .returning()
        .get();
      db.update(sharedVehicles)
        .set({ status: "AVAILABLE", lastUpdatedAt: new Date() })
        .where(and(eq(sharedVehicles.id, reservation.vehicleId), eq(sharedVehicles.status, "RESERVED")))
        .run();
      return affected;
    });
  },

  /**
   * UC04 – trong db.transaction, TRƯỚC khi gọi thiết bị: kiểm tra đặt xe RESERVED, còn hạn, pin >= ngưỡng nhận;
   * chuyển đặt xe + xe sang HANDING_OVER. Ghi processed_requests (CONFIRM_PICKUP) để gửi lặp không mở khóa lần nữa.
   */
  atomicBeginHandover(requestId: string, studentId: string, reservationId: string, now: Date): VehicleReservation {
    const reservation = readReservation(reservationId);
    if (reservation.studentId !== studentId) throw new AppError("FORBIDDEN", "Đặt xe này không thuộc về bạn.");
    if (reservation.status !== "RESERVED") {
      throw new AppError("CONFLICT", "Đặt xe không còn ở trạng thái chờ nhận xe.");
    }
    if (reservation.pickupDeadline.getTime() <= now.getTime()) {
      throw new AppError("CONFLICT", "Đặt xe đã quá hạn nhận xe.");
    }
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, reservation.vehicleId)).get();
    if (!vehicle || vehicle.hubId !== reservation.hubId || vehicle.status !== "RESERVED") {
      throw new AppError("CONFLICT", "Xe không còn sẵn sàng tại Hub nhận.");
    }
    if (vehicle.batteryLevel < systemConfig.pickupBatteryThreshold) {
      throw new AppError("CONFLICT", "Mức pin của xe thấp hơn ngưỡng cho phép nhận xe.");
    }

    const handingOver = db
      .update(vehicleReservations)
      .set({ status: "HANDING_OVER" })
      .where(eq(vehicleReservations.id, reservationId))
      .returning()
      .get();
    db.update(sharedVehicles).set({ status: "HANDING_OVER", lastUpdatedAt: now }).where(eq(sharedVehicles.id, vehicle.id)).run();
    db.insert(processedRequests)
      .values({ requestId, actorId: studentId, operation: "CONFIRM_PICKUP", resultId: reservationId })
      .run();
    return handingOver;
  },

  /**
   * UC04 7a – thiết bị báo FAILED: kết thúc trạng thái bàn giao.
   * Còn hạn → về RESERVED (cho thử lại); đã hết hạn → EXPIRED và trả xe về AVAILABLE.
   */
  endHandoverAndResolveHold(reservationId: string, now: Date): VehicleReservation {
    return db.transaction(() => {
      const reservation = readReservation(reservationId);
      if (reservation.status !== "HANDING_OVER") return reservation;
      const expired = reservation.pickupDeadline.getTime() <= now.getTime();
      const resolved = db
        .update(vehicleReservations)
        .set({ status: expired ? "EXPIRED" : "RESERVED" })
        .where(eq(vehicleReservations.id, reservationId))
        .returning()
        .get();
      db.update(sharedVehicles)
        .set({ status: expired ? "AVAILABLE" : "RESERVED", lastUpdatedAt: now })
        .where(and(eq(sharedVehicles.id, reservation.vehicleId), eq(sharedVehicles.status, "HANDING_OVER")))
        .run();
      return resolved;
    });
  },

  /** UC04 – thiết bị trả UNKNOWN: đánh dấu PENDING_VERIFICATION để Operator xác minh. */
  markPendingVerification(reservationId: string, vehicleId: string, now: Date): VehicleReservation {
    return db.transaction(() => {
      const reservation = readReservation(reservationId);
      const marked = db
        .update(vehicleReservations)
        .set({ status: "PENDING_VERIFICATION" })
        .where(eq(vehicleReservations.id, reservation.id))
        .returning()
        .get();
      db.update(sharedVehicles).set({ status: "PENDING_VERIFICATION", lastUpdatedAt: now }).where(eq(sharedVehicles.id, vehicleId)).run();
      return marked;
    });
  },

  /**
   * UC04 – SAU khi thiết bị mở khóa SUCCESS (trong db.transaction): tạo Trip ACTIVE, đặt xe USED,
   * xe IN_USE và rời khỏi vị trí đỗ (hubId, slotId = null) để giải phóng chỗ.
   */
  atomicStartTrip(requestId: string, reservationId: string, vehicleId: string, startTime: Date): Trip {
    const done = db.select().from(processedRequests).where(eq(processedRequests.requestId, requestId)).get();
    const reservation = readReservation(reservationId);
    if (!done || done.resultId !== reservationId || reservation.status !== "HANDING_OVER" || reservation.vehicleId !== vehicleId) {
      throw new AppError("CONFLICT", "Đặt xe không ở trạng thái đang bàn giao nên không thể bắt đầu chuyến đi.");
    }
    const trip = db
      .insert(trips)
      .values({ reservationId, studentId: reservation.studentId, vehicleId, startedAt: startTime, status: "ACTIVE" })
      .returning()
      .get();
    db.update(vehicleReservations).set({ status: "USED" }).where(eq(vehicleReservations.id, reservationId)).run();
    db.update(sharedVehicles)
      .set({ status: "IN_USE", hubId: null, slotId: null, lastUpdatedAt: startTime })
      .where(eq(sharedVehicles.id, vehicleId))
      .run();
    return trip;
  },

  /**
   * UC04 8a – đã mở khóa nhưng ghi nhận chuyến đi lỗi: đánh dấu cần đối soát (PENDING_VERIFICATION),
   * không đưa xe về Available, không cấp cho người khác.
   */
  markReconciliationRequired(
    reservationId: string,
    vehicleId: string,
    unlockEvidence: DeviceCommandResult,
  ): VehicleReservation {
    return db.transaction(() => {
      console.warn(`[pickup] Cần đối soát: đặt xe ${reservationId}, xe ${vehicleId}, thiết bị báo ${unlockEvidence}`);
      const marked = db
        .update(vehicleReservations)
        .set({ status: "PENDING_VERIFICATION" })
        .where(eq(vehicleReservations.id, reservationId))
        .returning()
        .get();
      db.update(sharedVehicles)
        .set({ status: "PENDING_VERIFICATION", lastUpdatedAt: new Date() })
        .where(eq(sharedVehicles.id, vehicleId))
        .run();
      return marked;
    });
  },
};
