// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { RequestOperation } from "../constants";
import type { ProcessedRequest, RedistributionItem, RedistributionOrder } from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import { hubRepository } from "../repositories/HubRepository";
import { redistributionRepository } from "../repositories/RedistributionRepository";
import type { RedistributionPreview } from "../types/dto";

export const redistributionService = {
  /** UC12 bước 2–4: hiển thị xe có thể điều chuyển và sức chứa tiếp nhận của Hub đích tại thời điểm dự kiến. */
  async getRedistributionOptions(
    sourceHubId: string,
    targetHubId: string,
    vehicleIds: string[],
    eta: Date,
  ): Promise<RedistributionPreview> {
    assertValidRequest(sourceHubId, targetHubId, eta);
    return redistributionRepository.findRedistributionOptions(sourceHubId, targetHubId, vehicleIds, eta);
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
    const done = redistributionRepository.findProcessedRequest(requestId);
    if (done) {
      assertSameOperation(done, "CREATE_REDISTRIBUTION_ORDER");
      return redistributionRepository.findOrderWithItems(done.resultId);
    }

    const uniqueVehicleIds = [...new Set(vehicleIds)];
    if (uniqueVehicleIds.length === 0) throw new AppError("VALIDATION_ERROR", "Hãy chọn ít nhất một xe để điều chuyển.");
    assertValidRequest(sourceHubId, targetHubId, eta);
    if (!checkVehicleEligibility(uniqueVehicleIds, sourceHubId)) {
      throw new AppError(
        "CONFLICT",
        "Có xe không đủ điều kiện điều chuyển (đang được sử dụng, sạc, giữ chỗ hoặc gặp sự cố). Vui lòng chọn lại.",
      );
    }
    if (!checkTargetHubCapacity(targetHubId, uniqueVehicleIds, eta)) {
      throw new AppError("CONFLICT", "Hub đích không đủ sức chứa. Hãy giảm số xe, đổi thời điểm hoặc chọn Hub khác.");
    }

    // Kiểm tra lại điều kiện và ghi trong một thao tác nhất quán (UC12 bước 6).
    return db.transaction(() =>
      redistributionRepository.atomicCreateOrder(
        requestId,
        sourceHubId,
        targetHubId,
        uniqueVehicleIds,
        eta,
        operatorId,
        new Date(),
      ),
    );
  },

  /** UC12 bước 5: xác nhận một xe đã rời Hub nguồn. */
  async confirmDeparture(
    requestId: string,
    orderId: string,
    vehicleId: string,
    operatorId: string,
  ): Promise<RedistributionItem> {
    const done = redistributionRepository.findProcessedRequest(requestId);
    if (done) {
      assertSameOperation(done, "CONFIRM_REDISTRIBUTION_DEPARTURE");
      return findRecordedItem(orderId, done.resultId);
    }
    return db.transaction(() => redistributionRepository.atomicMarkDeparted(requestId, orderId, vehicleId, new Date()));
  },

  /** UC12 bước 6: xác nhận một xe đã tới Hub đích. */
  async confirmArrival(
    requestId: string,
    orderId: string,
    vehicleId: string,
    operatorId: string,
  ): Promise<RedistributionItem> {
    const done = redistributionRepository.findProcessedRequest(requestId);
    if (done) {
      assertSameOperation(done, "CONFIRM_REDISTRIBUTION_ARRIVAL");
      return findRecordedItem(orderId, done.resultId);
    }
    try {
      return db.transaction(() => redistributionRepository.atomicMarkArrived(requestId, orderId, vehicleId, new Date()));
    } catch (err) {
      if (err instanceof AppError) throw err;
      // 9a: đã tiếp nhận xe nhưng cập nhật dữ liệu lỗi → đánh dấu chờ đối soát.
      console.error("[redistribution] Cập nhật tiếp nhận xe lỗi:", err);
      redistributionRepository.markReconciliationRequired(orderId, vehicleId, new Date());
      throw new AppError("INTERNAL_ERROR", "Cập nhật dữ liệu tiếp nhận xe bị lỗi; xe được đánh dấu chờ đối soát.");
    }
  },

  /** UC12 luồng thay thế: hủy các xe chưa xuất phát. */
  async cancelPendingItems(requestId: string, orderId: string, operatorId: string): Promise<RedistributionOrder> {
    const done = redistributionRepository.findProcessedRequest(requestId);
    if (done) {
      assertSameOperation(done, "CANCEL_REDISTRIBUTION_ITEMS");
      return redistributionRepository.findOrderWithItems(done.resultId);
    }
    return db.transaction(() => redistributionRepository.atomicCancelPendingItems(requestId, orderId, new Date()));
  },

  /** UC12 bước 10: đóng lệnh khi mọi xe đã được tiếp nhận hoặc phần chưa xuất phát đã hủy. */
  async closeOrder(requestId: string, orderId: string, operatorId: string): Promise<RedistributionOrder> {
    const done = redistributionRepository.findProcessedRequest(requestId);
    if (done) {
      assertSameOperation(done, "CLOSE_REDISTRIBUTION_ORDER");
      return redistributionRepository.findOrderWithItems(done.resultId);
    }
    if (!checkOrderCompletion(orderId)) {
      throw new AppError("CONFLICT", "Còn xe chưa xuất phát hoặc đang trên đường; chưa thể đóng lệnh.");
    }
    return db.transaction(() => redistributionRepository.atomicCloseOrder(requestId, orderId, new Date()));
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram: hai Hub khác nhau và đều tồn tại (4a). */
function checkSourceAndTargetHubs(sourceHubId: string, targetHubId: string): boolean {
  return (
    sourceHubId !== targetHubId &&
    hubRepository.findById(sourceHubId) !== undefined &&
    hubRepository.findById(targetHubId) !== undefined
  );
}

/** private (–) trong class diagram: mọi xe đang ở Hub nguồn và AVAILABLE (4b). Việc xe bị khóa do lệnh khác được kiểm tra lại khi ghi. */
function checkVehicleEligibility(vehicleIds: string[], sourceHubId: string): boolean {
  const available = new Set(
    hubRepository
      .listVehicles(sourceHubId)
      .filter((v) => v.status === "AVAILABLE")
      .map((v) => v.id),
  );
  return vehicleIds.length > 0 && vehicleIds.every((id) => available.has(id));
}

/** private (–) trong class diagram: Hub đích còn đủ chỗ cho số xe, đã trừ chỗ giữ cho các lệnh khác (4c). */
function checkTargetHubCapacity(targetHubId: string, vehicleIds: string[], eta: Date): boolean {
  // Sức chứa chỉ phụ thuộc Hub đích và thời điểm ETA nên dùng chính Hub đích làm Hub nguồn khi tra cứu.
  const { availableCapacity } = redistributionRepository.findRedistributionOptions(targetHubId, targetHubId, [], eta);
  return availableCapacity >= vehicleIds.length;
}

/** private (–) trong class diagram: không còn xe PENDING / IN_TRANSIT thì lệnh có thể đóng. */
function checkOrderCompletion(orderId: string): boolean {
  const order = redistributionRepository.findOrderWithItems(orderId);
  return order.items.every((i) => i.status === "ARRIVED" || i.status === "CANCELLED");
}

// ---------- Hàm phụ (không có trong sơ đồ) ----------

function assertValidRequest(sourceHubId: string, targetHubId: string, eta: Date): void {
  if (Number.isNaN(eta.getTime()) || eta.getTime() <= Date.now()) {
    throw new AppError("VALIDATION_ERROR", "Thời điểm dự kiến tiếp nhận phải ở tương lai.");
  }
  if (!checkSourceAndTargetHubs(sourceHubId, targetHubId)) {
    throw new AppError("CONFLICT", "Hub nguồn và Hub đích phải khác nhau và đều tồn tại. Vui lòng chọn lại.");
  }
}

/**
 * Chống gửi lặp: requestId đã xử lý thì trả kết quả cũ. Bản ghi processed_requests của UC12 lưu actor là người tạo lệnh
 * (các method Repository theo sơ đồ không nhận operatorId), nên chỉ kiểm tra đúng loại thao tác.
 */
function assertSameOperation(done: ProcessedRequest, operation: RequestOperation): void {
  if (done.operation !== operation) throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho một thao tác khác.");
}

function findRecordedItem(orderId: string, itemId: string): RedistributionItem {
  const item = redistributionRepository.findOrderWithItems(orderId).items.find((i) => i.id === itemId);
  if (!item) throw new AppError("NOT_FOUND", "Không tìm thấy kết quả đã ghi nhận của yêu cầu.");
  return item;
}
