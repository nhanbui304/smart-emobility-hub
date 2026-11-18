// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
// Gọi API của ChargingRequestController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { CancelChargingResult, ChargingNeed, ChargingProposal, ChargingRequestResult } from "../types";
import { api } from "./client";

export const chargingRequestApi = {
  /** POST /api/charging-requests/prepare */
  prepareChargingRequest: (hubId: string, vehicleId: string, chargingNeed: ChargingNeed) =>
    api.post<ChargingProposal>("/charging-requests/prepare", { hubId, vehicleId, chargingNeed }),
  /** POST /api/charging-requests */
  submitChargingRequest: (requestId: string, hubId: string, vehicleId: string, chargingNeed: ChargingNeed) =>
    api.post<ChargingRequestResult>("/charging-requests", { requestId, hubId, vehicleId, chargingNeed }),
  /** POST /api/charging-requests/:chargingRequestId/cancel */
  cancelChargingRequest: (requestId: string, chargingRequestId: string) =>
    api.post<CancelChargingResult>(`/charging-requests/${chargingRequestId}/cancel`, { requestId }),
};
