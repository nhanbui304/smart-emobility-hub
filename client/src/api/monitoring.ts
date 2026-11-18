// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
// Gọi API của MonitoringController. Tên hàm và tham số khớp class diagram Submission #3.
// requestId: sinh bằng crypto.randomUUID() MỘT lần cho mỗi lần bấm xác nhận; thử lại thì gửi lại cùng mã.
import type { NetworkOverview, OperatorHubDetail } from "../types";
import { api } from "./client";

export const monitoringApi = {
  /** GET /api/monitoring/overview */
  overview: () =>
    api.get<NetworkOverview>("/monitoring/overview"),
  /** GET /api/monitoring/hubs/:hubId */
  hubDetail: (hubId: string) =>
    api.get<OperatorHubDetail>(`/monitoring/hubs/${hubId}`),
};
