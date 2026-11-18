// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ProcessedRequest, RedistributionItem, RedistributionOrder } from "../db/schema";
import type { RedistributionPreview } from "../types/dto";
import { db } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const redistributionRepository = {
  findOrderWithItems(orderId: string): RedistributionOrder {
    throw notImplemented("RedistributionRepository.findOrderWithItems");
  },

  findRedistributionOptions(
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
  ): RedistributionPreview {
    throw notImplemented("RedistributionRepository.findRedistributionOptions");
  },

  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    throw notImplemented("RedistributionRepository.findProcessedRequest");
  },

  /** UC12 – trong db.transaction: xe phải AVAILABLE tại Hub nguồn; tạo lệnh + từng item PENDING, xe bị khóa đặt. */
  atomicCreateOrder(
    requestId: string,
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
    createdBy: string,
    now: Date,
  ): RedistributionOrder {
    throw notImplemented("RedistributionRepository.atomicCreateOrder");
  },

  /** UC12 – xe rời Hub nguồn: item IN_TRANSIT, xe IN_TRANSIT, giải phóng vị trí đỗ. */
  atomicMarkDeparted(requestId: string, orderId: string, vehicleId: string, now: Date): RedistributionItem {
    throw notImplemented("RedistributionRepository.atomicMarkDeparted");
  },

  /** UC12 – xe tới Hub đích: item ARRIVED, xe AVAILABLE tại vị trí mới; cập nhật trạng thái lệnh. */
  atomicMarkArrived(requestId: string, orderId: string, vehicleId: string, now: Date): RedistributionItem {
    throw notImplemented("RedistributionRepository.atomicMarkArrived");
  },

  /** UC12 – hủy các item còn PENDING; lệnh → CANCELLED hoặc PARTIALLY_COMPLETED. */
  atomicCancelPendingItems(requestId: string, orderId: string, now: Date): RedistributionOrder {
    throw notImplemented("RedistributionRepository.atomicCancelPendingItems");
  },

  atomicCloseOrder(requestId: string, orderId: string, now: Date): RedistributionOrder {
    throw notImplemented("RedistributionRepository.atomicCloseOrder");
  },

  markReconciliationRequired(orderId: string, vehicleId: string, now: Date): RedistributionItem {
    throw notImplemented("RedistributionRepository.markReconciliationRequired");
  },
};
