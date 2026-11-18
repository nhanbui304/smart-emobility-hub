// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { TimeRange } from "../../lib/schemas";
import type { ApplyResult, ChargingContext } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const chargingScheduleOps = {
  queryChargingContext(hubId: string, timeRange: TimeRange): ChargingContext {
    throw notImplemented("OperationalRepository.queryChargingContext");
  },

  atomicApplyChargingSchedule(requestId: string, planDraftId: string, baseVersion: number): ApplyResult {
    throw notImplemented("OperationalRepository.atomicApplyChargingSchedule");
  },

  /** UC13 Ext 9a: đánh dấu kế hoạch cần gửi lại thông báo. */
  markNotificationPending(scheduleVersionId: string): void {
    throw notImplemented("OperationalRepository.markNotificationPending");
  },
};
