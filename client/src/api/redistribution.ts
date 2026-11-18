// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
// Gọi API của RedistributionController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { RedistributionItem, RedistributionOrder, RedistributionPreview } from "../types";
import { api } from "./client";

export const redistributionApi = {
  /** POST /api/redistribution-orders/options */
  getRedistributionOptions: (sourceHubId: string, targetHubId: string, eta: string) =>
    api.post<RedistributionPreview>("/redistribution-orders/options", { sourceHubId, targetHubId, eta }),
  /** POST /api/redistribution-orders */
  createOrder: (requestId: string, sourceHubId: string, targetHubId: string, vehicleIds: string[], eta: string) =>
    api.post<RedistributionOrder>("/redistribution-orders", { requestId, sourceHubId, targetHubId, vehicleIds, eta }),
  /** POST /api/redistribution-orders/:orderId/items/:vehicleId/depart */
  confirmDeparture: (requestId: string, orderId: string, vehicleId: string) =>
    api.post<RedistributionItem>(`/redistribution-orders/${orderId}/items/${vehicleId}/depart`, { requestId }),
  /** POST /api/redistribution-orders/:orderId/items/:vehicleId/arrive */
  confirmArrival: (requestId: string, orderId: string, vehicleId: string) =>
    api.post<RedistributionItem>(`/redistribution-orders/${orderId}/items/${vehicleId}/arrive`, { requestId }),
  /** POST /api/redistribution-orders/:orderId/cancel-pending */
  cancelPendingItems: (requestId: string, orderId: string) =>
    api.post<RedistributionOrder>(`/redistribution-orders/${orderId}/cancel-pending`, { requestId }),
  /** POST /api/redistribution-orders/:orderId/close */
  closeOrder: (requestId: string, orderId: string) =>
    api.post<RedistributionOrder>(`/redistribution-orders/${orderId}/close`, { requestId }),
};
