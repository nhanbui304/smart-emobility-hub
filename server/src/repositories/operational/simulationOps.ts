// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation (đọc dữ liệu vận hành để chụp snapshot)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC14.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { TimeRange } from "../../lib/schemas";
import { hubService } from "../../services/HubService";
import type { OperationalState } from "../../types/dto";

export const simulationOps = {
  /**
   * UC14 bước 2: Chỉ đọc (Read-only) trạng thái vận hành của các Hub thuộc phạm vi đánh giá
   * để tạo bản chụp (snapshot). Tuyệt đối không ghi/sửa các bảng vận hành thực tế.
   */
  readOperationalState(hubIds: string[], timeRange: TimeRange): OperationalState {
    const allStatuses = hubService.getAllHubStatuses(new Date());
    const idSet = new Set(hubIds);
    const hubs = allStatuses.filter((h) => idSet.has(h.id));

    return {
      hubIds,
      timeRange,
      hubs,
    };
  },
};
