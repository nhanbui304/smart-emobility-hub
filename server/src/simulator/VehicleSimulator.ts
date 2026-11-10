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
import type { DeviceCommandResult, VehicleTechStatus } from "../constants";
import { hubs, sharedVehicles } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

/** Vị trí xe do thiết bị báo về (UC05: readVehiclePosition). */
export interface VehiclePosition {
  hubId: string;
  slotId: string;
  reportedAt: Date;
}

/** Kết quả khóa xe (UC05 bước 7: lockResult(status, batteryLevel, techStatus)). */
export interface LockResult {
  status: DeviceCommandResult;
  /** undefined khi không đọc được (status UNKNOWN). */
  batteryLevel?: number;
  techStatus: VehicleTechStatus;
}

/** Tỉ lệ lệnh thiết bị thành công – giảm xuống để thử nhánh lỗi khi demo. */
const SUCCESS_RATE = 0.9;
const DEVICE_DELAY_MS = 300;
/** Tỉ lệ thiết bị báo xe có sự cố kỹ thuật khi khóa. */
const FAULT_RATE = 0.05;

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

  /**
   * UC05 bước 6 (Sequence 2/3, 3/3): đọc vị trí xe do thiết bị báo về.
   * Giả lập: trả về chỗ trả đã phân bổ cho chuyến đi của xe; thỉnh thoảng trả sai vị trí
   * (hoặc null = chưa xác định) để thử Ext 6a.
   */
  async readVehiclePosition(vehicleId: string): Promise<VehiclePosition | null> {
    throw notImplemented("VehicleSimulator.readVehiclePosition (UC05)");
  },

  /**
   * UC05 bước 7: gửi lệnh khóa xe khi trả. Gọi NGOÀI transaction.
   * Trả kết quả khóa kèm mức pin và tình trạng kỹ thuật để xác định trạng thái xe (Ext 9a).
   */
  async sendLockCommand(vehicleId: string): Promise<LockResult> {
    await wait(DEVICE_DELAY_MS);
    const status = randomResult();
    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
    const result: LockResult = {
      status,
      batteryLevel: status === "UNKNOWN" ? undefined : vehicle?.batteryLevel,
      techStatus: status === "UNKNOWN" ? "UNKNOWN" : Math.random() < FAULT_RATE ? "FAULT" : "OK",
    };
    console.log(`[simulator] sendLockCommand(${vehicleId}) → ${JSON.stringify(result)}`);
    return result;
  },
};
