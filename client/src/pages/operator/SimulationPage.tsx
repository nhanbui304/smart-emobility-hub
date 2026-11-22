// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { newRequestId } from "../../api/requestId";
import { simulationApi } from "../../api/simulation";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type {
  ActionImpactResult,
  Recommendation,
  RunOutcome,
  Scenario,
  ScenarioAssumptions,
  ScenarioType,
  SimulatedActionType,
  SimulationPreview,
  SimulationRunHistoryItem,
  SnapshotInfo,
  TimeRange,
} from "../../types";

const SCENARIO_CATALOG: { type: ScenarioType; title: string; sub: string }[] = [
  { type: "DEMAND_SURGE", title: "Tăng nhu cầu", sub: "Cao điểm 1.2x – 5.0x" },
  { type: "HUB_CLOSURE", title: "Đóng 1 Hub", sub: "Dồn nhu cầu sang Hub gần" },
  { type: "ADD_CHARGERS", title: "Thêm cổng sạc", sub: "Giảm thời gian chờ sạc" },
  { type: "ADD_VEHICLES", title: "Thêm xe điện", sub: "Giảm thiếu hụt xe" },
];

function scenarioTitle(type?: ScenarioType): string {
  return SCENARIO_CATALOG.find((s) => s.type === type)?.title ?? type ?? "Kịch bản";
}

function summarizeAssumptions(
  scenarioType: ScenarioType,
  assumptions: ScenarioAssumptions,
  hubNameById: Map<string, string>,
): string {
  const hubLabel = assumptions.hubId ? (hubNameById.get(assumptions.hubId) ?? assumptions.hubId) : "Toàn phạm vi";
  if (scenarioType === "DEMAND_SURGE") {
    return `${hubLabel} · x${assumptions.demandMultiplier ?? 1.5}`;
  }
  if (scenarioType === "HUB_CLOSURE") {
    return `Đóng ${hubLabel}`;
  }
  if (scenarioType === "ADD_CHARGERS") {
    return `${hubLabel} · +${assumptions.additionalChargers ?? 0} cổng`;
  }
  return `${hubLabel} · +${assumptions.additionalVehicles ?? 0} xe`;
}

