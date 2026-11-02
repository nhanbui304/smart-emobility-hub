// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import type { RedistributionItem, RedistributionOrder } from "../db/schema";
import { db, type DbOrTx, type Tx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const redistributionRepository = {
  findOrderWithItems(
    orderId: string,
    conn: DbOrTx = db,
  ): { order: RedistributionOrder; items: RedistributionItem[] } | undefined {
    throw notImplemented("RedistributionRepository.findOrderWithItems (UC12)");
  },

  /** UC12 – trong runIdempotent: xe phải AVAILABLE tại Hub nguồn; tạo lệnh + từng item PENDING, xe bị khóa đặt. */
  atomicCreateOrder(
    tx: Tx,
    input: { sourceHubId: string; targetHubId: string; vehicleIds: string[]; eta: Date | null; createdBy: string },
  ): RedistributionOrder {
    throw notImplemented("RedistributionRepository.atomicCreateOrder (UC12)");
  },

  /** UC12 – xe rời Hub nguồn: item IN_TRANSIT, xe IN_TRANSIT, giải phóng vị trí đỗ. */
  atomicMarkDeparted(tx: Tx, input: { orderId: string; vehicleId: string; now: Date }): RedistributionItem {
    throw notImplemented("RedistributionRepository.atomicMarkDeparted (UC12)");
  },

  /** UC12 – xe tới Hub đích: item ARRIVED, xe AVAILABLE tại vị trí mới; cập nhật trạng thái lệnh. */
  atomicMarkArrived(tx: Tx, input: { orderId: string; vehicleId: string; now: Date }): RedistributionItem {
    throw notImplemented("RedistributionRepository.atomicMarkArrived (UC12)");
  },

  /** UC12 – hủy các item còn PENDING; lệnh → CANCELLED hoặc PARTIALLY_COMPLETED. */
  atomicCancelPendingItems(tx: Tx, input: { orderId: string; now: Date }): RedistributionOrder {
    throw notImplemented("RedistributionRepository.atomicCancelPendingItems (UC12)");
  },
};
