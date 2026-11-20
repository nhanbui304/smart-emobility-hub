// Owner: Nguyễn Hoàng Nhân – UC14 Run What-if Simulation
// Giao diện SimulationView khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC14.drawio)
// và Mockup Hình 1.8 (BTL2 trang 7):
// - selectScope(hubIds, timeRange) -> simulationApi.prepareSimulation
// - acceptStaleSnapshot / rejectStaleSnapshot (Ext 2b)
// - configureScenario(scenarioType, assumptions) -> simulationApi.submitScenario
// - confirmRunSimulation / cancelSimulation -> simulationApi.runSimulation
// - stopRun(runId) (Ext 7b), getRunResult(runId), retrySaveRun(runId) (Ext 9a)
// - requestOperationalHandoff(recommendationId) -> chuyển sang UC12 / UC13 (Ext 9b)
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { newRequestId } from "../../api/requestId";
import { simulationApi } from "../../api/simulation";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
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

const SCENARIO_CATALOG: {
  type: ScenarioType;
  title: string;
  subtitle: string;
}[] = [
  {
    type: "DEMAND_SURGE",
    title: "Sinh viên tăng đột biến",
    subtitle: "Mô phỏng nhu cầu mượn xe tăng gấp 1.2x – 5.0x vào khung giờ cao điểm.",
  },
  {
    type: "HUB_CLOSURE",
    title: "Một Hub tạm đóng cửa",
    subtitle: "Mô phỏng một Hub ngừng tiếp nhận, nhu cầu dồn sang các Hub lân cận.",
  },
  {
    type: "ADD_CHARGERS",
    title: "Bổ sung cổng sạc tại Hub",
    subtitle: "Đánh giá mức giảm thời gian chờ sạc khi lắp thêm cổng sạc mới.",
  },
  {
    type: "ADD_VEHICLES",
    title: "Bổ sung xe dùng chung",
    subtitle: "Đánh giá khả năng giảm thiếu xe khi điều thêm phương tiện về Hub.",
  },
];

function getDefaultTimeRange(): { startLocal: string; endLocal: string } {
  const now = new Date();
  const start = new Date(now.getTime() + 10 * 60_000);
  const end = new Date(now.getTime() + 130 * 60_000);
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return { startLocal: toLocalInput(start), endLocal: toLocalInput(end) };
}

