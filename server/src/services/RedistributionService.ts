// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import type { RedistributionItem, RedistributionOrder } from "../db/schema";
import { notImplemented } from "../lib/errors";

// operatorId (tham số cuối) lấy từ phiên đăng nhập.
export const redistributionService = {
  /** UC12 bước 1–4: tạo lệnh điều chuyển xe giữa hai Hub. */
  async createOrder(
    requestId: string,
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date | null,
    operatorId: string,
  ): Promise<RedistributionOrder> {
    throw notImplemented("RedistributionService.createOrder (UC12)");
  },

  /** UC12 bước 5: xác nhận một xe đã rời Hub nguồn. */
  async confirmDeparture(
    requestId: string,
    orderId: string,
    vehicleId: string,
    operatorId: string,
  ): Promise<RedistributionItem> {
    throw notImplemented("RedistributionService.confirmDeparture (UC12)");
  },

  /** UC12 bước 6: xác nhận một xe đã tới Hub đích. */
  async confirmArrival(
    requestId: string,
    orderId: string,
    vehicleId: string,
    operatorId: string,
  ): Promise<RedistributionItem> {
    throw notImplemented("RedistributionService.confirmArrival (UC12)");
  },

  /** UC12 luồng thay thế: hủy các xe chưa xuất phát. */
  async cancelPendingItems(requestId: string, orderId: string, operatorId: string): Promise<RedistributionOrder> {
    throw notImplemented("RedistributionService.cancelPendingItems (UC12)");
  },
};
