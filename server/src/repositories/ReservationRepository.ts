// Owner: Lê Quốc Linh – UC02, UC03, mục 2.3.2
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, asc, eq, gte, inArray, notExists } from "drizzle-orm";
import type { VehicleReservationStatus } from "../constants";
import {
  hubs,
  processedRequests,
  redistributionItems,
  sharedVehicles,
  users,
  vehicleReservations,
  type ProcessedRequest,
  type SharedVehicle,
  type VehicleReservation,
} from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { ReservationContext } from "../types/dto";
import { hubRepository } from "./HubRepository";

/** Đặt xe còn hiệu lực: chưa dùng, chưa hủy, chưa hết hạn. */
const ACTIVE_RESERVATION_STATUSES: VehicleReservationStatus[] = ["RESERVED", "HANDING_OVER", "PENDING_VERIFICATION"];

/** Scheduler là nơi chuyển RESERVED quá hạn sang EXPIRED và giải phóng xe. */
export function findBlockingVehicleReservation(vehicleId: string): VehicleReservation | undefined {
  return db.select().from(vehicleReservations)
    .where(and(eq(vehicleReservations.vehicleId, vehicleId), inArray(vehicleReservations.status, ACTIVE_RESERVATION_STATUSES)))
    .get();
}

/** Xe đang bị khóa đặt vì nằm trong lệnh điều chuyển chưa xuất phát (UC12) → không cho sinh viên đặt. */
function vehicleIdsLockedByRedistribution(): Set<string> {
  const rows = db
    .select({ vehicleId: redistributionItems.vehicleId })
    .from(redistributionItems)
    .where(eq(redistributionItems.status, "PENDING"))
    .all();
  return new Set(rows.map((r) => r.vehicleId));
}

