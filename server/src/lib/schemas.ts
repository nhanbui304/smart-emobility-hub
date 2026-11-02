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

/** Phiên bản mong đợi, dùng để phát hiện dữ liệu đã bị người khác sửa (UC09, UC11, UC13). */
export const versionField = z.number().int().positive();
