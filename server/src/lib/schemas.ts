/** Các mảnh zod schema dùng lại nhiều nơi. */
import { z } from "zod";

/** requestId do client sinh bằng crypto.randomUUID() cho MỖI thao tác ghi. */
export const requestIdField = z.uuid("requestId phải là UUID (client sinh bằng crypto.randomUUID()).");

/** Body tối thiểu của một thao tác ghi. */
export const writeBody = z.object({ requestId: requestIdField });

export const idParams = z.object({ id: z.string().min(1) });

/** Khoảng thời gian; endTime phải sau startTime. */
export const timeRangeSchema = z
  .object({ startTime: z.coerce.date(), endTime: z.coerce.date() })
  .refine((r) => r.endTime > r.startTime, { message: "Thời điểm kết thúc phải sau thời điểm bắt đầu." });
export type TimeRange = z.infer<typeof timeRangeSchema>;

/** Phiên bản mong đợi (optimistic locking) – UC09, UC11, UC13. */
export const versionField = z.number().int().positive();
