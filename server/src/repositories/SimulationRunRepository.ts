// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Chữ ký method khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC14.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { desc, eq } from "drizzle-orm";
import { systemConfig } from "../config/systemConfig";
import {
  processedRequests,
  simulationRuns,
  simulationSnapshots,
  users,
  type SimulationRun,
  type SimulationSnapshot,
} from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type {
  CreateRunResult,
  OperationalState,
  Recommendation,
  RunCancelled,
  SaveResult,
  SaveStatus,
  Scenario,
  ScenarioAssumptions,
  SimulationComparison,
  SimulationResult,
  SimulationRunHistoryItem,
  SnapshotInfo,
} from "../types/dto";
import { commonOps } from "./operational/common";

/** Lưu lý do lỗi của các lần chạy FAILED (Ext 7a) và kết quả tạm chưa lưu (Ext 9a). */
const failedRunReasons = new Map<string, string>();
const unsavedRunResults = new Map<
  string,
  {
    assumptions: ScenarioAssumptions;
    dataLimitation: string;
    comparison: SimulationComparison;
    recommendations: Recommendation[];
  }
>();
const scenarioDraftStore = new Map<string, Scenario>();
const recommendationStore = new Map<string, Recommendation>();

export function saveScenarioDraft(scenario: Scenario): void {
  scenarioDraftStore.set(scenario.scenarioDraftId, scenario);
}

export function getScenarioDraft(scenarioDraftId: string): Scenario | undefined {
  return scenarioDraftStore.get(scenarioDraftId);
}

export function saveRecommendations(recs: Recommendation[]): void {
  for (const r of recs) {
    recommendationStore.set(r.recommendationId, r);
  }
}

export function getRecommendationById(recommendationId: string): Recommendation | undefined {
  const cached = recommendationStore.get(recommendationId);
  if (cached) return cached;
  // Nạp lại từ bảng simulation_runs để nút bàn giao vẫn hoạt động sau khi reload/restart server
  const storedRuns = db.select().from(simulationRuns).orderBy(desc(simulationRuns.createdAt)).all();
  for (const run of storedRuns) {
    const found = run.result?.recommendations?.find((r) => r.recommendationId === recommendationId);
    if (found) {
      recommendationStore.set(found.recommendationId, found);
      return found;
    }
  }
  return undefined;
}

export function listSimulationRuns(): SimulationRunHistoryItem[] {
  const rows = db
    .select({
      run: simulationRuns,
      snapshot: simulationSnapshots,
    })
    .from(simulationRuns)
    .leftJoin(simulationSnapshots, eq(simulationRuns.snapshotId, simulationSnapshots.id))
    .orderBy(desc(simulationRuns.createdAt))
    .all();

  return rows.map(({ run, snapshot }) => {
    const hubIds = snapshot?.hubIds ?? [];
    const hubNames = snapshot?.operationalState?.hubs?.map((h) => h.name) ?? hubIds;
    const timeRange = snapshot?.timeRange ?? {
      startTime: run.createdAt,
      endTime: run.createdAt,
    };
    return {
      runId: run.id,
      snapshotId: run.snapshotId,
      status: run.status,
      scenarioType: run.scenario.scenarioType,
      assumptions: run.scenario.assumptions,
      hubIds,
      hubNames,
      timeRange,
      createdAt: run.createdAt,
      comparison: run.result?.comparison,
    };
  });
}

export function getFailedRunReason(runId: string): string | undefined {
  return failedRunReasons.get(runId);
}

export function setUnsavedRunResult(
  runId: string,
  payload: {
    assumptions: ScenarioAssumptions;
    dataLimitation: string;
    comparison: SimulationComparison;
    recommendations: Recommendation[];
  },
): void {
  unsavedRunResults.set(runId, payload);
}

export function getUnsavedRunResult(runId: string) {
  return unsavedRunResults.get(runId);
}

export function clearUnsavedRunResult(runId: string): void {
  unsavedRunResults.delete(runId);
}

export function findSnapshotById(snapshotId: string): SimulationSnapshot | undefined {
  return db
    .select()
    .from(simulationSnapshots)
    .where(eq(simulationSnapshots.id, snapshotId))
    .get();
}

export function findRunById(runId: string): SimulationRun | undefined {
  return db
    .select()
    .from(simulationRuns)
    .where(eq(simulationRuns.id, runId))
    .get();
}

