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
  Recommendation,
  RunOutcome,
  ScenarioAssumptions,
  ScenarioType,
  SimulationPreview,
  SnapshotInfo,
  TimeRange,
} from "../../types";

const SCENARIO_CATALOG: { type: ScenarioType; title: string; sub: string }[] = [
  { type: "DEMAND_SURGE", title: "Tăng nhu cầu", sub: "Cao điểm 1.2x – 5.0x" },
  { type: "HUB_CLOSURE", title: "Đóng 1 Hub", sub: "Dồn nhu cầu sang Hub gần" },
  { type: "ADD_CHARGERS", title: "Thêm cổng sạc", sub: "Giảm thời gian chờ sạc" },
  { type: "ADD_VEHICLES", title: "Thêm xe điện", sub: "Giảm thiếu hụt xe" },
];

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
  const [startingRun, setStartingRun] = useState<boolean>(false);
  const [stoppingRun, setStoppingRun] = useState<boolean>(false);
  const [retryingSave, setRetryingSave] = useState<boolean>(false);
  const [handoffLoadingId, setHandoffLoadingId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState(newRequestId);
  const [error, setError] = useState<unknown>(null);

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
        if (!cancelled) setRunOutcome(outcome);
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
  }, [runId, runOutcome]);

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

  // Chạy nhanh 1 chạm: tự tạo snapshot (nếu chưa có) + tạo preview + chạy mô phỏng
  const runQuickSimulation = async () => {
    setError(null);
    setStartingRun(true);
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
    } catch (err) {
      setError(err);
    } finally {
      setRetryingSave(false);
    }
  };

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
        <StepBadge num={3} label="So sánh KPI & Đề xuất" state={step3Done ? "done" : "idle"} />
      </Card>

      {/* Bước 1: Phạm vi & Bản chụp (tự thu gọn khi đã chụp xong) */}
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

      {/* Bố cục 2 cột luôn hiển thị để nhìn phát hiểu cách dùng */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Cột trái: 2x2 Thẻ Kịch bản + Slider */}
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

            {/* Slider trực quan cho từng kịch bản */}
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
          </div>

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
        </Card>

        {/* Cột phải: Kết quả so sánh trực quan */}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold">
                  So sánh: Hiện tại vs{" "}
                  {SCENARIO_CATALOG.find((s) => s.type === preview?.scenario.scenarioType)?.title ?? "Kịch bản"}
                </h2>
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

              {/* Đề xuất hành động 1 chạm */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold">Đề xuất hành động</h3>
                {runOutcome.result.recommendations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-neutral-200 p-4 text-xs text-neutral-500 dark:border-white/10">
                    Không có khuyến nghị cần điều chỉnh cho kịch bản này.
                  </p>
                ) : (
                  runOutcome.result.recommendations.map((rec) => (
                    <div
                      key={rec.recommendationId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-neutral-50/70 p-4 dark:border-lime/25 dark:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-lime">
                          {rec.targetUseCase === "UC12" ? "Điều chuyển xe (UC12)" : "Lịch sạc thông minh (UC13)"}
                        </span>
                        <p className="text-xs font-medium text-neutral-800 dark:text-neutral-100">{rec.reason}</p>
                      </div>
                      <Button
                        variant="primary"
                        onClick={() => void requestOperationalHandoff(rec)}
                        loading={handoffLoadingId === rec.recommendationId}
                        className="shrink-0 text-xs"
                      >
                        Áp dụng →
                      </Button>
                    </div>
                  ))
                )}
              </div>
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
                Chọn 1 trong 4 kịch bản bên trái, kéo thanh tham số và bấm <strong>Chạy mô phỏng ngay</strong> để so sánh KPI.
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
}: {
  label: string;
  unit: string;
  baseline: number;
  scenario: number;
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
        Hiện tại: {baseline} {unit}
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