export function SimulationPage() {
  const navigate = useNavigate();
  const { data: hubs, loading: hubsLoading } = useAsync(() => hubApi.list(), []);

  const [selectedHubIds, setSelectedHubIds] = useState<string[]>([]);
  const [{ startLocal, endLocal }, setTimeInput] = useState(getDefaultTimeRange);

  // Bước 1–2: Bản chụp dữ liệu (Snapshot)
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [staleAccepted, setStaleAccepted] = useState<boolean>(false);
  const [snapshotLoading, setSnapshotLoading] = useState<boolean>(false);

  // Bước 3–5: Cấu hình kịch bản & Xem trước
  const [scenarioType, setScenarioType] = useState<ScenarioType>("DEMAND_SURGE");
  const [targetHubId, setTargetHubId] = useState<string>("");
  const [demandMultiplier, setDemandMultiplier] = useState<number>(1.8);
  const [additionalChargers, setAdditionalChargers] = useState<number>(2);
  const [additionalVehicles, setAdditionalVehicles] = useState<number>(5);

  const [preview, setPreview] = useState<SimulationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Bước 6–9: Chạy mô phỏng & Kết quả
  const [runId, setRunId] = useState<string | null>(null);
  const [runOutcome, setRunOutcome] = useState<RunOutcome | null>(null);
  const [startingRun, setStartingRun] = useState<boolean>(false);
  const [stoppingRun, setStoppingRun] = useState<boolean>(false);
  const [retryingSave, setRetryingSave] = useState<boolean>(false);
  const [handoffLoadingId, setHandoffLoadingId] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState(newRequestId);

  const [error, setError] = useState<unknown>(null);

  // Mặc định chọn tất cả Hub khi mới tải danh sách
  useEffect(() => {
    if (hubs && hubs.length > 0 && selectedHubIds.length === 0) {
      setSelectedHubIds(hubs.map((h) => h.id));
      setTargetHubId(hubs[0]!.id);
    }
  }, [hubs, selectedHubIds.length]);

  // UC14 bước 7–8: Tự động kiểm tra trạng thái lần chạy khi đang RUNNING
  useEffect(() => {
    if (!runId) return;
    if (runOutcome && runOutcome.status !== "RUNNING") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const outcome = await simulationApi.getRunResult(runId);
        if (!cancelled) {
          setRunOutcome(outcome);
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

  // SimulationView.selectScope (UC14 bước 1–2)
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
      if (selectedHubIds.length > 0 && !selectedHubIds.includes(targetHubId)) {
        setTargetHubId(selectedHubIds[0]!);
      }
    } catch (err) {
      setError(err);
    } finally {
      setSnapshotLoading(false);
    }
  };

  // SimulationView.acceptStaleSnapshot (UC14 Ext 2b)
  const acceptStaleSnapshot = async (snapshotId: string) => {
    setError(null);
    try {
      await simulationApi.acceptStaleSnapshot(snapshotId);
      setStaleAccepted(true);
    } catch (err) {
      setError(err);
    }
  };

  // SimulationView.rejectStaleSnapshot (UC14 Ext 2b)
  const rejectStaleSnapshot = () => {
    setSnapshot(null);
    setStaleAccepted(false);
    setPreview(null);
    setRunId(null);
    setRunOutcome(null);
  };

  // SimulationView.configureScenario (UC14 bước 3–5)
  const configureScenario = async () => {
    if (!snapshot) return;
    setError(null);
    setPreviewLoading(true);
    try {
      const assumptions: ScenarioAssumptions = {
        hubId: targetHubId || undefined,
      };
      if (scenarioType === "DEMAND_SURGE") {
        assumptions.demandMultiplier = Number(demandMultiplier);
      } else if (scenarioType === "ADD_CHARGERS") {
        assumptions.additionalChargers = Number(additionalChargers);
      } else if (scenarioType === "ADD_VEHICLES") {
        assumptions.additionalVehicles = Number(additionalVehicles);
      }

      const simPreview = await simulationApi.submitScenario(
        snapshot.snapshotId,
        scenarioType,
        assumptions,
      );
      setPreview(simPreview);
      setRunId(null);
      setRunOutcome(null);
      setPendingRequestId(newRequestId());
    } catch (err) {
      setError(err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // SimulationView.cancelSimulation (UC14 Ext 6a)
  const cancelSimulation = () => {
    setPreview(null);
    setRunId(null);
    setRunOutcome(null);
    setError(null);
  };

  // SimulationView.confirmRunSimulation (UC14 bước 6–7)
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

  // SimulationView.stopRun (UC14 Ext 7b)
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

  // SimulationView.retrySaveRun (UC14 Ext 9a)
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

  // SimulationView.requestOperationalHandoff (UC14 Ext 9b)
  const requestOperationalHandoff = async (rec: Recommendation) => {
    setError(null);
    setHandoffLoadingId(rec.recommendationId);
    try {
      const workflow = await simulationApi.prepareOperationalHandoff(rec.recommendationId);
      if (workflow.targetUseCase === "UC12") {
        navigate("/operator/redistribution");
      } else {
        navigate("/operator/charging-incidents");
      }
    } catch (err) {
      setError(err);
    } finally {
      setHandoffLoadingId(null);
    }
  };

  const scopedHubs = (hubs ?? []).filter((h) => selectedHubIds.includes(h.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mô phỏng tình huống What-if"
        subtitle="Chạy trên bản sao trạng thái, tách biệt hoàn toàn và không làm thay đổi dữ liệu vận hành thực tế"
      />

      {/* Bước 1–2: Chọn phạm vi Hub, khoảng thời gian và tạo bản chụp dữ liệu */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">
              Phạm vi Mobility Hub &amp; Bản chụp dữ liệu
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Hệ thống chỉ đọc trạng thái hiện tại để lưu thành một bản chụp độc lập phục vụ đối chiếu.
            </p>
          </div>
          {hubs && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedHubIds(hubs.map((h) => h.id))}
                className="text-xs font-medium text-brand underline dark:text-lime"
              >
                Chọn tất cả ({hubs.length} Hub)
              </button>
              <button
                type="button"
                onClick={() => setSelectedHubIds([])}
                className="text-xs font-medium text-neutral-500 underline"
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
                <label
                  key={h.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                    checked
                      ? "border-brand bg-brand/10 text-brand dark:border-lime dark:bg-lime/15 dark:text-lime"
                      : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleHubSelection(h.id)}
                    className="rounded"
                  />
                  <span>
                    {h.name} ({h.availableVehicles} xe · {h.totalChargingPorts} cổng sạc)
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Bắt đầu khung giờ đánh giá
            </label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setTimeInput((prev) => ({ ...prev, startLocal: e.target.value }))}
              className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Kết thúc khung giờ đánh giá
            </label>
            <input
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setTimeInput((prev) => ({ ...prev, endLocal: e.target.value }))}
              className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/15"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            onClick={() => void selectScope()}
            loading={snapshotLoading}
            disabled={selectedHubIds.length === 0}
          >
            Tạo bản chụp dữ liệu
          </Button>
          {snapshot && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Chụp lúc {new Date(snapshot.capturedAt).toLocaleTimeString("vi-VN")} · Độ đầy đủ:{" "}
              <strong>{Math.round(snapshot.completeness * 100)}%</strong>
            </span>
          )}
        </div>

        {/* UC14 Ext 2b: Cảnh báo bản chụp chứa dữ liệu cũ -> hỏi Operator chấp nhận hoặc từ chối */}
        {snapshot && snapshot.isStale && !staleAccepted && (
          <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="font-semibold">
              Cảnh báo: Một số Hub trong bản chụp có dữ liệu cũ hơn 30 giây
            </p>
            <p className="mt-1 text-xs">
              Dữ liệu vẫn có thể dùng để mô phỏng tham khảo nhưng sẽ được ghi rõ giới hạn trong kết quả. Bạn có chấp nhận tiếp tục với bản chụp này không?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => void acceptStaleSnapshot(snapshot.snapshotId)}
              >
                Chấp nhận &amp; Tiếp tục
              </Button>
              <Button variant="outline" onClick={rejectStaleSnapshot}>
                Từ chối &amp; Chọn phạm vi khác
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ErrorMessage error={error} onRetry={() => void selectScope()} />

      {/* Bước 3–5: Chọn kịch bản giả định và xem trước phương án so sánh */}
      {snapshot && staleAccepted && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Cột trái: Danh sách kịch bản giả định (Giống Mockup Hình 1.8 BTL2) */}
          <Card className="space-y-4 lg:col-span-5">
            <div>
              <h2 className="text-base font-bold">Cấu hình kịch bản giả định</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Chọn loại tình huống và nhập tham số thay đổi giả định.
              </p>
            </div>

            <div className="space-y-2.5">
              {SCENARIO_CATALOG.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    setScenarioType(item.type);
                    setPreview(null);
                  }}
                  className={`w-full rounded-xl border p-3.5 text-left transition ${
                    scenarioType === item.type
                      ? "border-brand bg-brand/10 dark:border-lime dark:bg-lime/10"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {item.subtitle}
                  </p>
                </button>
              ))}
            </div>

            {/* Tham số giả định theo loại kịch bản */}
            <div className="space-y-3 border-t border-neutral-200 pt-3 dark:border-white/10">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Hub áp dụng thay đổi giả định
                </label>
                <select
                  value={targetHubId}
                  onChange={(e) => setTargetHubId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {scopedHubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} (Hiện có {h.availableVehicles} xe · {h.totalChargingPorts} cổng sạc)
                    </option>
                  ))}
                </select>
              </div>

              {scenarioType === "DEMAND_SURGE" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Hệ số nhân nhu cầu (từ 1.2 đến 5.0 lần)
                  </label>
                  <input
                    type="number"
                    step="0.2"
                    min="0.5"
                    max="10"
                    value={demandMultiplier}
                    onChange={(e) => setDemandMultiplier(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm font-semibold outline-none focus:border-brand dark:border-white/15"
                  />
                </div>
              )}

              {scenarioType === "ADD_CHARGERS" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Số cổng sạc giả định lắp thêm (tối đa +20)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="30"
                    value={additionalChargers}
                    onChange={(e) => setAdditionalChargers(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm font-semibold outline-none focus:border-brand dark:border-white/15"
                  />
                </div>
              )}

              {scenarioType === "ADD_VEHICLES" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Số xe dùng chung giả định bổ sung (tối đa +50)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={additionalVehicles}
                    onChange={(e) => setAdditionalVehicles(parseInt(e.target.value, 10) || 0)}
                    className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm font-semibold outline-none focus:border-brand dark:border-white/15"
                  />
                </div>
              )}

              <Button
                variant="outline"
                fullWidth
                onClick={() => void configureScenario()}
                loading={previewLoading}
              >
                Xem trước phương án
              </Button>
            </div>
          </Card>

          {/* Cột phải: Xem trước (Bước 5), Chạy mô phỏng (Bước 6–7) và Kết quả & Khuyến nghị (Bước 8–9) */}
          <Card className="space-y-5 lg:col-span-7">
            {!preview ? (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                <p className="font-semibold">Chưa cấu hình kịch bản xem trước</p>
                <p className="mt-1 max-w-md text-xs">
                  Chọn một kịch bản ở cột bên trái và bấm &ldquo;Xem trước phương án&rdquo; để chuẩn bị chạy mô phỏng.
                </p>
              </div>
            ) : (
              <>
                {/* Bước 5–6: Bản xem trước Phương án cơ sở vs Kịch bản */}
                <div className="space-y-3 border-b border-neutral-200 pb-4 dark:border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold">
                        Phương án cơ sở &amp; Kịch bản giả định
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Kịch bản:{" "}
                        <strong>
                          {SCENARIO_CATALOG.find((s) => s.type === preview.scenario.scenarioType)?.title ??
                            preview.scenario.scenarioType}
                        </strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        onClick={() => void confirmRunSimulation(preview.scenarioDraftId)}
                        loading={startingRun}
                        disabled={runOutcome?.status === "RUNNING"}
                      >
                        Chạy mô phỏng
                      </Button>
                      <Button variant="ghost" onClick={cancelSimulation}>
                        Hủy
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-neutral-100/80 p-3 text-xs dark:bg-white/5">
                    <p className="font-semibold">Chỉ số Phương án cơ sở (Baseline) trên bản chụp:</p>
                    <p className="mt-1 text-neutral-600 dark:text-neutral-300">
                      • Xe thiếu hụt: <strong>{preview.baseline.unavailableVehicles} xe</strong> · Thời gian chờ TB:{" "}
                      <strong>{preview.baseline.waitingTimeMinutes} phút</strong> · Số Hub quá tải:{" "}
                      <strong>{preview.baseline.overloadedHubCount} Hub</strong>
                    </p>
                    <p className="mt-1.5 text-neutral-500">
                      Các chỉ số KPI so sánh: {preview.kpis.join(" · ")}
                    </p>
                  </div>
                </div>

                {/* Bước 7: Trạng thái đang chạy / bị hủy / gặp lỗi */}
                {runOutcome?.status === "RUNNING" && runId && (
                  <div className="flex items-center justify-between rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                    <div className="flex items-center gap-3">
                      <Spinner />
                      <div>
                        <p className="font-semibold">Đang chạy mô phỏng trên bản chụp...</p>
                        <p className="text-xs opacity-80">Mã lần chạy: {runId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => void stopRun(runId)}
                      loading={stoppingRun}
                    >
                      Dừng mô phỏng
                    </Button>
                  </div>
                )}

                {runOutcome?.status === "CANCELLED" && (
                  <div className="rounded-xl border border-neutral-300 bg-neutral-100 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                    <p className="font-semibold">Đã dừng lần chạy mô phỏng theo yêu cầu.</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Dữ liệu vận hành thực tế hoàn toàn không bị thay đổi.
                    </p>
                  </div>
                )}

                {runOutcome?.status === "FAILED" && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    <p className="font-semibold">Mô phỏng gặp lỗi</p>
                    <p className="mt-1 text-xs">{runOutcome.failureReason}</p>
                  </div>
                )}

                {/* Bước 8–9: Kết quả so sánh Phương án cơ sở vs Kịch bản & Khuyến nghị điều phối */}
                {runOutcome?.status === "COMPLETED" && runOutcome.result && (
                  <div className="space-y-5">
                    {/* 3 thẻ KPI so sánh trực quan (Giống Mockup Hình 1.8 BTL2) */}
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

                    {/* UC14 Ext 8a: Nếu kết quả kịch bản cho thấy thiếu xe / quá tải / chờ lâu */}
                    {(runOutcome.result.comparison.scenario.unavailableVehicles > 0 ||
                      runOutcome.result.comparison.scenario.overloadedHubCount > 0) && (
                      <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                        <strong>Ghi chú:</strong> Tình trạng thiếu xe hoặc Hub quá tải là kết quả dự kiến của kịch bản giả định. Bạn có thể điều chỉnh giả định hoặc xem khuyến nghị điều phối bên dưới.
                      </div>
                    )}

                    {/* Danh sách khuyến nghị điều phối (Bước 8 & Ext 8b, 9b) */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold">
                        Đề xuất phương án điều phối
                      </h3>
                      {runOutcome.result.recommendations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-white/10">
                          Chưa xác định được khuyến nghị khả thi cho kịch bản này. Vui lòng điều chỉnh tham số kịch bản.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {runOutcome.result.recommendations.map((rec) => (
                            <div
                              key={rec.recommendationId}
                              className="space-y-2.5 rounded-xl border border-neutral-200/90 p-4 dark:border-white/10"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-bold uppercase tracking-wide text-brand dark:text-lime">
                                  {rec.targetUseCase === "UC12"
                                    ? "Đề xuất điều chuyển xe"
                                    : "Đề xuất lập kế hoạch sạc thông minh"}
                                </span>
                                <Button
                                  variant="primary"
                                  onClick={() => void requestOperationalHandoff(rec)}
                                  loading={handoffLoadingId === rec.recommendationId}
                                >
                                  Áp dụng phương án vào vận hành
                                </Button>
                              </div>
                              <p className="text-xs text-neutral-700 dark:text-neutral-200">
                                {rec.reason}
                              </p>
                              {rec.constraints.length > 0 && (
                                <ul className="list-inside list-disc space-y-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                                  {rec.constraints.map((c, idx) => (
                                    <li key={idx}>{c}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Ràng buộc & Trạng thái lưu lần chạy (Bước 9 & Ext 9a) */}
                    <div className="rounded-xl bg-neutral-100/80 p-3.5 text-xs dark:bg-white/5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          Giới hạn áp dụng &amp; Trạng thái lưu kết quả:
                        </span>
                        {runOutcome.result.saveStatus.saved ? (
                          <StatusBadge status="COMPLETED" label="Đã lưu lần chạy để đối chiếu" />
                        ) : (
                          <div className="flex items-center gap-2">
                            <StatusBadge status="FAILED" label="Chưa lưu được kết quả" />
                            {runId && (
                              <Button
                                variant="outline"
                                onClick={() => void retrySaveRun(runId)}
                                loading={retryingSave}
                              >
                                Thử lưu lại
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-neutral-500 dark:text-neutral-400">
                        {runOutcome.result.constraints.map((c, idx) => (
                          <li key={idx}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}
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
    <div className="rounded-xl border border-neutral-200/80 p-4 dark:border-white/10">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold ${
            isWorse
              ? "text-amber-600 dark:text-amber-400"
              : isBetter
                ? "text-emerald-600 dark:text-lime"
                : ""
          }`}
        >
          {scenario} {unit}
        </span>
        <span className="text-xs text-neutral-500">
          ({delta > 0 ? `+${delta}` : delta} so với {baseline} {unit})
        </span>
      </div>

      {/* Thanh biểu đồ so sánh trực quan Baseline vs Kịch bản */}
      <div className="mt-3 space-y-1.5 text-xs">
        <div>
          <div className="flex justify-between text-neutral-500">
            <span>Cơ sở (Baseline)</span>
            <span>
              {baseline} {unit}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-neutral-500"
              style={{ width: `${Math.min(100, (baseline / maxVal) * 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between font-medium">
            <span>Kịch bản</span>
            <span>
              {scenario} {unit}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
            <div
              className={`h-full rounded-full ${
                isWorse ? "bg-amber-500" : "bg-brand dark:bg-lime"
              }`}
              style={{ width: `${Math.min(100, (scenario / maxVal) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
