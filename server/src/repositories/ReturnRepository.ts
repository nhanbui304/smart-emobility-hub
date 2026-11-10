// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Sequence Sub #2 gọi chung là OperationalRepository; trong code tách theo nghiệp vụ (xem bảng ánh xạ trong báo cáo).
import type { VehicleStatus } from "../constants";
import type { ParkingAllocation, ParkingSlot, Trip } from "../db/schema";
import type { LockResult } from "../simulator/VehicleSimulator";
import { notImplemented } from "../lib/errors";

/** UC05 bước 3 (hubReturnContext). */
export interface HubReturnContext {
  hubId: string;
  /** Hub đang tiếp nhận trả xe (không bị hạn chế do sự cố). */
  accepting: boolean;
  /** Đặt chỗ đã xác nhận của sinh viên phù hợp chuyến đi (nếu có). */
  confirmedBooking?: ParkingAllocation;
  /** Chỗ còn phân bổ được, đã trừ lượt giữ tạm / phân bổ còn hiệu lực và chỗ bị hạn chế do sự cố. */
  availableSlots: ParkingSlot[];
}

/** UC05 bước 3 (selectReturnSlot → slotPlan): dùng đặt chỗ sẵn có hoặc phân bổ chỗ mới. */
export interface ReturnSlotPlan {
  slotId: string;
  /** Có giá trị nếu dùng đặt chỗ đã xác nhận. */
  bookingId?: string;
}

/** UC05 bước 6 (findReturnHandoverContext → handoverContext). */
export interface ReturnHandoverContext {
  tripId: string;
  vehicleId: string;
  hubId: string;
  slotId: string;
  allocationId: string;
  bookingId?: string;
}

export const returnRepository = {
  /** UC05 bước 2 (findTripForReturn). */
  findTripForReturn(tripId: string): Trip | undefined {
    throw notImplemented("ReturnRepository.findTripForReturn (UC05)");
  },

  /** UC05 bước 3 (queryHubReturnContext). */
  queryHubReturnContext(hubId: string, vehicleId: string, studentId: string, now: Date): HubReturnContext {
    throw notImplemented("ReturnRepository.queryHubReturnContext (UC05)");
  },

  /**
   * UC05 bước 4 – trong db.transaction: requestId đã xử lý → trả phân bổ cũ; kiểm tra lại chỗ trong slotPlan
   * (chưa bị phân bổ, chưa bị hạn chế do sự cố); giữ chỗ, Trip → RETURN_IN_PROGRESS; ghi processed_requests.
   */
  atomicAllocateReturnSlot(input: {
    requestId: string;
    studentId: string;
    tripId: string;
    hubId: string;
    slotPlan: ReturnSlotPlan;
    now: Date;
  }): { trip: Trip; allocation: ParkingAllocation } {
    throw notImplemented("ReturnRepository.atomicAllocateReturnSlot (UC05)");
  },

  /** UC05 bước 5 (findReturnHandoverContext): chuyến đi thuộc sinh viên và đã có chỗ trả được phân bổ. */
  findReturnHandoverContext(tripId: string, studentId: string): ReturnHandoverContext | undefined {
    throw notImplemented("ReturnRepository.findReturnHandoverContext (UC05)");
  },

  /** UC05 bước 6 (markHandoverInProgress): ghi nhận đang bàn giao trước khi khóa; xe và chỗ không cấp cho yêu cầu khác. */
  markHandoverInProgress(input: { requestId: string; tripId: string; vehicleId: string; slotId: string; now: Date }): void {
    throw notImplemented("ReturnRepository.markHandoverInProgress (UC05)");
  },

  /** UC05 Ext 7a – khóa xe FAILED: ghi nhận lần thất bại; Trip vẫn RETURN_IN_PROGRESS, giữ chỗ, xe chưa được cấp lại. */
  recordLockFailure(input: { requestId: string; tripId: string; now: Date }): void {
    throw notImplemented("ReturnRepository.recordLockFailure (UC05)");
  },

  /** UC05 Ext 7b – khóa xe UNKNOWN: Trip PENDING_RECONCILIATION, xe PENDING_VERIFICATION, giữ nguyên chỗ đã phân bổ. */
  markPendingVerification(input: { tripId: string; vehicleId: string; slotId: string; now: Date }): Trip {
    throw notImplemented("ReturnRepository.markPendingVerification (UC05)");
  },

  /**
   * UC05 bước 8 – trong db.transaction: Trip ENDED (ghi returnedAt), xe đặt tại chỗ mới với vehicleServiceStatus
   * (AVAILABLE; pin < reservableBatteryThreshold hoặc sự cố → UNDER_MAINTENANCE; chưa rõ → PENDING_VERIFICATION),
   * chỗ đang sử dụng, đặt chỗ (bookingId) USED nếu có; ghi processed_requests.
   */
  atomicCompleteReturn(input: {
    requestId: string;
    studentId: string;
    tripId: string;
    vehicleId: string;
    slotId: string;
    returnedAt: Date;
    bookingId?: string;
    vehicleServiceStatus: VehicleStatus;
  }): Trip {
    throw notImplemented("ReturnRepository.atomicCompleteReturn (UC05)");
  },

  /** UC05 Ext 8a (saveHandoverForReconciliation): đã bàn giao nhưng ghi nhận thất bại → lưu để đối soát. */
  saveHandoverForReconciliation(input: { tripId: string; vehicleId: string; slotId: string; lockResult: LockResult; now: Date }): Trip {
    throw notImplemented("ReturnRepository.saveHandoverForReconciliation (UC05)");
  },

  /** UC05 Ext 5a (releaseNewReturnAllocation): chỉ giải phóng phân bổ mới của thao tác trả xe này; Trip về ACTIVE. */
  releaseNewReturnAllocation(input: { requestId: string; tripId: string; allocationId: string; now: Date }): Trip {
    throw notImplemented("ReturnRepository.releaseNewReturnAllocation (UC05)");
  },
};
