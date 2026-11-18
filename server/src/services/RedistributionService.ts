// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { RedistributionItem, RedistributionOrder } from "../db/schema";
import type { RedistributionPreview } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const redistributionService = {
  async getRedistributionOptions(
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
  ): Promise<RedistributionPreview> {
    throw notImplemented("RedistributionService.getRedistributionOptions");
  },

  /** UC12 bước 1–4: tạo lệnh điều chuyển xe giữa hai Hub. */
  async createOrder(
    requestId: string,
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
    operatorId: string,
  ): Promise<RedistributionOrder> {
    throw notImplemented("RedistributionService.createOrder");
  },

  /** UC12 bước 5: xác nhận một xe đã rời Hub nguồn. */
  async confirmDeparture(
    requestId: string,
    orderId: string,
    vehicleId: string,
    operatorId: string,
  ): Promise<RedistributionItem> {
    throw notImplemented("RedistributionService.confirmDeparture");
  },

  /** UC12 bước 6: xác nhận một xe đã tới Hub đích. */
  async confirmArrival(
    requestId: string,
    orderId: string,
    vehicleId: string,
    operatorId: string,
  ): Promise<RedistributionItem> {
    throw notImplemented("RedistributionService.confirmArrival");
  },

  /** UC12 luồng thay thế: hủy các xe chưa xuất phát. */
  async cancelPendingItems(requestId: string, orderId: string, operatorId: string): Promise<RedistributionOrder> {
    throw notImplemented("RedistributionService.cancelPendingItems");
  },

  async closeOrder(requestId: string, orderId: string, operatorId: string): Promise<RedistributionOrder> {
    throw notImplemented("RedistributionService.closeOrder");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function checkSourceAndTargetHubs(sourceHubId: string, targetHubId: string): boolean {
  throw notImplemented("RedistributionService.checkSourceAndTargetHubs");
}

/** private (–) trong class diagram. */
function checkVehicleEligibility(vehicleIds: string[], sourceHubId: string): boolean {
  throw notImplemented("RedistributionService.checkVehicleEligibility");
}

/** private (–) trong class diagram. */
function checkTargetHubCapacity(targetHubId: string, vehicleIds: string[], eta: Date): boolean {
  throw notImplemented("RedistributionService.checkTargetHubCapacity");
}

/** private (–) trong class diagram. */
function checkOrderCompletion(orderId: string): boolean {
  throw notImplemented("RedistributionService.checkOrderCompletion");
}
