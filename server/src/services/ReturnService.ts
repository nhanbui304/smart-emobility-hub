// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { VehicleStatus, VehicleTechStatus } from "../constants";
import type { Trip } from "../db/schema";
import type { HubReturnContext, ReturnPreparation, ReturnResult, ReturnSlotPlan, VehiclePosition } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const returnService = {
  /** UC05 bước 2–4: chọn Hub trả xe, hệ thống phân bổ vị trí đỗ. */
  async prepareReturn(requestId: string, studentId: string, tripId: string, hubId: string): Promise<ReturnPreparation> {
    throw notImplemented("ReturnService.prepareReturn");
  },

  /**
   * UC05 bước 5–7: vehicleSimulator.sendLockCommand (NGOÀI transaction)
   * → SUCCESS: atomicCompleteReturn (trạng thái xe theo pin/sự cố)
   * → FAILED: recordLockFailure, giữ vị trí, cho thử lại · UNKNOWN: markPendingVerification + báo Operator.
   */
  async confirmReturn(requestId: string, studentId: string, tripId: string): Promise<ReturnResult> {
    throw notImplemented("ReturnService.confirmReturn");
  },

  /** UC05 luồng thay thế: sinh viên bỏ dở việc trả xe → giải phóng vị trí đã giữ, Trip về ACTIVE. */
  async abandonReturn(requestId: string, studentId: string, tripId: string): Promise<Trip> {
    throw notImplemented("ReturnService.abandonReturn");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function validateTripForReturn(tripInfo: Trip, studentId: string): boolean {
  throw notImplemented("ReturnService.validateTripForReturn");
}

/** private (–) trong class diagram. */
function selectReturnSlot(hubReturnContext: HubReturnContext): ReturnSlotPlan {
  throw notImplemented("ReturnService.selectReturnSlot");
}

/** private (–) trong class diagram. */
function verifyVehicleHubAndSlot(vehiclePosition: VehiclePosition, hubId: string, slotId: string): boolean {
  throw notImplemented("ReturnService.verifyVehicleHubAndSlot");
}

/** private (–) trong class diagram. */
function determineVehicleServiceStatus(batteryLevel: number, techStatus: VehicleTechStatus): VehicleStatus {
  throw notImplemented("ReturnService.determineVehicleServiceStatus");
}