export const simulationRunRepository = {
  /**
   * UC14 bước 2 (storeSnapshot): Lưu bản chụp dữ liệu vận hành vào bảng simulation_snapshots
   * kèm thời điểm chụp, nguồn dữ liệu, mức độ đầy đủ (completeness) và cờ dữ liệu cũ (isStale).
   */
  storeSnapshot(
    operationalState: OperationalState,
    capturedAt: Date,
    sources: string[],
  ): SnapshotInfo {
    const requestedCount = operationalState.hubIds.length;
    const actualCount = operationalState.hubs.length;
    const completeness =
      requestedCount > 0 ? Math.min(1, Math.round((actualCount / requestedCount) * 100) / 100) : 0;

    const isStale = operationalState.hubs.some((h) => {
      const ageSec = Math.floor((capturedAt.getTime() - new Date(h.lastUpdatedAt).getTime()) / 1000);
      return ageSec > systemConfig.dataStaleSeconds;
    });

    const inserted = db
      .insert(simulationSnapshots)
      .values({
        hubIds: operationalState.hubIds,
        timeRange: operationalState.timeRange,
        capturedAt,
        sources,
        completeness,
        isStale,
        staleAccepted: !isStale,
        operationalState,
        dataLimitation: isStale
          ? `Dữ liệu của một số Hub đã cũ quá ${systemConfig.dataStaleSeconds} giây tại thời điểm chụp.`
          : null,
        createdAt: capturedAt,
      })
      .returning()
      .get()!;

    return {
      snapshotId: inserted.id,
      capturedAt: inserted.capturedAt,
      sources: inserted.sources,
      completeness: inserted.completeness,
      isStale: inserted.isStale,
    };
  },

  /**
   * UC14 Ext 2b (markStaleAccepted): Operator chấp nhận tiếp tục mô phỏng với dữ liệu đã cũ;
   * đánh dấu staleAccepted = true và lưu rõ giới hạn dữ liệu (dataLimitation).
   */
  markStaleAccepted(snapshotId: string, dataLimitation: string): void {
    const snapshot = findSnapshotById(snapshotId);
    if (!snapshot) {
      throw new AppError("NOT_FOUND", "Không tìm thấy bản chụp dữ liệu mô phỏng.");
    }

    db.update(simulationSnapshots)
      .set({
        staleAccepted: true,
        dataLimitation,
      })
      .where(eq(simulationSnapshots.id, snapshotId))
      .run();
  },

  /**
   * UC14 bước 6 (createRun) – trong db.transaction:
   * - Kiểm tra requestId đã xử lý → trả về lần chạy cũ (created = false).
   * - Tạo bản ghi SimulationRun ở trạng thái RUNNING.
   * - Ghi processed_requests (operation = START_SIMULATION_RUN).
   */
  createRun(requestId: string, snapshotId: string, scenario: Scenario): CreateRunResult {
    return db.transaction(() => {
      const existingReq = commonOps.findProcessedRequest(requestId);
      if (existingReq) {
        return {
          runId: existingReq.resultId,
          created: false,
        };
      }

      const snapshot = findSnapshotById(snapshotId);
      if (!snapshot) {
        throw new AppError("NOT_FOUND", "Không tìm thấy bản chụp dữ liệu (Snapshot) để chạy mô phỏng.");
      }

      const now = new Date();
      const inserted = db
        .insert(simulationRuns)
        .values({
          snapshotId,
          scenario,
          status: "RUNNING",
          result: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get()!;

      const operatorUser =
        db.select().from(users).where(eq(users.role, "OPERATOR")).get() ??
        db.select().from(users).get()!;

      db.insert(processedRequests)
        .values({
          requestId,
          actorId: operatorUser.id,
          operation: "START_SIMULATION_RUN",
          resultId: inserted.id,
          createdAt: now,
        })
        .run();

      return {
        runId: inserted.id,
        created: true,
      };
    });
  },

  /** UC14 Ext 7b: Operator yêu cầu dừng mô phỏng → chuyển trạng thái RUNNING → CANCELLED. */
  markRunCancelled(runId: string): RunCancelled {
    const run = findRunById(runId);
    if (!run) {
      throw new AppError("NOT_FOUND", "Không tìm thấy lần chạy mô phỏng.");
    }

    db.update(simulationRuns)
      .set({
        status: "CANCELLED",
        updatedAt: new Date(),
      })
      .where(eq(simulationRuns.id, runId))
      .run();

    return { runId };
  },

  /** UC14 Ext 7a: Mô phỏng gặp lỗi hoặc vượt giới hạn xử lý → chuyển RUNNING → FAILED, không lưu kết quả dở dang. */
  markRunFailed(runId: string, reason: string): void {
    failedRunReasons.set(runId, reason);
    db.update(simulationRuns)
      .set({
        status: "FAILED",
        result: null,
        updatedAt: new Date(),
      })
      .where(eq(simulationRuns.id, runId))
      .run();
  },

  /**
   * UC14 bước 9: Lưu kết quả hoàn tất (RUNNING → COMPLETED) cùng giả định, giới hạn dữ liệu,
   * chỉ số so sánh và các khuyến nghị điều phối.
   */
  storeRunResult(
    runId: string,
    assumptions: ScenarioAssumptions,
    dataLimitation: string,
    comparison: SimulationComparison,
    recommendations: Recommendation[],
  ): SaveResult {
    const run = findRunById(runId);
    if (!run) {
      return {
        saveStatus: {
          saved: false,
          reason: "Không tìm thấy bản ghi lần chạy mô phỏng để lưu kết quả.",
        },
      };
    }

    const constraints: string[] = [
      "Kết quả mô phỏng chỉ phản ánh trên bản chụp dữ liệu giả định, không tự động thay đổi dữ liệu vận hành thực tế.",
    ];
    if (dataLimitation && dataLimitation.trim().length > 0) {
      constraints.push(`Giới hạn dữ liệu đầu vào: ${dataLimitation}`);
    }
    if (assumptions.demandMultiplier !== undefined) {
      constraints.push(`Giả định hệ số nhu cầu: x${assumptions.demandMultiplier}`);
    }
    if (assumptions.additionalChargers !== undefined) {
      constraints.push(`Giả định thay đổi cổng sạc: +${assumptions.additionalChargers} cổng`);
    }
    if (assumptions.additionalVehicles !== undefined) {
      constraints.push(`Giả định thay đổi phương tiện: +${assumptions.additionalVehicles} xe`);
    }

    const saveStatus: SaveStatus = { saved: true };
    const resultPayload: SimulationResult = {
      comparison,
      recommendations,
      constraints,
      saveStatus,
    };

    saveRecommendations(recommendations);

    db.update(simulationRuns)
      .set({
        status: "COMPLETED",
        result: resultPayload,
        updatedAt: new Date(),
      })
      .where(eq(simulationRuns.id, runId))
      .run();

    clearUnsavedRunResult(runId);
    return { saveStatus };
  },
};
