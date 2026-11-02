/**
 * Bộ giả lập xe dùng chung (thay cho thiết bị thật).
 * Owner: Bùi Quang Nhân (khung) – các UC nhận/trả xe gọi requestUnlock / sendLockCommand.
 *
 * - Mỗi simulatorTickMs: đổi pin vài xe, cập nhật thời điểm cập nhật của xe và Hub.
 *   Client tự gọi lại API mỗi 3 giây nên sẽ thấy số liệu thay đổi.
 * - requestUnlock / sendLockCommand: trả kết quả giả lập SUCCESS / FAILED / UNKNOWN
 *   để thử được các nhánh lỗi trong UC04, UC05.
 */
import { eq, inArray } from "drizzle-orm";
import { systemConfig } from "../config/systemConfig";
import type { DeviceCommandResult } from "../constants";
import { hubs, sharedVehicles } from "../db/schema";
import { db } from "../lib/db";

/** Tỉ lệ lệnh thiết bị thành công – giảm xuống để thử nhánh lỗi khi demo. */
const SUCCESS_RATE = 0.9;
const DEVICE_DELAY_MS = 300;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomResult(): DeviceCommandResult {
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

  /** UC05: gửi lệnh khóa xe khi trả. Gọi NGOÀI transaction. */
  async sendLockCommand(vehicleId: string): Promise<DeviceCommandResult> {
    await wait(DEVICE_DELAY_MS);
    const result = randomResult();
    console.log(`[simulator] sendLockCommand(${vehicleId}) → ${result}`);
    return result;
  },
};
