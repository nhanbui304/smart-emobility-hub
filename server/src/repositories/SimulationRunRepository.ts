// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// CHỈ ghi vào bảng simulation_runs. KHÔNG bao giờ ghi vào bảng vận hành.
import type { SimulationRunStatus } from "@hub/shared";
import type { SimulationRun } from "../db/schema";
import { db, type DbOrTx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const simulationRunRepository = {
  create(input: { snapshot: unknown; scenario: unknown; dataLimitation?: string }, conn: DbOrTx = db): SimulationRun {
    throw notImplemented("SimulationRunRepository.create (UC14)");
  },

  findById(runId: string, conn: DbOrTx = db): SimulationRun | undefined {
    throw notImplemented("SimulationRunRepository.findById (UC14)");
  },

  updateStatus(runId: string, status: SimulationRunStatus, result?: unknown, conn: DbOrTx = db): SimulationRun {
    throw notImplemented("SimulationRunRepository.updateStatus (UC14)");
  },
};
