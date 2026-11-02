// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import type { ChargingRequest } from "../db/schema";
import { notImplemented } from "../lib/errors";

export interface ChargingNeed {
  currentBattery: number;
  targetBattery: number;
}

export const chargingRequestService = {
  /** UC07: gửi yêu cầu sạc ngay tại Hub; được phân cổng hoặc vào hàng đợi. */
  async submitChargingRequest(
    studentId: string,
    hubId: string,
    vehicleRef: string,
    need: ChargingNeed,
  ): Promise<ChargingRequest> {
    throw notImplemented("ChargingRequestService.submitChargingRequest (UC07)");
  },

  /** Cancel Charging Request: hủy yêu cầu chưa bắt đầu sạc. */
  async cancelChargingRequest(studentId: string, chargingRequestId: string): Promise<ChargingRequest> {
    throw notImplemented("ChargingRequestService.cancelChargingRequest (Cancel Charging Request)");
  },
};
