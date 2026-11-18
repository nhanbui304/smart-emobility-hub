// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation (đọc dữ liệu vận hành để chụp snapshot)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { TimeRange } from "../../lib/schemas";
import type { OperationalState } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const simulationOps = {
  readOperationalState(hubIds: string[], timeRange: TimeRange): OperationalState {
    throw notImplemented("OperationalRepository.readOperationalState");
  },
};