function getDefaultTimeRange(): { startLocal: string; endLocal: string } {
  const now = new Date();
  const start = new Date(now.getTime() + 10 * 60_000);
  const end = new Date(now.getTime() + 130 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { startLocal: fmt(start), endLocal: fmt(end) };
}

export function SimulationPage() {
  const navigate = useNavigate();
  const { data: hubs, loading: hubsLoading } = useAsync(() => hubApi.list(), []);
  const history = useAsync(() => simulationApi.listRuns(), []);

  const [selectedHubIds, setSelectedHubIds] = useState<string[]>([]);
  const [{ startLocal, endLocal }, setTimeInput] = useState(getDefaultTimeRange);
  const [editingScope, setEditingScope] = useState<boolean>(true);

  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [staleAccepted, setStaleAccepted] = useState<boolean>(false);
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);

  const [scenarioType, setScenarioType] = useState<ScenarioType>("DEMAND_SURGE");
  const [targetHubId, setTargetHubId] = useState<string>("");
  const [demandMultiplier, setDemandMultiplier] = useState<number>(2.0);
  const [additionalChargers, setAdditionalChargers] = useState<number>(2);
  const [additionalVehicles, setAdditionalVehicles] = useState<number>(5);

  const [preview, setPreview] = useState<SimulationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const [runId, setRunId] = useState<string | null>(null);
  const [runOutcome, setRunOutcome] = useState<RunOutcome | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<SimulationRunHistoryItem | null>(null);
  const [loadingHistoryRunId, setLoadingHistoryRunId] = useState<string | null>(null);
  const [startingRun, setStartingRun] = useState<boolean>(false);
  const [stoppingRun, setStoppingRun] = useState<boolean>(false);
  const [retryingSave, setRetryingSave] = useState<boolean>(false);
  const [handoffLoadingId, setHandoffLoadingId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState(newRequestId);
  const [error, setError] = useState<unknown>(null);

  // Trạng thái Dự đoán tác động hành động (ở lại What-if, chỉ tính trên dữ liệu mô phỏng)
  const [activeRecId, setActiveRecId] = useState<string | null>(null);
  const [activeActionType, setActiveActionType] = useState<SimulatedActionType>("REDISTRIBUTE_VEHICLES");
  const [impactSourceHubId, setImpactSourceHubId] = useState<string>("");
  const [impactTargetHubId, setImpactTargetHubId] = useState<string>("");
  const [impactVehicleCount, setImpactVehicleCount] = useState<number>(3);
  const [impactChargingHubId, setImpactChargingHubId] = useState<string>("");
  const [impactTurnaroundCount, setImpactTurnaroundCount] = useState<number>(2);
  const [impactResult, setImpactResult] = useState<ActionImpactResult | null>(null);
  const [impactLoading, setImpactLoading] = useState<boolean>(false);

  const hubNameById = new Map<string, string>((hubs ?? []).map((h) => [h.id, h.name]));

  useEffect(() => {
    if (hubs && hubs.length > 0 && selectedHubIds.length === 0) {
      setSelectedHubIds(hubs.map((h) => h.id));
      setTargetHubId(hubs[0]!.id);
    }
  }, [hubs, selectedHubIds.length]);

  useEffect(() => {
    if (!runId) return;
    if (runOutcome && runOutcome.status !== "RUNNING") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const outcome = await simulationApi.getRunResult(runId);
        if (!cancelled) {
          setRunOutcome(outcome);
          if (outcome.status === "COMPLETED") {
            void history.reload();
          }
        }
      } catch (err) {
        if (!cancelled) setError(err);
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, runOutcome?.status]);

  const clearImpact = () => {
    setActiveRecId(null);
    setImpactResult(null);
  };

  const toggleHubSelection = (hubId: string) => {
    setSelectedHubIds((prev) =>
      prev.includes(hubId) ? prev.filter((id) => id !== hubId) : [...prev, hubId],
    );
  };

  const buildTimeRange = (): TimeRange => ({
    startTime: new Date(startLocal).toISOString(),
    endTime: new Date(endLocal).toISOString(),
  });

  const selectScope = async () => {
    setError(null);
    setSnapshotLoading(true);
    clearImpact();
    setViewingHistoryItem(null);
    try {
      const info = await simulationApi.prepareSimulation(selectedHubIds, buildTimeRange());
      setSnapshot(info);
      setStaleAccepted(!info.isStale);
      setPreview(null);
      setRunId(null);
      setRunOutcome(null);
      if (!info.isStale) setEditingScope(false);
      if (selectedHubIds.length > 0 && !selectedHubIds.includes(targetHubId)) {
        setTargetHubId(selectedHubIds[0]!);
      }
    } catch (err) {
      setError(err);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const acceptStaleSnapshot = async (snapshotId: string) => {
    setError(null);
    try {
      await simulationApi.acceptStaleSnapshot(snapshotId);
      setStaleAccepted(true);
      setEditingScope(false);
    } catch (err) {
      setError(err);
    }
  };

  const rejectStaleSnapshot = () => {
    setSnapshot(null);
    setStaleAccepted(false);
    setPreview(null);
    setRunId(null);
    setRunOutcome(null);
    clearImpact();
    setEditingScope(true);
  };

  const buildAssumptions = (): ScenarioAssumptions => {
    const assumptions: ScenarioAssumptions = { hubId: targetHubId || undefined };
    if (scenarioType === "DEMAND_SURGE") assumptions.demandMultiplier = Number(demandMultiplier);
    else if (scenarioType === "ADD_CHARGERS") assumptions.additionalChargers = Number(additionalChargers);
    else if (scenarioType === "ADD_VEHICLES") assumptions.additionalVehicles = Number(additionalVehicles);
    return assumptions;
  };

  const configureScenario = async (): Promise<SimulationPreview | null> => {
    if (!snapshot) return null;
    setError(null);
    setPreviewLoading(true);
    clearImpact();
    setViewingHistoryItem(null);
    try {
      const simPreview = await simulationApi.submitScenario(
        snapshot.snapshotId,
        scenarioType,
        buildAssumptions(),
      );
      setPreview(simPreview);
      setRunId(null);
      setRunOutcome(null);
      setPendingRequestId(newRequestId());
      return simPreview;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setPreviewLoading(false);
    }
  };

  const runQuickSimulation = async () => {
    setError(null);
    setStartingRun(true);
    clearImpact();
    setViewingHistoryItem(null);
    try {
      let activeSnap = snapshot;
      if (!activeSnap) {
        activeSnap = await simulationApi.prepareSimulation(selectedHubIds, buildTimeRange());
        setSnapshot(activeSnap);
        setStaleAccepted(!activeSnap.isStale);
        if (activeSnap.isStale) {
          setEditingScope(true);
          return;
        }
        setEditingScope(false);
      }
      const simPreview = await simulationApi.submitScenario(
        activeSnap.snapshotId,
        scenarioType,
        buildAssumptions(),
      );
      setPreview(simPreview);
      const reqId = newRequestId();
      const started = await simulationApi.runSimulation(reqId, simPreview.scenarioDraftId);
      setPendingRequestId(newRequestId());
      setRunId(started.runId);
      setRunOutcome({ status: "RUNNING" });
    } catch (err) {
      setError(err);
    } finally {
      setStartingRun(false);
    }
  };

  const confirmRunSimulation = async (scenarioDraftId: string) => {
    setError(null);
    setStartingRun(true);
    clearImpact();
    setViewingHistoryItem(null);
    try {
      const started = await simulationApi.runSimulation(pendingRequestId, scenarioDraftId);
      setPendingRequestId(newRequestId());
      setRunId(started.runId);
      setRunOutcome({ status: "RUNNING" });
    } catch (err) {
      setError(err);
    } finally {
      setStartingRun(false);
    }
  };

  const stopRun = async (currentRunId: string) => {
    setError(null);
    setStoppingRun(true);
    try {
      await simulationApi.stopRun(currentRunId);
      setRunOutcome({ status: "CANCELLED" });
    } catch (err) {
      setError(err);
    } finally {
      setStoppingRun(false);
    }
  };

  const retrySaveRun = async (currentRunId: string) => {
    setError(null);
    setRetryingSave(true);
    try {
      await simulationApi.retrySaveRun(currentRunId);
      const refreshed = await simulationApi.getRunResult(currentRunId);
      setRunOutcome(refreshed);
      void history.reload();
    } catch (err) {
      setError(err);
    } finally {
      setRetryingSave(false);
    }
  };

  /** Mở lại một lượt đã lưu trong Lịch sử mô phỏng (không chạy lại mô phỏng). */
  const openHistoryRun = async (item: SimulationRunHistoryItem) => {
    setError(null);
    setLoadingHistoryRunId(item.runId);
    clearImpact();
    try {
      const outcome = await simulationApi.getRunResult(item.runId);
      setRunId(item.runId);
      setRunOutcome(outcome);
      setViewingHistoryItem(item);
      setPreview(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingHistoryRunId(null);
    }
  };

  /** Dự đoán tác động của đề xuất hành động ngay trong What-if (KHÔNG tạo lệnh thật). */
  const openAndSimulateImpact = async (rec: Recommendation) => {
    if (!runId) return;
    setError(null);
    const actionType: SimulatedActionType =
      rec.targetUseCase === "UC12" ? "REDISTRIBUTE_VEHICLES" : "PRIORITIZE_LOW_BATTERY_CHARGING";
    setActiveRecId(rec.recommendationId);
    setActiveActionType(actionType);
    setImpactLoading(true);
    try {
      const res = await simulationApi.simulateActionImpact(runId, {
        recommendationId: rec.recommendationId,
        actionType,
      });
      setImpactResult(res);
      if (res.appliedParams.sourceHubId) setImpactSourceHubId(res.appliedParams.sourceHubId);
      if (res.appliedParams.targetHubId) setImpactTargetHubId(res.appliedParams.targetHubId);
      if (res.appliedParams.vehicleCount !== undefined) setImpactVehicleCount(Math.max(1, res.appliedParams.vehicleCount));
      if (res.appliedParams.hubId) setImpactChargingHubId(res.appliedParams.hubId);
      if (res.appliedParams.priorityTurnaroundVehicles !== undefined) {
        setImpactTurnaroundCount(Math.max(1, res.appliedParams.priorityTurnaroundVehicles));
      }
    } catch (err) {
      setError(err);
    } finally {
      setImpactLoading(false);
    }
  };

  const recalculateImpact = async () => {
    if (!runId) return;
    setError(null);
    setImpactLoading(true);
    try {
      const payload =
        activeActionType === "REDISTRIBUTE_VEHICLES"
          ? {
              recommendationId: activeRecId ?? undefined,
              actionType: activeActionType,
              sourceHubId: impactSourceHubId || undefined,
              targetHubId: impactTargetHubId || undefined,
              vehicleCount: impactVehicleCount,
            }
          : {
              recommendationId: activeRecId ?? undefined,
              actionType: activeActionType,
              hubId: impactChargingHubId || undefined,
              priorityTurnaroundVehicles: impactTurnaroundCount,
            };
      const res = await simulationApi.simulateActionImpact(runId, payload);
      setImpactResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setImpactLoading(false);
    }
  };

  /** Lối phụ: mở quy trình vận hành thật UC12 / UC13 khi Operator chủ động muốn bàn giao. */
  const requestOperationalHandoff = async (rec: Recommendation) => {
    setError(null);
    setHandoffLoadingId(rec.recommendationId);
    try {
      const workflow = await simulationApi.prepareOperationalHandoff(rec.recommendationId);
      navigate(workflow.targetUseCase === "UC12" ? "/operator/redistribution" : "/operator/charging-incidents");
    } catch (err) {
      setError(err);
    } finally {
      setHandoffLoadingId(null);
    }
  };

  const scopedHubs = (hubs ?? []).filter((h) => selectedHubIds.includes(h.id));
  const activeRunScenario: Scenario | undefined = runOutcome?.scenario ?? preview?.scenario;
  const impactScopeHubs = (() => {
    const ids = runOutcome?.hubIds;
    if (ids && ids.length > 0 && hubs) {
      const filtered = hubs.filter((h) => ids.includes(h.id));
      if (filtered.length > 0) return filtered;
    }
    return scopedHubs.length > 0 ? scopedHubs : (hubs ?? []);
  })();

  const step1Done = Boolean(snapshot && staleAccepted);
  const step3Done = runOutcome?.status === "COMPLETED";

  return (
    <div className="space-y-5">
      {/* Header gọn */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Mô phỏng What-if</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-lime">
            <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-lime" />
            Tách biệt dữ liệu thật
          </span>
        </div>
        {snapshot && !editingScope && (
          <Button variant="outline" onClick={() => setEditingScope(true)} className="px-3.5 py-2 text-xs">
            Đổi phạm vi bản chụp
          </Button>
        )}
      </header>

      {/* Thanh Stepper 3 bước */}
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        <StepBadge
          num={1}
          label={
            snapshot
              ? `Bản chụp (${selectedHubIds.length} Hub · ${Math.round(snapshot.completeness * 100)}%)`
              : "Chọn phạm vi & Bản chụp"
          }
          state={step1Done ? "done" : "active"}
        />
        <div className="hidden h-px flex-1 bg-neutral-200 dark:bg-white/10 sm:block" />
        <StepBadge num={2} label="Chọn kịch bản" state={step3Done ? "done" : step1Done ? "active" : "idle"} />
        <div className="hidden h-px flex-1 bg-neutral-200 dark:bg-white/10 sm:block" />
        <StepBadge num={3} label="So sánh KPI & Mô phỏng tác động" state={step3Done ? "done" : "idle"} />
      </Card>

      {/* Bước 1: Phạm vi & Bản chụp */}
      {(editingScope || !step1Done) && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">1. Phạm vi Hub &amp; Thời gian đánh giá</h2>
            {hubs && (
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedHubIds(hubs.map((h) => h.id))}
                  className="cursor-pointer font-semibold text-brand underline dark:text-lime"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHubIds([])}
                  className="cursor-pointer text-neutral-500 underline"
                >
                  Bỏ chọn
                </button>
              </div>
            )}
          </div>

          {hubsLoading ? (
            <Spinner />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(hubs ?? []).map((h) => {
                const checked = selectedHubIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleHubSelection(h.id)}
                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      checked
                        ? "border-brand bg-brand/10 text-brand dark:border-lime dark:bg-lime/15 dark:text-lime"
                        : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-white/10"
                    }`}
                  >
                    {checked ? "✓ " : ""}
                    {h.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setTimeInput((prev) => ({ ...prev, startLocal: e.target.value }))}
              className="rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs outline-none focus:border-brand dark:border-white/15"
            />
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setTimeInput((prev) => ({ ...prev, endLocal: e.target.value }))}
              className="rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs outline-none focus:border-brand dark:border-white/15"
            />
            <Button
              variant="outline"
              onClick={() => void selectScope()}
              loading={snapshotLoading}
              disabled={selectedHubIds.length === 0}
              className="text-xs"
            >
              Chụp bản dữ liệu mới
            </Button>
          </div>

          {snapshot && snapshot.isStale && !staleAccepted && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <span>
                <strong>Dữ liệu cũ (&gt;30s):</strong> Kết quả chỉ mang tính tham khảo. Tiếp tục?
              </span>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => void acceptStaleSnapshot(snapshot.snapshotId)} className="px-3 py-1.5 text-xs">
                  Chấp nhận
                </Button>
                <Button variant="outline" onClick={rejectStaleSnapshot} className="px-3 py-1.5 text-xs">
                  Từ chối
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ErrorMessage error={error} />

      {/* Bố cục 2 cột: Trái Cấu hình (5) | Phải Kết quả & Mô phỏng tác động (7) */}
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="flex flex-col justify-between gap-5 lg:col-span-5">
          <div className="space-y-4">
            <div data-tour="uc14-scenarios" className="space-y-4">
              <h2 className="text-sm font-bold">2. Chọn kịch bản giả định</h2>

              <div className="grid grid-cols-2 gap-2.5">
                {SCENARIO_CATALOG.map((item) => {
                  const active = scenarioType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        setScenarioType(item.type);
                        setPreview(null);
                      }}
                      className={`cursor-pointer rounded-xl border p-3.5 text-left transition ${
                        active
                          ? "border-brand bg-emerald-50/60 dark:border-lime dark:bg-lime/10"
                          : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                      }`}
                    >
                      <p className="text-xs font-bold">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{item.sub}</p>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold">Hub áp dụng</label>
                <select
                  value={targetHubId}
                  onChange={(e) => setTargetHubId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-brand dark:border-white/15 dark:bg-white/5"
                >
                  {scopedHubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.availableVehicles} xe · {h.totalChargingPorts} cổng)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div data-tour="uc14-run" className="space-y-4">
              {scenarioType === "DEMAND_SURGE" && (
                <div className="space-y-2 rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Hệ số tăng nhu cầu</span>
                    <span className="text-lg font-bold tabular-nums text-brand dark:text-lime">
                      {demandMultiplier.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.2"
                    max="5.0"
                    step="0.2"
                    value={demandMultiplier}
                    onChange={(e) => setDemandMultiplier(parseFloat(e.target.value))}
                    className="w-full accent-brand dark:accent-lime"
                  />
                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>1.2x</span>
                    <span>3.0x</span>
                    <span>5.0x</span>
                  </div>
                </div>
              )}

              {scenarioType === "ADD_CHARGERS" && (
                <div className="space-y-2 rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Số cổng sạc thêm</span>
                    <span className="text-lg font-bold tabular-nums text-brand dark:text-lime">
                      +{additionalChargers} cổng
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={additionalChargers}
                    onChange={(e) => setAdditionalChargers(parseInt(e.target.value, 10))}
                    className="w-full accent-brand dark:accent-lime"
                  />
                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>+1</span>
                    <span>+10</span>
                    <span>+20</span>
                  </div>
                </div>
              )}

              {scenarioType === "ADD_VEHICLES" && (
                <div className="space-y-2 rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Số xe bổ sung</span>
                    <span className="text-lg font-bold tabular-nums text-brand dark:text-lime">
                      +{additionalVehicles} xe
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={additionalVehicles}
                    onChange={(e) => setAdditionalVehicles(parseInt(e.target.value, 10))}
                    className="w-full accent-brand dark:accent-lime"
                  />
                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>+1</span>
                    <span>+15</span>
                    <span>+30</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {snapshot && staleAccepted && (
                  <Button
                    variant="outline"
                    onClick={() => void configureScenario()}
                    loading={previewLoading}
                    className="text-xs"
                  >
                    Xem trước
                  </Button>
                )}
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => void runQuickSimulation()}
                  loading={startingRun}
                  disabled={selectedHubIds.length === 0 || runOutcome?.status === "RUNNING"}
                >
                  Chạy mô phỏng ngay
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Cột phải: Kết quả so sánh & Mô phỏng tác động hành động */}
        <Card className="space-y-5 lg:col-span-7">
          <div data-tour="uc14-results" className="h-full space-y-5">
            {runOutcome?.status === "RUNNING" && runId ? (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center gap-4 text-center">
                <Spinner />
                <div>
                  <p className="text-sm font-bold">Đang chạy mô phỏng trên bản chụp...</p>
                  <p className="text-xs text-neutral-500">Không ảnh hưởng dữ liệu vận hành thực tế</p>
                </div>
                <Button variant="danger" onClick={() => void stopRun(runId)} loading={stoppingRun} className="text-xs">
                  Dừng mô phỏng
                </Button>
              </div>
            ) : runOutcome?.status === "COMPLETED" && runOutcome.result ? (
              <div className="space-y-5">
                {viewingHistoryItem && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/75 px-3.5 py-2 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                    <span>
                      Đang xem lại lượt đã lưu lúc{" "}
                      <strong>{new Date(viewingHistoryItem.createdAt).toLocaleString("vi-VN")}</strong> (
                      {summarizeAssumptions(
                        viewingHistoryItem.scenarioType,
                        viewingHistoryItem.assumptions,
                        hubNameById,
                      )}
                      ) — không chạy lại mô phỏng.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold">
                      So sánh: Hiện tại vs {scenarioTitle(activeRunScenario?.scenarioType)}
                    </h2>
                    {activeRunScenario && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {summarizeAssumptions(
                          activeRunScenario.scenarioType,
                          activeRunScenario.assumptions,
                          hubNameById,
                        )}
                      </p>
                    )}
                  </div>
                  {runOutcome.result.saveStatus.saved ? (
                    <StatusBadge status="COMPLETED" label="Đã lưu kết quả" />
                  ) : (
                    runId && (
                      <Button variant="outline" onClick={() => void retrySaveRun(runId)} loading={retryingSave} className="px-3 py-1 text-xs">
                        Thử lưu lại
                      </Button>
                    )
                  )}
                </div>

                {/* 3 thẻ KPI Trước vs Sau */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <ComparisonCard
                    label="Xe thiếu hụt"
                    unit="xe"
                    baseline={runOutcome.result.comparison.baseline.unavailableVehicles}
                    scenario={runOutcome.result.comparison.scenario.unavailableVehicles}
                  />
                  <ComparisonCard
                    label="Chờ trung bình"
                    unit="phút"
                    baseline={runOutcome.result.comparison.baseline.waitingTimeMinutes}
                    scenario={runOutcome.result.comparison.scenario.waitingTimeMinutes}
                  />
                  <ComparisonCard
                    label="Hub quá tải"
                    unit="Hub"
                    baseline={runOutcome.result.comparison.baseline.overloadedHubCount}
                    scenario={runOutcome.result.comparison.scenario.overloadedHubCount}
                  />
                </div>

                {/* Đề xuất hành động: CTA chính là Mô phỏng tác động (ở lại What-if), nút phụ là Mở quy trình vận hành */}
                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold">Đề xuất hành động</h3>
                  {runOutcome.result.recommendations.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-neutral-200 p-4 text-xs text-neutral-500 dark:border-white/10">
                      Không có khuyến nghị cần điều chỉnh cho kịch bản này.
                    </p>
                  ) : (
                    runOutcome.result.recommendations.map((rec) => {
                      const isSimulatingThis = activeRecId === rec.recommendationId;
                      return (
                        <div
                          key={rec.recommendationId}
                          className={`space-y-3 rounded-2xl border p-4 transition ${
                            isSimulatingThis
                              ? "border-brand bg-emerald-50/40 dark:border-lime dark:bg-lime/5"
                              : "border-brand/25 bg-neutral-50/70 dark:border-lime/25 dark:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-lime">
                                {rec.targetUseCase === "UC12" ? "Điều chuyển xe (UC12)" : "Lịch sạc thông minh (UC13)"}
                              </span>
                              <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100">{rec.reason}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <Button
                                variant="primary"
                                onClick={() => void openAndSimulateImpact(rec)}
                                loading={impactLoading && isSimulatingThis}
                                className="text-xs"
                              >
                                Mô phỏng tác động
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => void requestOperationalHandoff(rec)}
                                loading={handoffLoadingId === rec.recommendationId}
                                className="text-xs"
                              >
                                Mở quy trình vận hành
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Panel Dự đoán tác động hành động ngay trong What-if */}
                {activeRecId && impactResult && (
                  <div className="space-y-4 rounded-2xl border-2 border-brand/30 bg-white p-4 dark:border-lime/30 dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 pb-3 dark:border-white/10">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-brand dark:text-lime">
                          Dự đoán tác động hành động (chỉ trên bản chụp mô phỏng)
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          So sánh KPI của kịch bản trước hành động và sau hành động giả định.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearImpact}
                        className="cursor-pointer rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10"
                      >
                        Đóng
                      </button>
                    </div>

                    {/* Tham số mô phỏng hành động có thể tùy chỉnh */}
                    {activeActionType === "REDISTRIBUTE_VEHICLES" ? (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-[11px] font-semibold">Hub nguồn</label>
                          <select
                            value={impactSourceHubId}
                            onChange={(e) => setImpactSourceHubId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
                          >
                            {impactScopeHubs.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-[11px] font-semibold">Hub đích</label>
                          <select
                            value={impactTargetHubId}
                            onChange={(e) => setImpactTargetHubId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
                          >
                            {impactScopeHubs.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-1">
                          <label className="mb-1 block text-[11px] font-semibold">Số xe chuyển</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={impactVehicleCount}
                            onChange={(e) => setImpactVehicleCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs font-semibold dark:border-white/15"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            fullWidth
                            loading={impactLoading}
                            onClick={() => void recalculateImpact()}
                            className="py-2 text-xs"
                          >
                            Tính lại tác động
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Hub ưu tiên sạc</label>
                          <select
                            value={impactChargingHubId}
                            onChange={(e) => setImpactChargingHubId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
                          >
                            {impactScopeHubs.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Số xe ưu tiên quay vòng</label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={impactTurnaroundCount}
                            onChange={(e) => setImpactTurnaroundCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs font-semibold dark:border-white/15"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            variant="outline"
                            fullWidth
                            loading={impactLoading}
                            onClick={() => void recalculateImpact()}
                            className="py-2 text-xs"
                          >
                            Tính lại tác động
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* KPI Trước hành động vs Sau hành động */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ComparisonCard
                        label="Xe thiếu hụt (sau hành động)"
                        unit="xe"
                        baseline={impactResult.beforeAction.unavailableVehicles}
                        scenario={impactResult.afterAction.unavailableVehicles}
                        baselineLabel="Trước hành động"
                      />
                      <ComparisonCard
                        label="Chờ TB (sau hành động)"
                        unit="phút"
                        baseline={impactResult.beforeAction.waitingTimeMinutes}
                        scenario={impactResult.afterAction.waitingTimeMinutes}
                        baselineLabel="Trước hành động"
                      />
                      <ComparisonCard
                        label="Hub quá tải (sau hành động)"
                        unit="Hub"
                        baseline={impactResult.beforeAction.overloadedHubCount}
                        scenario={impactResult.afterAction.overloadedHubCount}
                        baselineLabel="Trước hành động"
                      />
                    </div>

                    {/* Giả định đã dùng & Giới hạn dữ liệu (minh bạch, không bịa số) */}
                    <div className="space-y-2 rounded-xl bg-neutral-100/80 p-3 text-xs dark:bg-white/5">
                      <p className="font-semibold">Giả định đã dùng:</p>
                      <ul className="list-inside list-disc space-y-0.5 text-neutral-600 dark:text-neutral-300">
                        {impactResult.assumptionsUsed.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                      {impactResult.unavailableKpis.length > 0 && (
                        <div className="mt-2 rounded-lg border border-amber-300/70 bg-amber-50/70 p-2.5 text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-200">
                          <p className="font-semibold">Chưa đủ dữ liệu để tính chính xác:</p>
                          <ul className="mt-0.5 list-inside list-disc space-y-0.5">
                            {impactResult.unavailableKpis.map((line, i) => (
                              <li key={i}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="pt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {impactResult.limitations.join(" ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : preview ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-bold">Chỉ số hiện tại (Baseline)</h2>
                  <Button
                    variant="primary"
                    onClick={() => void confirmRunSimulation(preview.scenarioDraftId)}
                    loading={startingRun}
                    className="text-xs"
                  >
                    Xác nhận chạy mô phỏng
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                    <p className="text-xs text-neutral-500">Xe thiếu hụt</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{preview.baseline.unavailableVehicles} xe</p>
                  </div>
                  <div className="rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                    <p className="text-xs text-neutral-500">Chờ trung bình</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{preview.baseline.waitingTimeMinutes} phút</p>
                  </div>
                  <div className="rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                    <p className="text-xs text-neutral-500">Hub quá tải</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{preview.baseline.overloadedHubCount} Hub</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-8 text-center dark:border-white/10">
                <p className="text-sm font-semibold">Sẵn sàng mô phỏng</p>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  Chọn kịch bản bên trái để chạy mới, hoặc chọn một lượt trong <strong>Lịch sử mô phỏng</strong> bên dưới để xem lại kết quả đã lưu.
                </p>
              </div>
            )}

            {runOutcome?.status === "FAILED" && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <strong>Mô phỏng lỗi:</strong> {runOutcome.failureReason}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Lịch sử mô phỏng (đọc từ bảng simulation_runs, giữ nguyên sau reload) */}
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">Lịch sử mô phỏng ({history.data?.length ?? 0})</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Mở lại kết quả đã lưu theo thứ tự mới nhất mà không cần chạy lại mô phỏng.
            </p>
          </div>
          <Button variant="ghost" onClick={() => void history.reload()} loading={history.loading} className="px-3 py-1 text-xs">
            Tải lại
          </Button>
        </div>

        <ErrorMessage error={history.error} onRetry={() => void history.reload()} />

        {!history.loading && (history.data?.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 py-6 text-center text-xs text-neutral-500 dark:border-white/10">
            Chưa có lượt mô phỏng nào được lưu.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-xs">
              <thead className="border-y border-neutral-200/80 bg-neutral-50/70 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-white/10 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Thời gian</th>
                  <th className="px-3 py-2.5 font-semibold">Kịch bản &amp; Tham số</th>
                  <th className="px-3 py-2.5 font-semibold">Phạm vi Hub</th>
                  <th className="px-3 py-2.5 font-semibold">Trạng thái</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                {(history.data ?? []).map((item) => {
                  const isActive = runId === item.runId;
                  return (
                    <tr
                      key={item.runId}
                      className={isActive ? "bg-brand/5 dark:bg-lime/10" : "hover:bg-neutral-50 dark:hover:bg-white/5"}
                    >
                      <td className="px-3 py-2.5 tabular-nums text-neutral-600 dark:text-neutral-300">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold">{scenarioTitle(item.scenarioType)}</p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                          {summarizeAssumptions(item.scenarioType, item.assumptions, hubNameById)}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-neutral-600 dark:text-neutral-300">
                        {item.hubNames.length > 2
                          ? `${item.hubNames.slice(0, 2).join(", ")} +${item.hubNames.length - 2} Hub`
                          : item.hubNames.join(", ") || `${item.hubIds.length} Hub`}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant={isActive ? "primary" : "outline"}
                          loading={loadingHistoryRunId === item.runId}
                          onClick={() => void openHistoryRun(item)}
                          className="px-3 py-1 text-xs"
                        >
                          {isActive ? "Đang xem" : "Xem kết quả"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function StepBadge({ num, label, state }: { num: number; label: string; state: "done" | "active" | "idle" }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          state === "done"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-lime"
            : state === "active"
              ? "bg-brand text-lime dark:bg-lime dark:text-brand-dark"
              : "bg-neutral-100 text-neutral-400 dark:bg-white/10"
        }`}
      >
        {state === "done" ? "✓" : num}
      </span>
      <span className={`text-xs ${state === "active" ? "font-bold" : state === "done" ? "font-medium" : "text-neutral-400"}`}>
        {label}
      </span>
    </div>
  );
}

function ComparisonCard({
  label,
  unit,
  baseline,
  scenario,
  baselineLabel = "Hiện tại",
}: {
  label: string;
  unit: string;
  baseline: number;
  scenario: number;
  baselineLabel?: string;
}) {
  const delta = Math.round((scenario - baseline) * 10) / 10;
  const isWorse = delta > 0;
  const isBetter = delta < 0;
  const maxVal = Math.max(1, baseline, scenario);

  return (
    <div className="space-y-2.5 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-2xl font-bold tabular-nums ${
            isWorse
              ? "text-amber-700 dark:text-amber-300"
              : isBetter
                ? "text-emerald-700 dark:text-lime"
                : ""
          }`}
        >
          {scenario} {unit}
        </span>
        {delta !== 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${
              isWorse
                ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-lime"
            }`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <p className="text-[11px] text-neutral-400">
        {baselineLabel}: {baseline} {unit}
      </p>

      <div className="space-y-1.5 pt-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-neutral-400 dark:bg-neutral-500"
            style={{ width: `${Math.max(4, Math.round((baseline / maxVal) * 100))}%` }}
          />
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
          <div
            className={`h-full rounded-full ${isWorse ? "bg-amber-500" : "bg-brand dark:bg-lime"}`}
            style={{ width: `${Math.max(4, Math.round((scenario / maxVal) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
