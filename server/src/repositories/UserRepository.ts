// Owner: Bùi Quang Nhân – Register / Sign In / Customize Interface Mode
import { and, eq, gt, inArray } from "drizzle-orm";
import type { ThemePreference } from "../constants";
import {
  chargingRequests,
  chargingReservations,
  parkingAllocations,
  privateVehicles,
  users,
  type PrivateVehicle,
  type User,
} from "../db/schema";
import { db } from "../lib/db";

/** Repository CHỈ truy cập dữ liệu, không chứa nghiệp vụ. */
export const userRepository = {
  findByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  },

  findById(id: string): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  },

  create(data: typeof users.$inferInsert): User {
    return db.insert(users).values(data).returning().get();
  },

  updateTheme(id: string, themePreference: ThemePreference): User | undefined {
    return db.update(users).set({ themePreference }).where(eq(users.id, id)).returning().get();
  },

  /** Thêm ngoài sơ đồ: xe cá nhân của sinh viên (chọn xe khi đặt chỗ đỗ UC06, đặt lịch sạc UC08). */
  findPrivateVehicles(ownerId: string): PrivateVehicle[] {
    return db.select().from(privateVehicles).where(eq(privateVehicles.ownerId, ownerId)).all();
  },

  findPrivateVehicleById(id: string): PrivateVehicle | undefined {
    return db.select().from(privateVehicles).where(eq(privateVehicles.id, id)).get();
  },

  findAllPrivateVehicles(): PrivateVehicle[] {
    return db.select().from(privateVehicles).all();
  },

  createPrivateVehicle(data: typeof privateVehicles.$inferInsert): PrivateVehicle {
    return db.insert(privateVehicles).values(data).returning().get();
  },

  updatePrivateVehicle(
    id: string,
    data: Pick<PrivateVehicle, "plate" | "type" | "connectorType">,
  ): PrivateVehicle | undefined {
    return db
      .update(privateVehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(privateVehicles.id, id))
      .returning()
      .get();
  },

  deletePrivateVehicle(id: string): void {
    db.delete(privateVehicles).where(eq(privateVehicles.id, id)).run();
  },

  hasActiveParkingForVehicle(vehicleId: string, now: Date): boolean {
    const row = db
      .select({ id: parkingAllocations.id })
      .from(parkingAllocations)
      .where(
        and(
          eq(parkingAllocations.vehicleRef, vehicleId),
          inArray(parkingAllocations.status, ["HELD", "CONFIRMED", "IN_USE"]),
          gt(parkingAllocations.endTime, now),
        ),
      )
      .get();
    return Boolean(row);
  },

  hasActiveChargingRequestForVehicle(vehicleId: string): boolean {
    const row = db
      .select({ id: chargingRequests.id })
      .from(chargingRequests)
      .where(
        and(
          eq(chargingRequests.vehicleId, vehicleId),
          inArray(chargingRequests.status, ["WAITING", "ALLOCATED"]),
        ),
      )
      .get();
    return Boolean(row);
  },

  hasActiveChargingReservationForVehicle(vehicleId: string, now: Date): boolean {
    const row = db
      .select({ id: chargingReservations.id })
      .from(chargingReservations)
      .where(
        and(
          eq(chargingReservations.privateVehicleId, vehicleId),
          eq(chargingReservations.status, "CONFIRMED"),
          gt(chargingReservations.endTime, now),
        ),
      )
      .get();
    return Boolean(row);
  },

  hasAnyChargingReservationForVehicle(vehicleId: string): boolean {
    const row = db
      .select({ id: chargingReservations.id })
      .from(chargingReservations)
      .where(eq(chargingReservations.privateVehicleId, vehicleId))
      .get();
    return Boolean(row);
  },
};
