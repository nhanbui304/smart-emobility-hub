// Owner: Nguyễn Hoàng Nhân – UC10, mục 2.3.3 Tự động cảnh báo Hub thiếu xe hoặc gần hết chỗ
import type { AlertType } from "../constants";
import type { Alert } from "../db/schema";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const alertRepository = {
  findActive(): Alert[] {
    throw notImplemented("AlertRepository.findActive (UC10)");
  },

  findActiveByHubAndType(hubId: string, type: AlertType): Alert | undefined {
    throw notImplemented("AlertRepository.findActiveByHubAndType (2.3.3)");
  },

  /** Tạo mới hoặc cập nhật giá trị cảnh báo đang mở (không tạo trùng). */
  upsertActive(hubId: string, type: AlertType, value: number, threshold: number): Alert {
    throw notImplemented("AlertRepository.upsertActive (2.3.3)");
  },

  clear(alertId: string): Alert {
    throw notImplemented("AlertRepository.clear (2.3.3)");
  },
};
