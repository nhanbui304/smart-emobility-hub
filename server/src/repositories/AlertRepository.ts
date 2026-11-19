// Owner: Nguyễn Hoàng Nhân – UC10, mục 2.3.3
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC10.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { and, desc, eq } from "drizzle-orm";
import type { AlertType } from "../constants";
import { alerts, type Alert } from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";

export const alertRepository = {
  /**
   * UC10 bước 4: Lấy danh sách toàn bộ cảnh báo đang hoạt động (active = true),
   * sắp xếp theo thời điểm cập nhật mới nhất.
   */
  findActive(): Alert[] {
    return db
      .select()
      .from(alerts)
      .where(eq(alerts.active, true))
      .orderBy(desc(alerts.updatedAt))
      .all();
  },

  /**
   * Mục 2.3.3 ý 5: Tìm cảnh báo đang mở của một Hub theo loại cảnh báo
   * để tránh tạo cảnh báo trùng lặp cho cùng một tình trạng.
   */
  findActiveByHubAndType(hubId: string, type: AlertType): Alert | undefined {
    return db
      .select()
      .from(alerts)
      .where(and(eq(alerts.hubId, hubId), eq(alerts.type, type), eq(alerts.active, true)))
      .get();
  },

  /**
   * Mục 2.3.3 ý 4–5: Tạo mới hoặc cập nhật giá trị cảnh báo đang mở (không tạo trùng).
   * Với cảnh báo NEAR_FULL, lưu kèm evaluationWindow (khoảng thời gian đánh giá sức chứa).
   */
  upsertActive(
    hubId: string,
    type: AlertType,
    value: number,
    threshold: number,
    evaluationWindow?: TimeRange,
  ): Alert {
    const now = new Date();
    const existing = this.findActiveByHubAndType(hubId, type);

    if (existing) {
      return db
        .update(alerts)
        .set({
          value,
          threshold,
          evaluationWindow: evaluationWindow ?? null,
          updatedAt: now,
        })
        .where(eq(alerts.id, existing.id))
        .returning()
        .get()!;
    }

    return db
      .insert(alerts)
      .values({
        hubId,
        type,
        value,
        threshold,
        active: true,
        evaluationWindow: evaluationWindow ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()!;
  },

  /**
   * Mục 2.3.3 ý 5: Khi điều kiện vi phạm không còn, kết thúc cảnh báo (active = false).
   */
  clear(alertId: string): Alert {
    const updated = db
      .update(alerts)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alertId))
      .returning()
      .get();

    if (!updated) {
      throw new AppError("NOT_FOUND", `Không tìm thấy cảnh báo ${alertId}.`);
    }
    return updated;
  },
};
