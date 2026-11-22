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
  SimulatedHubBreakdown,
  SimulationPreview,
  SimulationRunHistoryItem,
  SnapshotInfo,
  TimeRange,
} from "../../types";

const SCENARIO_CATALOG: { type: ScenarioType; title: string; sub: string }[] = [
  { type: "DEMAND_SURGE", title: "Tăng nhu cầu", sub: "Cao điểm thuê & sạc" },
  { type: "HUB_CLOSURE", title: "Đóng Hub / Hết chỗ", sub: "Dồn khách sang Hub gần" },
  { type: "ADD_CHARGERS", title: "Thêm cổng sạc", sub: "Giải tỏa quá tải sạc" },
  { type: "ADD_VEHICLES", title: "Thêm / Tập trung xe", sub: "Bổ sung hoặc dồn xe" },
];

const SESSION_RUN_KEY = "smart-emobility:uc14-active-run-id";
export const HANDOFF_UC12_KEY = "smart-emobility:uc14-handoff-uc12";
export const HANDOFF_UC13_KEY = "smart-emobility:uc14-handoff-uc13";

function getBaselineDemand(totalVehicles: number): number {
  return Math.max(4, Math.round(totalVehicles * 0.5));
}

function scenarioTitle(type?: ScenarioType): string {
  return SCENARIO_CATALOG.find((s) => s.type === type)?.title ?? type ?? "Kịch bản";
}

