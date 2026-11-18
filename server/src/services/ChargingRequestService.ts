// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingRequest } from "../db/schema";
import type { CancelChargingResult, ChargingNeed, ChargingProposal, ChargingRequestResult } from "../types/dto";
import { notImplemented } from "../lib/errors";

export const chargingRequestService = {
  async prepareChargingRequest(
    studentId: string,
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
  ): Promise<ChargingProposal> {
    throw notImplemented("ChargingRequestService.prepareChargingRequest");
  },

  /** UC07: gửi yêu cầu sạc ngay tại Hub; được phân cổng hoặc vào hàng đợi. */
  async submitChargingRequest(
    requestId: string,
    studentId: string,
    hubId: string,
    vehicleId: string,
    chargingNeed: ChargingNeed,
  ): Promise<ChargingRequestResult> {
    throw notImplemented("ChargingRequestService.submitChargingRequest");
  },

  /** Cancel Charging Request: hủy yêu cầu chưa bắt đầu sạc. */
  async cancelChargingRequest(
    requestId: string,
    studentId: string,
    chargingRequestId: string,
  ): Promise<CancelChargingResult> {
    throw notImplemented("ChargingRequestService.cancelChargingRequest");
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. */
function validateChargingNeed(chargingNeed: ChargingNeed): boolean {
  throw notImplemented("ChargingRequestService.validateChargingNeed");
}

/** private (–) trong class diagram. */
function checkCancellationAllowed(request: ChargingRequest): boolean {
  throw notImplemented("ChargingRequestService.checkCancellationAllowed");
}
