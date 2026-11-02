/**
 * Bộ giả lập xe dùng chung (thay cho thiết bị thật).
 * Owner: Bùi Quang Nhân (khung) – các UC nhận/trả xe gọi requestUnlock / sendLockCommand.
 *
 * - Mỗi simulatorTickMs: đổi pin vài xe, cập nhật lastUpdatedAt, phát HUB_STATUS_UPDATED.
 * - requestUnlock / sendLockCommand: trả kết quả giả lập SUCCESS / FAILED / UNKNOWN
 *   để test được các nhánh lỗi trong UC04, UC05.
 */
import { eq, inArray } from "drizzle-orm";
import { DeviceCommandResult, SocketEvents, VehicleStatus, type HubStatusUpdatedPayload } from "@hub/shared";
import { systemConfig } from "../config/systemConfig";
import { hubs, sharedVehicles } from "../db/schema";
import { db } from "../lib/db";
import { emitToAll } from "../lib/socket";
import { hubService } from "../services/HubService";

/** Xác suất kết quả lệnh thiết bị – chỉnh để thử nhánh lỗi khi demo/test. */
export const deviceBehavior = {
  unlockSuccessRate: 0.9,
  lockSuccessRate: 0.9,
  /** Phần còn lại sau khi trừ success sẽ chia đôi FAILED / UNKNOWN. */
  latencyMs: 300,
};

let timer: NodeJS.Timeout | null = null;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickResult(successRate: number): DeviceCommandResult {
  const r = Math.random();
  if (r < successRate) return DeviceCommandResult.SUCCESS;
  return r < successRate + (1 - successRate) / 2 ? DeviceCommandResult.FAILED : DeviceCommandResult.UNKNOWN;
}

export const vehicleSimulator = {
  /** Một nhịp giả lập: đổi pin vài xe rồi phát trạng thái Hub mới. */
  tick(now: Date = new Date()): void {
    const vehicles = db.select().from(sharedVehicles).all();
    if (vehicles.length === 0) return;

    const changed = [...vehicles].sort(() => Math.random() - 0.5).slice(0, 5);
    db.transaction((tx) => {
      for (const v of changed) {
        let battery = v.batteryLevel;
        if (v.status === VehicleStatus.CHARGING) battery += randomInt(1, 3);
        else if (v.status === VehicleStatus.IN_USE) battery -= randomInt(1, 2);
        else battery += randomInt(-1, 1);
        battery = Math.max(0, Math.min(100, battery));
        tx.update(sharedVehicles).set({ batteryLevel: battery, lastUpdatedAt: now }).where(eq(sharedVehicles.id, v.id)).run();
      }
      const hubIds = [...new Set(changed.map((v) => v.hubId).filter((id): id is string => !!id))];
      if (hubIds.length > 0) tx.update(hubs).set({ lastUpdatedAt: now }).where(inArray(hubs.id, hubIds)).run();
    });

    const payload: HubStatusUpdatedPayload = { hubs: hubService.getAllHubStatuses(now), emittedAt: now.toISOString() };
    emitToAll(SocketEvents.HUB_STATUS_UPDATED, payload);
  },

  start(): void {
    if (timer) return;
    timer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error("[simulator] Lỗi nhịp giả lập:", err);
      }
    }, systemConfig.simulatorTickMs);
    console.log(`[simulator] Chạy mỗi ${systemConfig.simulatorTickMs}ms`);
  },

  stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  },

  /** UC04: yêu cầu thiết bị mở khóa xe. Gọi NGOÀI transaction. */
  async requestUnlock(vehicleId: string): Promise<DeviceCommandResult> {
    await new Promise((r) => setTimeout(r, deviceBehavior.latencyMs));
    const result = pickResult(deviceBehavior.unlockSuccessRate);
    console.log(`[simulator] requestUnlock(${vehicleId}) → ${result}`);
    return result;
  },

  /** UC05: gửi lệnh khóa xe khi trả. Gọi NGOÀI transaction. */
  async sendLockCommand(vehicleId: string): Promise<DeviceCommandResult> {
    await new Promise((r) => setTimeout(r, deviceBehavior.latencyMs));
    const result = pickResult(deviceBehavior.lockSuccessRate);
    console.log(`[simulator] sendLockCommand(${vehicleId}) → ${result}`);
    return result;
  },
};
