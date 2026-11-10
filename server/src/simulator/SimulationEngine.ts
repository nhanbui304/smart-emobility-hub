// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
/**
 * Chạy mô phỏng trên BẢN COPY dữ liệu trong bộ nhớ (snapshot).
 * KHÔNG import db, KHÔNG gọi repository vận hành – đảm bảo cách ly dữ liệu mô phỏng.
 * Sequence Sub #2 truyền snapshotId; trong code Service tra snapshot rồi truyền nguyên đối tượng
 * để Engine không phải truy cập database.
 */
import { notImplemented } from "../lib/errors";
import type { Scenario, SimulationResult, StateSnapshot } from "../services/SimulationService";

export const simulationEngine = {
  /**
   * UC14 bước 7: chạy kịch bản gốc (baseline) và kịch bản giả định trên cùng snapshot.
   * Service gọi không await; xong thì Service gọi simulationService.runCompleted / runFailed.
   */
  async runBaselineAndScenario(runId: string, snapshot: StateSnapshot, scenario: Scenario): Promise<SimulationResult> {
    throw notImplemented("SimulationEngine.runBaselineAndScenario (UC14)");
  },

  /** UC14 Ext 7b: dừng lần chạy đang chạy; promise của lần chạy đó kết thúc với lỗi "aborted". */
  abort(runId: string): void {
    throw notImplemented("SimulationEngine.abort (UC14)");
  },
};
