// Owner: Lê Quốc Linh – UC04 Pick Up Shared Vehicle
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { Hub, SharedVehicle } from "../db/schema";
import type { PickUpPreview, PickUpResult } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const pickUpService = {
  /** UC04 bước 2–3: kiểm tra đặt xe, hiển thị thông tin xe trước khi mở khóa. */
  async preparePickUp(studentId: string, reservationId: string): Promise<PickUpPreview> {
    throw notImplemented("PickUpService.preparePickUp");
  },

  /**
   * UC04 bước 4–7: atomicBeginHandover → vehicleSimulator.requestUnlock (NGOÀI transaction)
   * → SUCCESS: atomicStartTrip · FAILED: trả về RESERVED · UNKNOWN: markPendingVerification.
   */
  async confirmPickUp(requestId: string, studentId: string, reservationId: string): Promise<PickUpResult> {
    throw notImplemented("PickUpService.confirmPickUp");
  },

  async getPickUpResult(requestId: string, studentId: string): Promise<PickUpResult> {
    throw notImplemented("PickUpService.getPickUpResult");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function checkVehicleAtPickupHub(vehicle: SharedVehicle, hub: Hub): boolean {
  throw notImplemented("PickUpService.checkVehicleAtPickupHub");
}

/** private (–) trong class diagram. */
function checkVehicleServiceability(vehicle: SharedVehicle): boolean {
  throw notImplemented("PickUpService.checkVehicleServiceability");
}
