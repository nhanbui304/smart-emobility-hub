/** Các mảnh zod schema dùng lại nhiều nơi. */
import { z } from "zod";

export const idParams = z.object({ id: z.string().min(1) });

/** Khoảng thời gian; endTime phải sau startTime. */
export const timeRangeSchema = z
  .object({ startTime: z.coerce.date(), endTime: z.coerce.date() })
  .refine((r) => r.endTime > r.startTime, { message: "Thời điểm kết thúc phải sau thời điểm bắt đầu." });

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

/**
 * Mã yêu cầu do client sinh (crypto.randomUUID()) cho MỖI lần bấm xác nhận.
 * Thử lại do mất mạng thì gửi lại cùng mã → server trả kết quả cũ, không ghi trùng.
 */
export const requestIdField = z.string().min(8).max(100);

/** Nhu cầu sạc: % pin hiện tại và % pin mong muốn (UC07, UC08, UC09). */
export const chargingNeedSchema = z
  .object({
    currentBattery: z.number().int().min(0).max(100),
    targetBattery: z.number().int().min(1).max(100),
  })
  .refine((n) => n.targetBattery > n.currentBattery, { message: "Mức pin mong muốn phải cao hơn mức pin hiện tại." });

/** Phiên bản mong đợi, dùng để phát hiện dữ liệu đã bị người khác sửa (UC09, UC11, UC13). */
export const versionField = z.number().int().positive();
