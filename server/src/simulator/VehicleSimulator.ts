/**
 * Bộ giả lập xe dùng chung (thay cho thiết bị thật).
 * Owner: Bùi Quang Nhân (khung) – các UC nhận/trả xe gọi requestUnlock / sendLockCommand.
 *
 * - Mỗi simulatorTickMs: đổi pin vài xe, cập nhật thời điểm cập nhật của xe và Hub.
 *   Client tự gọi lại API mỗi 3 giây nên sẽ thấy số liệu thay đổi.
 * - requestUnlock / sendLockCommand: trả kết quả giả lập SUCCESS / FAILED / UNKNOWN
 *   để thử được các nhánh lỗi trong UC04, UC05.
 *
 * Class «boundary» VehicleSimulator trong class diagram Sub #3 có requestUnlock, readVehiclePosition,
 * sendLockCommand. start/tick là phần hạ tầng chạy nền của bộ giả lập, không thuộc thiết kế nghiệp vụ.
 */
import { eq, inArray } from "drizzle-orm";
import { systemConfig } from "../config/systemConfig";
import type { DeviceCommandResult, VehicleTechStatus } from "../constants";
import { and, desc } from "drizzle-orm";
import { hubs, sharedVehicles, trips } from "../db/schema";
import { db } from "../lib/db";
import type { LockResult, VehiclePosition } from "../types/dto";

/** Tỉ lệ lệnh thiết bị thành công khi SIMULATOR_DEVICE_RESULT=RANDOM. */
const SUCCESS_RATE = 0.9;
/** Ép kết quả lệnh thiết bị để demo nhánh lỗi: RANDOM | SUCCESS | FAILED | UNKNOWN (server/.env). */
const FORCED_RESULT = (process.env.SIMULATOR_DEVICE_RESULT ?? "RANDOM").toUpperCase();
const DEVICE_DELAY_MS = 300;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomResult(): DeviceCommandResult {
  if (FORCED_RESULT === "SUCCESS" || FORCED_RESULT === "FAILED" || FORCED_RESULT === "UNKNOWN") return FORCED_RESULT;
  const r = Math.random();
  if (r < SUCCESS_RATE) return "SUCCESS";
  return r < SUCCESS_RATE + (1 - SUCCESS_RATE) / 2 ? "FAILED" : "UNKNOWN";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const vehicleSimulator = {
  /** Một nhịp giả lập: đổi pin 5 xe ngẫu nhiên. */
  tick(now: Date = new Date()): void {
    const vehicles = db.select().from(sharedVehicles).all();
    const picked = vehicles.sort(() => Math.random() - 0.5).slice(0, 5);

    db.transaction(() => {
      for (const v of picked) {
        let battery = v.batteryLevel;
        if (v.status === "CHARGING") battery += randomInt(1, 3);
        else if (v.status === "IN_USE") battery -= randomInt(1, 2);
        else battery += randomInt(-1, 1);
        battery = Math.max(0, Math.min(100, battery));
        db.update(sharedVehicles)
          .set({ batteryLevel: battery, lastUpdatedAt: now })
          .where(eq(sharedVehicles.id, v.id))
          .run();
      }
      const hubIds = picked.map((v) => v.hubId).filter((id): id is string => id !== null);
      if (hubIds.length > 0) db.update(hubs).set({ lastUpdatedAt: now }).where(inArray(hubs.id, hubIds)).run();
    });
  },

  start(): void {
    setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error("[simulator] Lỗi:", err);
      }
    }, systemConfig.simulatorTickMs);
    console.log(`[simulator] Chạy mỗi ${systemConfig.simulatorTickMs}ms`);
  },

  /** UC04: yêu cầu thiết bị mở khóa xe. Gọi NGOÀI transaction. */
  async requestUnlock(vehicleId: string): Promise<DeviceCommandResult> {
    await wait(DEVICE_DELAY_MS);
    const result = randomResult();
    console.log(`[simulator] requestUnlock(${vehicleId}) → ${result}`);
    return result;
  },

  /**
   * UC05 bước 6: đọc vị trí xe do thiết bị báo (Hub, vị trí đỗ). Xe đang đỗ thì trả vị trí đang lưu.
   * Xe đang trong lượt trả (Trip RETURN_IN_PROGRESS): giả lập sinh viên đã đưa xe vào đúng vị trí được chỉ định.
   */
  readVehiclePosition(vehicleId: string): VehiclePosition | undefined {
    const v = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    if (!v) return undefined;
    if (v.hubId && v.slotId) return { hubId: v.hubId, slotId: v.slotId, reportedAt: new Date() };
    const trip = db
      .select()
      .from(trips)
      .where(and(eq(trips.vehicleId, vehicleId), eq(trips.status, "RETURN_IN_PROGRESS")))
      .orderBy(desc(trips.startedAt))
      .get();
    if (!trip?.returnHubId || !trip.returnSlotId) return undefined;
    return { hubId: trip.returnHubId, slotId: trip.returnSlotId, reportedAt: new Date() };
  },

  /** UC05 bước 7: gửi lệnh khóa xe khi trả; kèm mức pin và tình trạng kỹ thuật thiết bị báo về. Gọi NGOÀI transaction. */
  async sendLockCommand(vehicleId: string): Promise<LockResult> {
    await wait(DEVICE_DELAY_MS);
    const status = randomResult();
    const v = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    const techStatus: VehicleTechStatus = status === "SUCCESS" ? "OK" : "UNKNOWN";
    // Pin xe sau chuyến đi: giảm nhẹ so với lúc nhận (giả lập)
    if (status === "SUCCESS" && v) {
      const battery = Math.max(0, v.batteryLevel - randomInt(3, 10));
      db.update(sharedVehicles).set({ batteryLevel: battery }).where(eq(sharedVehicles.id, vehicleId)).run();
      v.batteryLevel = battery;
    }
    console.log(`[simulator] sendLockCommand(${vehicleId}) → ${status}`);
    return { status, batteryLevel: status === "SUCCESS" ? v?.batteryLevel : undefined, techStatus };
  },
};