export const reservationRepository = {
  /**
   * Xe có thể đặt tại Hub: đang AVAILABLE, đủ pin và không còn cam kết hoặc hạn chế vận hành.
   */
  queryReservableVehicles(hubId: string, reservableBatteryThreshold: number, now: Date): SharedVehicle[] {
    const locked = vehicleIdsLockedByRedistribution();
    const underIncident = new Set(hubRepository.listVehicleIdsWithOpenIncidents());
    return db
      .select()
      .from(sharedVehicles)
      .where(
        and(
          eq(sharedVehicles.hubId, hubId),
          eq(sharedVehicles.status, "AVAILABLE"),
          gte(sharedVehicles.batteryLevel, reservableBatteryThreshold),
          notExists(db.select({ id: vehicleReservations.id }).from(vehicleReservations).where(and(
            eq(vehicleReservations.vehicleId, sharedVehicles.id),
            inArray(vehicleReservations.status, ACTIVE_RESERVATION_STATUSES),
          ))),
        ),
      )
      .orderBy(asc(sharedVehicles.code))
      .all()
      .filter((v) => !locked.has(v.id) && !underIncident.has(v.id));
  },

  findById(reservationId: string): VehicleReservation | undefined {
    return db.select().from(vehicleReservations).where(eq(vehicleReservations.id, reservationId)).get();
  },

  loadReservationContext(studentId: string, vehicleId: string): ReservationContext {
    const student = db.select().from(users).where(eq(users.id, studentId)).get();
    if (!student) throw new AppError("NOT_FOUND", "Không tìm thấy tài khoản sinh viên.");
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    if (!vehicle) throw new AppError("NOT_FOUND", "Không tìm thấy xe.");
    if (!vehicle.hubId) throw new AppError("CONFLICT", "Xe hiện không nằm ở Hub nào nên không thể đặt.");
    const hub = db.select().from(hubs).where(eq(hubs.id, vehicle.hubId)).get();
    if (!hub) throw new AppError("NOT_FOUND", "Không tìm thấy Hub của xe.");
    return { student, vehicle, hub };
  },

  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    return db.select().from(processedRequests).where(eq(processedRequests.requestId, requestId)).get();
  },

  /**
   * UC02 – chạy bên trong db.transaction. Kiểm tra lại xe còn AVAILABLE và sinh viên chưa có đặt xe khác,
   * rồi tạo VehicleReservation (RESERVED) + chuyển xe sang RESERVED trong cùng transaction.
   */
  atomicReserveVehicle(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
    pickupDeadlineDuration: number,
    now: Date,
  ): VehicleReservation {
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    if (
      !vehicle ||
      vehicle.hubId !== hubId ||
      vehicle.status !== "AVAILABLE" ||
      vehicleIdsLockedByRedistribution().has(vehicleId) ||
      hubRepository.listVehicleIdsWithOpenIncidents().includes(vehicleId) ||
      findBlockingVehicleReservation(vehicleId) !== undefined
    ) {
      throw new AppError("CONFLICT", "Xe vừa được người khác đặt hoặc không còn khả dụng, vui lòng chọn xe khác.");
    }

    const existing = db
      .select({ id: vehicleReservations.id })
      .from(vehicleReservations)
      .where(and(eq(vehicleReservations.studentId, studentId), inArray(vehicleReservations.status, ACTIVE_RESERVATION_STATUSES)))
      .get();
    if (existing) {
      throw new AppError("CONFLICT", "Bạn đang có một đặt xe còn hiệu lực. Hãy nhận hoặc hủy đặt xe đó trước.");
    }

    db.update(sharedVehicles).set({ status: "RESERVED", lastUpdatedAt: now }).where(eq(sharedVehicles.id, vehicleId)).run();
    const reservation = db
      .insert(vehicleReservations)
      .values({
        studentId,
        vehicleId,
        hubId,
        status: "RESERVED",
        pickupDeadline: new Date(now.getTime() + pickupDeadlineDuration * 60_000),
      })
      .returning()
      .get();
    db.insert(processedRequests)
      .values({ requestId, actorId: studentId, operation: "RESERVE_VEHICLE", resultId: reservation.id })
      .run();
    return reservation;
  },

  findReservationForCancellation(reservationId: string): VehicleReservation {
    const reservation = reservationRepository.findById(reservationId);
    if (!reservation) throw new AppError("NOT_FOUND", "Không tìm thấy đặt xe.");
    return reservation;
  },

  /**
   * UC03 – chạy bên trong db.transaction. Kiểm tra đặt xe còn RESERVED và thuộc sinh viên,
   * chuyển sang CANCELLED và trả xe về AVAILABLE.
   */
  atomicCancelReservation(requestId: string, studentId: string, reservationId: string, now: Date): VehicleReservation {
    const reservation = db.select().from(vehicleReservations).where(eq(vehicleReservations.id, reservationId)).get();
    if (!reservation) throw new AppError("NOT_FOUND", "Không tìm thấy đặt xe.");
    if (reservation.studentId !== studentId) throw new AppError("FORBIDDEN", "Đặt xe này không thuộc về bạn.");
    if (reservation.status !== "RESERVED" || reservation.pickupDeadline.getTime() <= now.getTime()) {
      throw new AppError("CONFLICT", "Đặt xe không còn ở trạng thái có thể hủy (đã hủy, hết hạn, đang bàn giao hoặc đã nhận xe).");
    }

    const cancelled = db
      .update(vehicleReservations)
      .set({ status: "CANCELLED" })
      .where(eq(vehicleReservations.id, reservationId))
      .returning()
      .get();
    // UC03 7a: chỉ trả xe về AVAILABLE khi xe vẫn đang được giữ cho đặt xe này (xe đã hỏng/bảo trì thì giữ nguyên trạng thái).
    db.update(sharedVehicles)
      .set({ status: "AVAILABLE", lastUpdatedAt: now })
      .where(and(eq(sharedVehicles.id, reservation.vehicleId), eq(sharedVehicles.status, "RESERVED")))
      .run();
    db.insert(processedRequests)
      .values({ requestId, actorId: studentId, operation: "CANCEL_VEHICLE_RESERVATION", resultId: cancelled.id })
      .run();
    return cancelled;
  },
};
