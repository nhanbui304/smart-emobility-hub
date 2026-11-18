// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
/**
 * Chạy mô phỏng trên snapshot đã chụp (bảng simulation_snapshots), KHÔNG đọc/ghi bảng vận hành
 * (xe, chỗ đỗ, lịch sạc...) – đảm bảo cách ly dữ liệu mô phỏng (Dependability, Sub #3 mục 1.4).
 * Chạy nền: runBaselineAndScenario trả về ngay; xong thì gọi simulationService.runCompleted / runFailed.
 */
import { notImplemented } from "../lib/errors";
import type { Scenario } from "../types/dto";

export const simulationEngine = {
  /** UC14 bước 7: chạy kịch bản gốc (baseline) và kịch bản giả định trên cùng snapshot. */
  runBaselineAndScenario(runId: string, snapshotId: string, scenario: Scenario): void {
    throw notImplemented("SimulationEngine.runBaselineAndScenario");
  },

  /** UC14 Ext 7b: dừng lần chạy đang chạy. */
  abort(runId: string): void {
    throw notImplemented("SimulationEngine.abort");
  },
};