function summarizeAssumptions(
  scenarioType: ScenarioType,
  assumptions: ScenarioAssumptions,
  hubNameById: Map<string, string>,
): string {
  const hubLabel = assumptions.hubId ? (hubNameById.get(assumptions.hubId) ?? assumptions.hubId) : "Toàn mạng lưới (5 Hub)";
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
  const [editingScope, setEditingScope] = useState<boolean>(false);

  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [staleAccepted, setStaleAccepted] = useState<boolean>(false);
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);

  const [scenarioType, setScenarioType] = useState<ScenarioType>("DEMAND_SURGE");
  const [targetHubId, setTargetHubId] = useState<string>("");
  const [demandMultiplier, setDemandMultiplier] = useState<number>(2.0);
  const [additionalChargers, setAdditionalChargers] = useState<number>(2);
  const [additionalVehicles, setAdditionalVehicles] = useState<number>(4);

  const [preview, setPreview] = useState<SimulationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const [runId, setRunId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(SESSION_RUN_KEY);
    } catch {
      return null;
    }
  });
  const [runOutcome, setRunOutcome] = useState<RunOutcome | null>(null);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<SimulationRunHistoryItem | null>(null);
  const [loadingHistoryRunId, setLoadingHistoryRunId] = useState<string | null>(null);
  const [startingRun, setStartingRun] = useState<boolean>(false);
  const [stoppingRun, setStoppingRun] = useState<boolean>(false);
  const [retryingSave, setRetryingSave] = useState<boolean>(false);
  const [handoffLoadingId, setHandoffLoadingId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState(newRequestId);
  const [error, setError] = useState<unknown>(null);

  // Trạng thái Thử nghiệm giải pháp ngay trong What-if
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
      // Mặc định chọn Hub đầu tiên
      setTargetHubId(hubs[0]!.id);
    }
  }, [hubs, selectedHubIds.length]);

  useEffect(() => {
    try {
      if (runId) sessionStorage.setItem(SESSION_RUN_KEY, runId);
    } catch {
      // ignore storage errors
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    if (runOutcome && runOutcome.runId === runId && runOutcome.status !== "RUNNING") return;

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
      } catch {
        if (!cancelled) {
          setRunId(null);
          setRunOutcome(null);
        }
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

  const handleSelectScenarioType = (nextType: ScenarioType) => {
    setScenarioType(nextType);
    setPreview(null);
    if (!hubs || hubs.length === 0) return;
    const scoped = hubs.filter((h) => selectedHubIds.includes(h.id));
    const list = scoped.length > 0 ? scoped : hubs;
    if (nextType === "ADD_VEHICLES" || nextType === "ADD_CHARGERS") {
      // Tự chọn Hub đang có nhiều xe thiếu / chờ sạc nhất (Thư viện Trung tâm) để thấy rõ hiệu quả giảm thiếu xe & giảm chờ sạc
      const mostShortage = [...list].sort(
        (a, b) =>
          (getBaselineDemand(b.totalVehicles) - b.availableVehicles) -
          (getBaselineDemand(a.totalVehicles) - a.availableVehicles),
      )[0];
      if (mostShortage) setTargetHubId(mostShortage.id);
    } else if (nextType === "HUB_CLOSURE" && !targetHubId) {
      setTargetHubId(list[0]!.id);
    }
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
      if (targetHubId && selectedHubIds.length > 0 && !selectedHubIds.includes(targetHubId)) {
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

  const requestOperationalHandoff = async (rec: Recommendation) => {
    setError(null);
    setHandoffLoadingId(rec.recommendationId);
    try {
      const workflow = await simulationApi.prepareOperationalHandoff(rec.recommendationId);
      const breakdowns = impactResult?.hubBreakdowns ?? runOutcome?.hubBreakdowns ?? [];
      if (workflow.targetUseCase === "UC12") {
        const bestSource =
          impactSourceHubId ||
          [...breakdowns].filter((b) => !b.closed).sort((a, b) => b.scenarioSurplus - a.scenarioSurplus)[0]?.hubId ||
          "";
        const bestTarget =
          impactTargetHubId ||
          [...breakdowns].filter((b) => !b.closed).sort((a, b) => b.scenarioDeficit - a.scenarioDeficit)[0]?.hubId ||
          targetHubId ||
          "";
        try {
          sessionStorage.setItem(
            HANDOFF_UC12_KEY,
            JSON.stringify({
              sourceHubId: bestSource,
              targetHubId: bestTarget,
              vehicleCount: impactVehicleCount || 3,
              reason: rec.reason,
            }),
          );
        } catch {
          // ignore
        }
        navigate("/operator/redistribution");
      } else {
        const bestChargeHub =
          impactChargingHubId ||
          activeRunScenario?.assumptions.hubId ||
          targetHubId ||
          breakdowns[0]?.hubId ||
          "";
        try {
          sessionStorage.setItem(
            HANDOFF_UC13_KEY,
            JSON.stringify({
              hubId: bestChargeHub,
              ruleId: "LOW_BATTERY_FIRST",
              reason: rec.reason,
            }),
          );
        } catch {
          // ignore
        }
        navigate("/operator/charging-incidents");
      }
    } catch (err) {
      setError(err);
    } finally {
      setHandoffLoadingId(null);
    }
  };

  const scopedHubs = (hubs ?? []).filter((h) => selectedHubIds.includes(h.id));
  const activeRunScenario: Scenario | undefined = runOutcome?.scenario ?? preview?.scenario;
  const activeBreakdowns: SimulatedHubBreakdown[] =
    impactResult?.hubBreakdowns ?? runOutcome?.hubBreakdowns ?? [];

  const impactScopeHubs = (() => {
    const ids = runOutcome?.hubIds;
    if (ids && ids.length > 0 && hubs) {
      const filtered = hubs.filter((h) => ids.includes(h.id));
      if (filtered.length > 0) return filtered;
    }
    return scopedHubs.length > 0 ? scopedHubs : (hubs ?? []);
  })();

  const totalHubsInRun = activeBreakdowns.length || impactScopeHubs.length || 5;

  return (
    <div className="space-y-4">
      {/* Header gọn */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight">Mô phỏng What-if</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-lime">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-lime" />
            Bản nháp độc lập DB
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => setEditingScope((v) => !v)}
          className="px-3 py-1.5 text-xs"
        >
          {editingScope ? "Thu gọn phạm vi" : `Phạm vi: ${selectedHubIds.length} Hub`}
        </Button>
      </header>

      {/* Bước 1: Phạm vi & Bản chụp (chỉ mở khi cần chỉnh) */}
      {(editingScope || (snapshot && snapshot.isStale && !staleAccepted)) && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Phạm vi Hub ({selectedHubIds.length}/{hubs?.length ?? 0})
            </h2>
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
            <div className="flex flex-wrap gap-1.5">
              {(hubs ?? []).map((h) => {
                const checked = selectedHubIds.includes(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => toggleHubSelection(h.id)}
                    className={`cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${checked
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

          <div className="grid gap-2.5 sm:grid-cols-3">
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <span>Dữ liệu cũ (&gt;30s). Tiếp tục sử dụng bản chụp này?</span>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => void acceptStaleSnapshot(snapshot.snapshotId)} className="px-3 py-1 text-xs">
                  Chấp nhận
                </Button>
                <Button variant="outline" onClick={rejectStaleSnapshot} className="px-3 py-1 text-xs">
                  Từ chối
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ErrorMessage error={error} />

      {/* Bố cục 2 cột: Trái Cấu hình (4) | Phải Kết quả (8) */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="flex flex-col justify-between gap-4 lg:col-span-4">
          <div className="space-y-4">
            <div data-tour="uc14-scenarios" className="space-y-3">
              <h2 className="text-sm font-bold">1. Chọn kịch bản</h2>

              <div className="grid grid-cols-2 gap-2">
                {SCENARIO_CATALOG.map((item) => {
                  const active = scenarioType === item.type;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => handleSelectScenarioType(item.type)}
                      className={`cursor-pointer rounded-xl border p-3 text-left transition ${active
                        ? "border-brand bg-emerald-50/70 dark:border-lime dark:bg-lime/10"
                        : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                        }`}
                    >
                      <p className="text-xs font-bold">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{item.sub}</p>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Hub áp dụng</label>
                  <select
                    value={targetHubId || (scopedHubs[0]?.id ?? "")}
                    onChange={(e) => setTargetHubId(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-semibold outline-none focus:border-brand dark:border-white/15 dark:bg-neutral-900"
                  >
                    {scopedHubs.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Các ô hiển thị thông số riêng của Hub đang chọn */}
                {(() => {
                  const selectedHub = scopedHubs.find((h) => h.id === targetHubId);
                  if (!selectedHub) return null;
                  const demand = getBaselineDemand(selectedHub.totalVehicles);
                  const diff = selectedHub.availableVehicles - demand;
                  return (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-2.5 text-center dark:border-white/10 dark:bg-white/[0.03]">
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Xe sẵn sàng</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {selectedHub.availableVehicles}
                          <span className="text-xs font-normal text-neutral-400">/{selectedHub.totalVehicles}</span>
                        </p>
                      </div>
                      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-2.5 text-center dark:border-white/10 dark:bg-white/[0.03]">
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Nhu cầu</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">{demand} xe</p>
                      </div>
                      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-2.5 text-center dark:border-white/10 dark:bg-white/[0.03]">
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Hiện trạng</p>
                        <p
                          className={`mt-0.5 text-sm font-bold tabular-nums ${diff < 0
                            ? "text-amber-600 dark:text-amber-300"
                            : diff > 0
                              ? "text-emerald-600 dark:text-lime"
                              : ""
                            }`}
                        >
                          {diff < 0 ? `Thiếu ${Math.abs(diff)} xe` : diff > 0 ? `Dư ${diff} xe` : "Đủ xe"}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div data-tour="uc14-run" className="space-y-3">
              {scenarioType === "DEMAND_SURGE" && (
                <div className="space-y-1.5 rounded-xl bg-neutral-100/80 p-3 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Hệ số tăng nhu cầu</span>
                    <span className="text-base font-bold tabular-nums text-brand dark:text-lime">
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
                </div>
              )}

              {scenarioType === "ADD_CHARGERS" && (
                <div className="space-y-1.5 rounded-xl bg-neutral-100/80 p-3 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Số cổng sạc thêm</span>
                    <span className="text-base font-bold tabular-nums text-brand dark:text-lime">
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
                </div>
              )}

              {scenarioType === "ADD_VEHICLES" && (
                <div className="space-y-1.5 rounded-xl bg-neutral-100/80 p-3 dark:bg-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Số xe bổ sung</span>
                    <span className="text-base font-bold tabular-nums text-brand dark:text-lime">
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
                  Chạy mô phỏng
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Cột phải: Kết quả gọn, tách rõ từng Hub vs Tổng 5 Hub */}
        <Card className="space-y-4 lg:col-span-8">
          <div data-tour="uc14-results" className="h-full space-y-4">
            {runOutcome?.status === "RUNNING" && runId ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                <Spinner />
                <p className="text-sm font-bold">Đang tính toán mô phỏng...</p>
                <Button variant="danger" onClick={() => void stopRun(runId)} loading={stoppingRun} className="text-xs">
                  Dừng
                </Button>
              </div>
            ) : runOutcome?.status === "COMPLETED" && runOutcome.result ? (
              <div className="space-y-4">
                {viewingHistoryItem && (
                  <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-1.5 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-200">
                    <span>
                      Lượt lưu lúc <strong>{new Date(viewingHistoryItem.createdAt).toLocaleString("vi-VN")}</strong>
                    </span>
                  </div>
                )}

                {/* Tiêu đề gọn */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">
                      {scenarioTitle(activeRunScenario?.scenarioType)}
                    </h2>
                    {activeRunScenario && (
                      <span className="rounded-lg bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
                        {summarizeAssumptions(
                          activeRunScenario.scenarioType,
                          activeRunScenario.assumptions,
                          hubNameById,
                        )}
                      </span>
                    )}
                  </div>
                  {runOutcome.result.saveStatus.saved ? (
                    <StatusBadge status="COMPLETED" label="Đã lưu" />
                  ) : (
                    runId && (
                      <Button variant="outline" onClick={() => void retrySaveRun(runId)} loading={retryingSave} className="px-2.5 py-1 text-xs">
                        Lưu lại
                      </Button>
                    )
                  )}
                </div>

                {/* 3 ô KPI Tổng toàn mạng (Trước -> Sau) */}
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <ComparisonCard
                    label={`Tổng xe thiếu (${totalHubsInRun} Hub)`}
                    unit="xe"
                    baseline={runOutcome.result.comparison.baseline.unavailableVehicles}
                    scenario={
                      impactResult
                        ? impactResult.afterAction.unavailableVehicles
                        : runOutcome.result.comparison.scenario.unavailableVehicles
                    }
                  />
                  <ComparisonCard
                    label="Chờ trung bình"
                    unit="phút"
                    baseline={runOutcome.result.comparison.baseline.waitingTimeMinutes}
                    scenario={
                      impactResult
                        ? impactResult.afterAction.waitingTimeMinutes
                        : runOutcome.result.comparison.scenario.waitingTimeMinutes
                    }
                  />
                  <ComparisonCard
                    label="Hub quá tải"
                    unit={`/${totalHubsInRun} Hub`}
                    baseline={runOutcome.result.comparison.baseline.overloadedHubCount}
                    scenario={
                      impactResult
                        ? impactResult.afterAction.overloadedHubCount
                        : runOutcome.result.comparison.scenario.overloadedHubCount
                    }
                  />
                </div>

                {/* Bảng nhỏ 5 dòng: Chi tiết từng Hub (trả lời ngay BK thiếu mấy xe, các Hub khác dư/thiếu mấy xe) */}
                {activeBreakdowns.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-neutral-200/80 dark:border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 text-[11px] font-semibold text-neutral-500 dark:bg-white/[0.03] dark:text-neutral-400">
                        <tr>
                          <th className="px-3 py-2">Chi tiết từng Hub</th>
                          <th className="px-3 py-2 text-center">Xe sẵn sàng</th>
                          <th className="px-3 py-2 text-center">Nhu cầu</th>
                          <th className="px-3 py-2 text-center">Chỗ trống</th>
                          <th className="px-3 py-2 text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {activeBreakdowns.map((b) => {
                          const availChanged = b.baselineAvailable !== b.scenarioAvailable;
                          const demandChanged = b.baselineDemand !== b.scenarioDemand;
                          const slotsChanged =
                            b.baselineFreeSlots !== undefined &&
                            b.scenarioFreeSlots !== undefined &&
                            b.baselineFreeSlots !== b.scenarioFreeSlots;
                          const nearFull = !b.closed && (b.scenarioFreeSlots ?? 10) <= 2;
                          return (
                            <tr
                              key={b.hubId}
                              className={
                                b.isTargetHub
                                  ? "bg-emerald-50/50 font-medium dark:bg-lime/5"
                                  : ""
                              }
                            >
                              <td className="px-3 py-2">
                                <span className="font-semibold">{b.hubName}</span>
                                {b.isTargetHub && (
                                  <span className="ml-1.5 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand dark:bg-lime/20 dark:text-lime">
                                    Kịch bản
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {availChanged ? (
                                  <span>
                                    <span className="text-neutral-400">{b.baselineAvailable} → </span>
                                    <strong>{b.scenarioAvailable}</strong> xe
                                  </span>
                                ) : (
                                  <span>{b.scenarioAvailable} xe</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {demandChanged ? (
                                  <span>
                                    <span className="text-neutral-400">{b.baselineDemand} → </span>
                                    <strong>{b.scenarioDemand}</strong> xe
                                  </span>
                                ) : (
                                  <span>{b.scenarioDemand} xe</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center tabular-nums">
                                {slotsChanged ? (
                                  <span>
                                    <span className="text-neutral-400">{b.baselineFreeSlots} → </span>
                                    <strong>{b.scenarioFreeSlots}</strong>
                                  </span>
                                ) : (
                                  <span>{b.scenarioFreeSlots ?? "—"}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {b.closed ? (
                                  <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-500/20 dark:text-red-300">
                                    Đóng cửa (Thiếu {b.scenarioDeficit} xe)
                                  </span>
                                ) : b.scenarioDeficit > 0 ? (
                                  <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                                    Thiếu {b.scenarioDeficit} xe
                                  </span>
                                ) : nearFull ? (
                                  <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                                    Đầy bãi (Dư {b.scenarioSurplus} xe)
                                  </span>
                                ) : b.scenarioSurplus > 0 ? (
                                  <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-lime">
                                    Dư {b.scenarioSurplus} xe
                                  </span>
                                ) : (
                                  <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                                    Đủ xe (0)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Các phương án điều phối độc lập: chia thành các ô riêng biệt, bỏ nhãn mã UC */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Các phương án điều phối độc lập
                    </h3>
                    <span className="text-[11px] text-neutral-400">
                      Chọn 1 phương án để thử nghiệm hoặc áp dụng
                    </span>
                  </div>

                  {(() => {
                    const hasRedirectOption = activeBreakdowns.some(
                      (b) => b.closed || (b.scenarioFreeSlots ?? 10) <= 2,
                    );
                    const recs = runOutcome.result.recommendations;
                    const totalOptions = (hasRedirectOption ? 1 : 0) + recs.length;

                    if (totalOptions === 0) {
                      return (
                        <p className="rounded-xl border border-dashed border-neutral-200 p-3 text-xs text-neutral-500 dark:border-white/10">
                          Hệ thống ổn định, không cần điều phối thêm.
                        </p>
                      );
                    }

                    const gridCols =
                      totalOptions >= 3
                        ? "md:grid-cols-3"
                        : totalOptions === 2
                          ? "md:grid-cols-2"
                          : "md:grid-cols-1";

                    return (
                      <div className={`grid gap-2.5 ${gridCols}`}>
                        {hasRedirectOption && (
                          <div className="flex flex-col justify-between gap-3 rounded-xl border border-sky-200/80 bg-sky-50/50 p-3.5 dark:border-sky-500/25 dark:bg-sky-500/10">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">
                                  Phương án 1
                                </span>
                                <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                                  Độc lập
                                </span>
                              </div>
                              <p className="text-xs font-bold text-neutral-900 dark:text-white">
                                Hướng người dùng sang Hub thay thế
                              </p>
                              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                                Chuyển khách từ{" "}
                                <strong>
                                  {activeBreakdowns.find((b) => b.closed || (b.scenarioFreeSlots ?? 10) <= 2)?.hubName}
                                </strong>{" "}
                                sang:{" "}
                                <strong>
                                  {[...activeBreakdowns]
                                    .filter((b) => !b.closed && b.scenarioDeficit === 0 && (b.scenarioFreeSlots ?? 10) > 2)
                                    .sort((a, b) => b.scenarioAvailable - a.scenarioAvailable)
                                    .slice(0, 2)
                                    .map((b) => `${b.hubName} (dư ${b.scenarioSurplus} xe)`)
                                    .join(", ")}
                                </strong>
                              </p>
                            </div>
                          </div>
                        )}

                        {recs.map((rec, idx) => {
                          const isSimulatingThis = activeRecId === rec.recommendationId;
                          const optionNum = (hasRedirectOption ? 2 : 1) + idx;
                          const isRedistribute = rec.targetUseCase === "UC12";
                          return (
                            <div
                              key={rec.recommendationId}
                              className={`flex flex-col justify-between gap-3 rounded-xl border p-3.5 transition ${isSimulatingThis
                                ? "border-brand bg-emerald-50/50 ring-1 ring-brand dark:border-lime dark:bg-lime/10 dark:ring-lime"
                                : "border-neutral-200/80 bg-neutral-50/60 dark:border-white/10 dark:bg-white/[0.02]"
                                }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-lime">
                                    Phương án {optionNum}
                                  </span>
                                  <span className="text-[11px] font-semibold text-neutral-400">
                                    Độc lập
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-neutral-900 dark:text-white">
                                  {isRedistribute ? "Điều chuyển phương tiện" : "Thay đổi lịch sạc"}
                                </p>
                                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                                  {rec.reason}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button
                                  variant={isSimulatingThis ? "primary" : "outline"}
                                  onClick={() => void openAndSimulateImpact(rec)}
                                  loading={impactLoading && isSimulatingThis}
                                  className="flex-1 px-2.5 py-1.5 text-xs"
                                >
                                  {isSimulatingThis ? "Đang thử nghiệm" : "Thử nghiệm"}
                                </Button>
                                <Button
                                  variant="primary"
                                  onClick={() => void requestOperationalHandoff(rec)}
                                  loading={handoffLoadingId === rec.recommendationId}
                                  className="flex-1 px-2.5 py-1.5 text-xs"
                                >
                                  {isRedistribute ? "Mở Điều chuyển →" : "Mở Lịch sạc →"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Khung Thử nghiệm giải pháp tối giản (Xóa bỏ hoàn toàn hộp chữ giải thích dài dòng) */}
                {activeRecId && impactResult && (
                  <div className="space-y-3 rounded-xl border border-brand/40 bg-emerald-50/20 p-3.5 dark:border-lime/30 dark:bg-lime/[0.03]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand dark:text-lime">
                        {activeActionType === "REDISTRIBUTE_VEHICLES"
                          ? "Thử nghiệm Điều chuyển xe (trên bản chụp)"
                          : "Thử nghiệm Ưu tiên sạc pin thấp (trên bản chụp)"}
                      </span>
                      <button
                        type="button"
                        onClick={clearImpact}
                        className="cursor-pointer rounded px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/10"
                      >
                        Đóng ✕
                      </button>
                    </div>

                    {activeActionType === "REDISTRIBUTE_VEHICLES" ? (
                      <div className="grid gap-2.5 sm:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Hub nguồn</label>
                          <select
                            value={impactSourceHubId}
                            onChange={(e) => setImpactSourceHubId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-xs font-medium dark:border-white/15 dark:bg-neutral-900"
                          >
                            {impactScopeHubs.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Hub đích</label>
                          <select
                            value={impactTargetHubId}
                            onChange={(e) => setImpactTargetHubId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-xs font-medium dark:border-white/15 dark:bg-neutral-900"
                          >
                            {impactScopeHubs.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Số xe chuyển</label>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={impactVehicleCount}
                            onChange={(e) => setImpactVehicleCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/15 dark:bg-neutral-900"
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
                            Tính lại
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Hub ưu tiên sạc</label>
                          <select
                            value={impactChargingHubId}
                            onChange={(e) => setImpactChargingHubId(e.target.value)}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-xs font-medium dark:border-white/15 dark:bg-neutral-900"
                          >
                            {impactScopeHubs.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold">Số xe sạc xong sớm</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={impactTurnaroundCount}
                            onChange={(e) => setImpactTurnaroundCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold dark:border-white/15 dark:bg-neutral-900"
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
                            Tính lại
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Hiển thị ngay kết quả Trước thử nghiệm -> Sau thử nghiệm ngay trong khung */}
                    <div className="grid gap-2 pt-1 sm:grid-cols-3">
                      <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-2 dark:border-white/10 dark:bg-neutral-900">
                        <span className="text-[11px] text-neutral-500">Xe thiếu (Sau thử nghiệm)</span>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          <span className="font-normal text-neutral-400">
                            {impactResult.beforeAction.unavailableVehicles} →{" "}
                          </span>
                          <span
                            className={
                              impactResult.afterAction.unavailableVehicles <
                                impactResult.beforeAction.unavailableVehicles
                                ? "text-emerald-700 dark:text-lime"
                                : ""
                            }
                          >
                            {impactResult.afterAction.unavailableVehicles} xe
                          </span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-2 dark:border-white/10 dark:bg-neutral-900">
                        <span className="text-[11px] text-neutral-500">Chờ TB (Sau thử nghiệm)</span>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          <span className="font-normal text-neutral-400">
                            {impactResult.beforeAction.waitingTimeMinutes} →{" "}
                          </span>
                          <span
                            className={
                              impactResult.afterAction.waitingTimeMinutes <
                                impactResult.beforeAction.waitingTimeMinutes
                                ? "text-emerald-700 dark:text-lime"
                                : ""
                            }
                          >
                            {impactResult.afterAction.waitingTimeMinutes} phút
                          </span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-neutral-200/80 bg-white px-3 py-2 dark:border-white/10 dark:bg-neutral-900">
                        <span className="text-[11px] text-neutral-500">Hub quá tải (Sau thử nghiệm)</span>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          <span className="font-normal text-neutral-400">
                            {impactResult.beforeAction.overloadedHubCount} →{" "}
                          </span>
                          <span
                            className={
                              impactResult.afterAction.overloadedHubCount <
                                impactResult.beforeAction.overloadedHubCount
                                ? "text-emerald-700 dark:text-lime"
                                : ""
                            }
                          >
                            {impactResult.afterAction.overloadedHubCount}/{totalHubsInRun} Hub
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Chỉ hiện cảnh báo 1 dòng ngắn nếu thao tác chọn Hub đóng cửa hoặc hết xe */}
                    {(impactResult.appliedParams.vehicleCount === 0 ||
                      impactResult.appliedParams.priorityTurnaroundVehicles === 0) &&
                      impactResult.unavailableKpis.length > 0 && (
                        <p className="rounded-lg bg-amber-100/80 px-3 py-1.5 text-xs font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                          {impactResult.unavailableKpis[impactResult.unavailableKpis.length - 1]}
                        </p>
                      )}
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
                    Xác nhận chạy
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                    <p className="text-xs text-neutral-500">Tổng xe thiếu</p>
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
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-6 text-center dark:border-white/10">
                <p className="text-sm font-semibold">Chọn kịch bản bên trái và bấm Chạy mô phỏng</p>
              </div>
            )}

            {runOutcome?.status === "FAILED" && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <strong>Lỗi:</strong> {runOutcome.failureReason}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Lịch sử mô phỏng gọn */}
      <Card className="space-y-2.5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Lịch sử mô phỏng ({history.data?.length ?? 0})
          </h2>
          <Button variant="ghost" onClick={() => void history.reload()} loading={history.loading} className="px-2.5 py-1 text-xs">
            Tải lại
          </Button>
        </div>

        <ErrorMessage error={history.error} onRetry={() => void history.reload()} />

        {!history.loading && (history.data?.length ?? 0) === 0 ? (
          <p className="py-3 text-center text-xs text-neutral-400">Chưa có lượt mô phỏng nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-neutral-200/80 text-[11px] text-neutral-500 dark:border-white/10">
                <tr>
                  <th className="px-2.5 py-2 font-semibold">Thời gian</th>
                  <th className="px-2.5 py-2 font-semibold">Kịch bản</th>
                  <th className="px-2.5 py-2 font-semibold">Kết quả (Trước → Sau)</th>
                  <th className="px-2.5 py-2 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                {(history.data ?? []).slice(0, 8).map((item) => {
                  const isActive = runId === item.runId;
                  return (
                    <tr
                      key={item.runId}
                      className={isActive ? "bg-brand/5 dark:bg-lime/10" : "hover:bg-neutral-50 dark:hover:bg-white/5"}
                    >
                      <td className="px-2.5 py-2 tabular-nums text-neutral-500">
                        {new Date(item.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-2.5 py-2">
                        <span className="font-semibold">{scenarioTitle(item.scenarioType)}</span>{" "}
                        <span className="text-neutral-500">
                          ({summarizeAssumptions(item.scenarioType, item.assumptions, hubNameById)})
                        </span>
                      </td>
                      <td className="px-2.5 py-2 tabular-nums">
                        {item.comparison ? (
                          <span>
                            Thiếu: {item.comparison.baseline.unavailableVehicles} →{" "}
                            <strong>{item.comparison.scenario.unavailableVehicles} xe</strong> · Quá tải:{" "}
                            <strong>{item.comparison.scenario.overloadedHubCount} Hub</strong>
                          </span>
                        ) : (
                          <StatusBadge status={item.status} />
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right">
                        <Button
                          variant={isActive ? "primary" : "outline"}
                          loading={loadingHistoryRunId === item.runId}
                          onClick={() => void openHistoryRun(item)}
                          className="px-2.5 py-1 text-xs"
                        >
                          {isActive ? "Đang xem" : "Xem"}
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

function ComparisonCard({
  label,
  unit,
  baseline,
  scenario,
}: {
  label: string;
  unit: string;
  baseline: number;
  scenario: number;
}) {
  const delta = Math.round((scenario - baseline) * 10) / 10;
  const isWorse = delta > 0;
  const isBetter = delta < 0;

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums text-neutral-400">
          {baseline} →
        </span>
        <span
          className={`text-2xl font-bold tabular-nums ${isWorse
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
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${isWorse
              ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-lime"
              }`}
          >
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
    </div>
  );
}
