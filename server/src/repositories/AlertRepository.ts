// Owner: Nguyễn Hoàng Nhân – UC10, mục 2.3.3
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { AlertType } from "../constants";
import type { Alert } from "../db/schema";
import type { TimeRange } from "../lib/schemas";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const alertRepository = {
  findActive(): Alert[] {
    throw notImplemented("AlertRepository.findActive");
  },

  findActiveByHubAndType(hubId: string, type: AlertType): Alert | undefined {
    throw notImplemented("AlertRepository.findActiveByHubAndType");
  },

  /** Tạo mới hoặc cập nhật giá trị cảnh báo đang mở (không tạo trùng). */
  upsertActive(hubId: string, type: AlertType, value: number, threshold: number, evaluationWindow?: TimeRange): Alert {
    throw notImplemented("AlertRepository.upsertActive");
  },

  clear(alertId: string): Alert {
    throw notImplemented("AlertRepository.clear");
  },
};
