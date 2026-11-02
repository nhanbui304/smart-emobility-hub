// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
/**
 * Chạy mô phỏng trên BẢN COPY dữ liệu trong bộ nhớ (snapshot).
 * KHÔNG import db, KHÔNG gọi repository vận hành – đảm bảo cách ly dữ liệu mô phỏng.
 */
import { notImplemented } from "../lib/errors";
import type { Scenario, SimulationResult, StateSnapshot } from "../services/SimulationService";

export const simulationEngine = {
  /** Chạy kịch bản gốc (baseline) và kịch bản giả định trên cùng snapshot, trả về số liệu so sánh. */
  async runBaselineAndScenario(runId: string, snapshot: StateSnapshot, scenario: Scenario): Promise<SimulationResult> {
    throw notImplemented("SimulationEngine.runBaselineAndScenario (UC14)");
  },
};
