// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
import { useEffect, useMemo, useState } from "react";
import { HANDOFF_UC13_KEY } from "./SimulationPage";
import { chargingScheduleApi } from "../../api/chargingSchedule";
import { ApiError } from "../../api/client";
import { hubApi } from "../../api/hubs";
import { incidentApi } from "../../api/incident";
import { newRequestId } from "../../api/requestId";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type {
  ChargingContext,
  ChargingScheduleVersion,
  PlanAdjustment,
  PlanAllocation,
  PlanDraft,
  ScheduleResult,
  TimeRange,
  ValidatedPlan,
} from "../../types";

const PRIORITY_RULES = [
  { id: "LOW_BATTERY_FIRST", label: "Pin thấp trước (< 25%)", sub: "Ưu tiên xe gần cạn pin" },
  { id: "SOONEST_USE_FIRST", label: "Đến trước sạc trước (FIFO)", sub: "Theo thứ tự gửi yêu cầu" },
  { id: "MAX_NEED_FIRST", label: "Thiếu pin nhiều nhất", sub: "Ưu tiên xe cần nạp nhiều %" },
] as const;

type TimePreset = "2H" | "PEAK" | "CUSTOM";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getPresetRange(preset: Exclude<TimePreset, "CUSTOM">): { startLocal: string; endLocal: string } {
  const now = new Date();
  if (preset === "PEAK") {
    const start = new Date(now);
    start.setHours(17, 0, 0, 0);
    if (start.getTime() <= now.getTime()) start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 120 * 60_000);
    return { startLocal: toLocalInput(start), endLocal: toLocalInput(end) };
  }
  const start = new Date(now.getTime() + 5 * 60_000);
  const end = new Date(now.getTime() + 125 * 60_000);
  return { startLocal: toLocalInput(start), endLocal: toLocalInput(end) };
}

function formatDemandLabel(demandId: string | undefined, idx: number): { title: string; subtitle?: string } {
  if (!demandId) {
    return {
      title: `Phiên đang sạc / Lịch đã đặt #${idx + 1}`,
      subtitle: "Giữ nguyên cam kết hiện có",
    };
  }
  if (demandId.startsWith("demand-")) {
    const vehicleCode = demandId.slice("demand-".length);
    return {
      title: `Xe dùng chung ${vehicleCode}`,
      subtitle: "Đề xuất sạc bổ sung",
    };
  }
  return {
    title: `Yêu cầu sạc ngay #${demandId.slice(0, 6)}`,
    subtitle: "Hàng đợi sinh viên (UC07)",
  };
}

function formatWaitingItem(demandId: string): string {
  if (demandId.startsWith("demand-")) return `Xe ${demandId.slice("demand-".length)}`;
  return `Yêu cầu #${demandId.slice(0, 6)}`;
}

function formatPortLabel(rawLabel: string | undefined, fallbackId: string, idx: number): string {
  if (!rawLabel) return `Cổng sạc #${idx + 1} (${fallbackId.slice(0, 6)})`;
  return rawLabel
    .replace("STANDARD_PLUG", "AC thường")
    .replace("TYPE_2", "Type 2");
}

function parsePortMaxKw(rawLabel: string | undefined): number | null {
  if (!rawLabel) return null;
  const match = rawLabel.match(/([\d.]+)\s*kW/i);
  if (!match) return null;
  const val = Number(match[1]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

function formatAppliedTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatScheduleWindow(startLocal: string, endLocal: string): string {
  const start = new Date(startLocal);
  const end = new Date(endLocal);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const timeFmt = (d: Date) =>
    d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const dateFmt = (d: Date) =>
    d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  return sameDay
    ? `${timeFmt(start)} – ${timeFmt(end)} · ${dateFmt(start)}`
    : `${timeFmt(start)} ${dateFmt(start)} – ${timeFmt(end)} ${dateFmt(end)}`;
}

export function SmartChargingPanel() {
  const { data: hubs, loading: hubsLoading } = useAsync(() => hubApi.list(), []);
  const { data: resourceOverview } = useAsync(() => incidentApi.listOverview(), []);
  const { portLabelById, portMaxKwById } = useMemo(() => {
    const labels = new Map<string, string>();
    const maxKw = new Map<string, number>();
    for (const r of resourceOverview?.resources ?? []) {
      if (r.resourceType === "CHARGING_PORT") {
        labels.set(r.id, r.label);
        const parsed = parsePortMaxKw(r.label);
        if (parsed !== null) maxKw.set(r.id, parsed);
      }
    }
    return { portLabelById: labels, portMaxKwById: maxKw };
  }, [resourceOverview]);
  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const [latestSchedule, setLatestSchedule] = useState<ChargingScheduleVersion | null>(null);
  const [latestLoading, setLatestLoading] = useState<boolean>(false);
  const [timePreset, setTimePreset] = useState<TimePreset>("2H");
  const [{ startLocal, endLocal }, setTimeInput] = useState(() => getPresetRange("2H"));
  const [ruleId, setRuleId] = useState<string>("LOW_BATTERY_FIRST");

  const [context, setContext] = useState<ChargingContext | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [editableAllocations, setEditableAllocations] = useState<PlanAllocation[]>([]);
  const [proposalLoading, setProposalLoading] = useState<boolean>(false);

  const [validatedPlan, setValidatedPlan] = useState<ValidatedPlan | null>(null);
  const [validating, setValidating] = useState<boolean>(false);

  const [appliedResult, setAppliedResult] = useState<ScheduleResult | null>(null);
  const [applying, setApplying] = useState<boolean>(false);
  const [pendingRequestId, setPendingRequestId] = useState(newRequestId);

  const [error, setError] = useState<unknown>(null);
  const [versionConflictNotice, setVersionConflictNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hubs || hubs.length === 0) return;
    try {
      const raw = sessionStorage.getItem(HANDOFF_UC13_KEY);
      if (raw) {
        sessionStorage.removeItem(HANDOFF_UC13_KEY);
        const parsed = JSON.parse(raw) as { hubId?: string; ruleId?: string };
        const matched = parsed.hubId ? hubs.find((h) => h.id === parsed.hubId) : undefined;
        const targetId = matched?.id ?? hubs[0]!.id;
        setSelectedHubId(targetId);
        if (parsed.ruleId) setRuleId(parsed.ruleId);
        return;
      }
    } catch {
      // ignore
    }
    if (!selectedHubId) {
      setSelectedHubId(hubs[0]!.id);
    }
  }, [hubs, selectedHubId]);

  useEffect(() => {
    if (!selectedHubId) {
      setLatestSchedule(null);
      return;
    }
    let active = true;
    setLatestLoading(true);
    void chargingScheduleApi
      .getLatestSchedule(selectedHubId)
      .then((res) => {
        if (active) setLatestSchedule(res);
      })
      .catch(() => {
        if (active) setLatestSchedule(null);
      })
      .finally(() => {
        if (active) setLatestLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedHubId]);

  const buildTimeRange = (): TimeRange => ({
    startTime: new Date(startLocal).toISOString(),
    endTime: new Date(endLocal).toISOString(),
  });

  const applyPreset = (preset: TimePreset) => {
    setTimePreset(preset);
    if (preset !== "CUSTOM") {
      setTimeInput(getPresetRange(preset));
    }
  };

  // Gộp tải bối cảnh + sinh đề xuất trong 1 cú bấm cho gọn
  const selectPriorityRule = async (chosenRuleId?: string) => {
    const activeRule = chosenRuleId ?? ruleId;
    if (!selectedHubId) return;

    setError(null);
    setVersionConflictNotice(null);
    setProposalLoading(true);
    try {
      const tr = buildTimeRange();
      const ctx = await chargingScheduleApi.loadChargingContext(selectedHubId, tr);
      setContext(ctx);
      const proposed = await chargingScheduleApi.generateProposedSchedule(selectedHubId, tr, activeRule);
      setDraft(proposed);
      setEditableAllocations(proposed.proposedAllocations.map((a) => ({ ...a })));
      setValidatedPlan(null);
      setAppliedResult(null);
      setPendingRequestId(newRequestId());
    } catch (err) {
      setError(err);
    } finally {
      setProposalLoading(false);
    }
  };

  const adjustPlan = (index: number, newPowerKw: number) => {
    setEditableAllocations((prev) =>
      prev.map((item, i) => (i === index ? { ...item, allocatedPowerKw: newPowerKw } : item)),
    );
    setValidatedPlan(null);
  };

  const requestPlanValidation = async () => {
    if (!draft) return;
    setError(null);
    setValidating(true);
    try {
      const adjustments: PlanAdjustment[] = editableAllocations.map((alloc) => ({
        demandId: alloc.demandId,
        portId: alloc.portId,
        positionId: alloc.positionId,
        timeRange: alloc.timeRange,
        allocatedPowerKw: Number(alloc.allocatedPowerKw),
      }));
      const validated = await chargingScheduleApi.validatePlan(draft.planDraftId, adjustments);
      setValidatedPlan(validated);
      setPendingRequestId(newRequestId());
    } catch (err) {
      setValidatedPlan(null);
      setError(err);
    } finally {
      setValidating(false);
    }
  };

  const confirmSchedule = async () => {
    if (!draft || !validatedPlan) return;
    setError(null);
    setApplying(true);
    try {
      const result = await chargingScheduleApi.applyChargingSchedule(
        pendingRequestId,
        draft.planDraftId,
        validatedPlan.baseVersion,
      );
      setAppliedResult(result);
      if (selectedHubId) {
        const refreshed = await chargingScheduleApi.getLatestSchedule(selectedHubId).catch(() => null);
        if (refreshed) setLatestSchedule(refreshed);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        setVersionConflictNotice(err.message);
      } else {
        setError(err);
      }
    } finally {
      setApplying(false);
    }
  };

  const cancelApply = () => {
    setDraft(null);
    setEditableAllocations([]);
    setValidatedPlan(null);
    setAppliedResult(null);
    setError(null);
  };

  const committedAllocations = editableAllocations.filter((a) => !a.demandId);
  const newAllocations = editableAllocations.filter((a) => Boolean(a.demandId));
  const committedKw = committedAllocations.reduce((sum, a) => sum + (Number(a.allocatedPowerKw) || 0), 0);
  const newKw = newAllocations.reduce((sum, a) => sum + (Number(a.allocatedPowerKw) || 0), 0);
  const totalProposedKw = committedKw + newKw;
  const maxPowerKw = context?.hubPowerCapacityKw ?? 0;
  const powerPct = maxPowerKw > 0 ? Math.min(100, Math.round((totalProposedKw / maxPowerKw) * 100)) : 0;
  const committedPct = maxPowerKw > 0 ? Math.min(100, (committedKw / maxPowerKw) * 100) : 0;
  const newPct = maxPowerKw > 0 ? Math.min(Math.max(0, 100 - committedPct), (newKw / maxPowerKw) * 100) : 0;
  const isOverPower = maxPowerKw > 0 && totalProposedKw > maxPowerKw;

  const selectedHub = useMemo(
    () => (hubs ?? []).find((h) => h.id === selectedHubId) ?? null,
    [hubs, selectedHubId],
  );
  const selectedHubInUsePorts = selectedHub
    ? (selectedHub.inUseChargingPorts ?? Math.max(0, selectedHub.totalChargingPorts - selectedHub.freeChargingPorts))
    : 0;
  const selectedHubFaultyPorts = selectedHub
    ? Math.max(0, selectedHub.totalChargingPorts - selectedHub.freeChargingPorts - selectedHubInUsePorts)
    : 0;
  const scheduleWindowText = useMemo(
    () => formatScheduleWindow(startLocal, endLocal),
    [startLocal, endLocal],
  );

  const step1Done = Boolean(selectedHubId);
  const step2Done = Boolean(draft);
  const step3Done = Boolean(appliedResult);

  return (
    <div className="space-y-5">
      {/* Thanh Stepper 3 bước rõ ràng */}
      <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        <StepPill num={1} label="Chọn Hub & Khung giờ" state={step2Done ? "done" : step1Done ? "active" : "idle"} />
        <div className="hidden h-px flex-1 bg-neutral-200 dark:bg-white/10 sm:block" />
        <StepPill num={2} label="Chọn quy tắc ưu tiên" state={step3Done ? "done" : step2Done ? "done" : "active"} />
        <div className="hidden h-px flex-1 bg-neutral-200 dark:bg-white/10 sm:block" />
        <StepPill num={3} label="Kiểm tra & Áp dụng" state={step3Done ? "done" : step2Done ? "active" : "idle"} />
      </Card>

      <ErrorMessage error={error} onRetry={() => void selectPriorityRule(ruleId)} />

      {versionConflictNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>
            <strong>Dữ liệu sạc vừa thay đổi:</strong> {versionConflictNotice}
          </span>
          <Button variant="outline" onClick={() => void selectPriorityRule(ruleId)} className="px-3 py-1 text-xs">
            Tính lại đề xuất
          </Button>
        </div>
      )}

      {/* Bố cục 2 cột thoáng: Trái cấu hình (5) | Phải phương án (7) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Cột trái: Cấu hình gọn */}
        <Card className="flex flex-col justify-between gap-5 lg:col-span-5">
          <div className="space-y-5">
            {/* Bước 1 */}
            <div data-tour="uc13-hub-time" className="space-y-4">
              <h2 className="text-sm font-bold">1. Chọn Hub &amp; Khung giờ</h2>

              {/* 1a. Chọn Hub + tình trạng cổng sạc tách rõ */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Trạm sạc (Hub)
                </label>
                {hubsLoading ? (
                  <Spinner />
                ) : (
                  <select
                    value={selectedHubId}
                    onChange={(e) => {
                      setSelectedHubId(e.target.value);
                      setDraft(null);
                      setValidatedPlan(null);
                      setAppliedResult(null);
                    }}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm font-medium outline-none focus:border-brand dark:border-white/15 dark:bg-white/5"
                  >
                    {(hubs ?? []).map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                )}

                {selectedHub && (
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-neutral-200/80 bg-neutral-50/80 p-2.5 text-center dark:border-white/10 dark:bg-white/[0.03]">
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">Cổng đang rảnh</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700 dark:text-lime">
                        {selectedHub.freeChargingPorts}
                        <span className="text-[11px] font-normal text-neutral-400">/{selectedHub.totalChargingPorts}</span>
                      </p>
                    </div>
                    <div className="border-x border-neutral-200/80 dark:border-white/10">
                      <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">Đang có xe sạc</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-sky-700 dark:text-sky-300">
                        {selectedHubInUsePorts}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">Đang lỗi / bảo trì</p>
                      <p
                        className={`mt-0.5 text-sm font-bold tabular-nums ${
                          selectedHubFaultyPorts > 0
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-neutral-400"
                        }`}
                      >
                        {selectedHubFaultyPorts}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 1b. Chọn khung giờ lập lịch + hiển thị rõ mốc giờ thực tế */}
              <div className="space-y-2 border-t border-neutral-200/70 pt-3.5 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    Khung giờ lập lịch
                  </label>
                  {scheduleWindowText && (
                    <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-700 dark:bg-white/10 dark:text-neutral-200">
                      {scheduleWindowText}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: "2H", label: "2 giờ tới" },
                      { key: "PEAK", label: "Cao điểm 17h" },
                      { key: "CUSTOM", label: "Tùy chỉnh" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => applyPreset(p.key)}
                      className={`cursor-pointer rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                        timePreset === p.key
                          ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {timePreset === "CUSTOM" && (
                  <div className="grid gap-2 pt-1 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Từ lúc
                      </label>
                      <input
                        type="datetime-local"
                        value={startLocal}
                        onChange={(e) => setTimeInput((prev) => ({ ...prev, startLocal: e.target.value }))}
                        className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs outline-none focus:border-brand dark:border-white/15"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        Đến lúc
                      </label>
                      <input
                        type="datetime-local"
                        value={endLocal}
                        onChange={(e) => setTimeInput((prev) => ({ ...prev, endLocal: e.target.value }))}
                        className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-xs outline-none focus:border-brand dark:border-white/15"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bước 2 */}
            <div data-tour="uc13-rules" className="space-y-2.5">
              <h2 className="text-sm font-bold">2. Quy tắc ưu tiên</h2>
              <div className="space-y-2">
                {PRIORITY_RULES.map((rule) => {
                  const active = ruleId === rule.id;
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => setRuleId(rule.id)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3.5 py-3 text-left transition ${
                        active
                          ? "border-brand bg-emerald-50/60 dark:border-lime dark:bg-lime/10"
                          : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{rule.label}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{rule.sub}</p>
                      </div>
                      <span
                        className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                          active
                            ? "border-brand bg-brand dark:border-lime dark:bg-lime"
                            : "border-neutral-300 dark:border-white/25"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={() => void selectPriorityRule(ruleId)}
            loading={proposalLoading}
            disabled={!selectedHubId}
          >
            Tạo đề xuất lịch sạc
          </Button>
        </Card>

        {/* Cột phải: Kết quả phân bổ trực quan HOẶC lịch sạc đang áp dụng */}
        <Card className="flex flex-col justify-between gap-5 lg:col-span-7">
          <div data-tour="uc13-result" className="flex h-full flex-col justify-between gap-5">
          {!draft ? (
            latestLoading ? (
              <div className="flex h-full min-h-[360px] items-center justify-center">
                <Spinner label="Đang tải lịch sạc hiện tại của Hub…" />
              </div>
            ) : latestSchedule ? (
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200/80 pb-3 dark:border-white/10">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold">Lịch sạc đang áp dụng</h2>
                        <StatusBadge status="COMPLETED" label={`Phiên bản v${latestSchedule.version}`} />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {selectedHub?.name}
                        {latestSchedule.appliedAt ? ` · Áp dụng lúc ${formatAppliedTime(latestSchedule.appliedAt)}` : ""}
                        {latestSchedule.allocations[0]?.timeRange
                          ? ` · Khung ${formatScheduleWindow(
                              latestSchedule.allocations[0].timeRange.startTime,
                              latestSchedule.allocations[0].timeRange.endTime,
                            )}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {(() => {
                    const activeCommitted = latestSchedule.allocations.filter((a) => !a.demandId);
                    const activeNew = latestSchedule.allocations.filter((a) => Boolean(a.demandId));
                    const activeCommittedKw = activeCommitted.reduce((s, a) => s + a.allocatedPowerKw, 0);
                    const activeNewKw = activeNew.reduce((s, a) => s + a.allocatedPowerKw, 0);
                    const activeTotalKw = activeCommittedKw + activeNewKw;
                    return (
                      <div className="space-y-2 rounded-xl bg-neutral-100/80 p-3.5 text-xs dark:bg-white/5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">Tổng công suất đã phân bổ</span>
                          <span className="font-bold tabular-nums text-emerald-700 dark:text-lime">
                            {activeTotalKw.toFixed(1)} kW ({latestSchedule.allocations.length} cổng)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
                            Đang sạc sẵn: <strong>{activeCommittedKw.toFixed(1)} kW</strong> ({activeCommitted.length} cổng)
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                            Phân bổ mới: <strong>{activeNewKw.toFixed(1)} kW</strong> ({activeNew.length} cổng)
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-neutral-200/80 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-white/10">
                        <tr>
                          <th className="py-2 pr-3 font-semibold">Xe / Yêu cầu</th>
                          <th className="py-2 pr-3 font-semibold">Cổng sạc</th>
                          <th className="py-2 pr-3 font-semibold">Công suất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {latestSchedule.allocations.map((alloc, idx) => {
                          const label = formatDemandLabel(alloc.demandId, idx);
                          const portText = formatPortLabel(portLabelById.get(alloc.portId), alloc.portId, idx);
                          const portMaxKw = portMaxKwById.get(alloc.portId);
                          const isThrottled = portMaxKw !== undefined && alloc.allocatedPowerKw < portMaxKw - 0.05;
                          return (
                            <tr key={`${alloc.portId}-${idx}`}>
                              <td className="py-2.5 pr-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold">{label.title}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      alloc.demandId
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                        : "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300"
                                    }`}
                                  >
                                    {alloc.demandId ? "Phân bổ mới" : "Đang sạc sẵn"}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 pr-3 font-medium text-neutral-700 dark:text-neutral-200">
                                {portText}
                              </td>
                              <td className="py-2.5 pr-3">
                                <span className="font-bold tabular-nums">{alloc.allocatedPowerKw.toFixed(1)} kW</span>
                                {isThrottled && (
                                  <p className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                    Giảm tải tự động ({alloc.allocatedPowerKw.toFixed(1)}/{portMaxKw} kW)
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 px-3.5 py-2.5 text-[11px] text-neutral-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300">
                  Muốn thay đổi quy tắc ưu tiên hoặc khung giờ? Chọn lại bên trái rồi bấm{" "}
                  <strong>Tạo đề xuất lịch sạc</strong> để lập phiên bản mới (v{latestSchedule.version + 1}).
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-8 text-center dark:border-white/10">
                <p className="text-sm font-semibold">Chưa có lịch sạc nào được áp dụng</p>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  Chọn Hub, khung giờ và quy tắc bên trái rồi bấm <strong>Tạo đề xuất lịch sạc</strong>.
                </p>
              </div>
            )
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">Phương án phân bổ đề xuất</h2>
                    {latestSchedule && !appliedResult && (
                      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                        Đang áp dụng: v{latestSchedule.version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="ALLOCATED" label={`Đáp ứng ${draft.servedRequests.length}`} />
                    {draft.waitingRequests.length > 0 && (
                      <StatusBadge status="WAITING" label={`Chờ ${draft.waitingRequests.length}`} />
                    )}
                  </div>
                </div>

                {/* Thanh tải điện Hub trực quan 2 tầng: Đang sạc sẵn vs Phân bổ mới */}
                <div className="space-y-2 rounded-xl bg-neutral-100/80 p-3.5 dark:bg-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Tải điện dự kiến toàn Hub</span>
                    <span
                      className={`font-bold tabular-nums ${
                        isOverPower ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-lime"
                      }`}
                    >
                      {totalProposedKw.toFixed(1)} / {maxPowerKw || "—"} kW ({powerPct}%)
                    </span>
                  </div>
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                    {isOverPower ? (
                      <div className="h-full w-full rounded-full bg-red-500 transition-all" />
                    ) : (
                      <>
                        <div
                          className="h-full bg-sky-500 transition-all"
                          style={{ width: `${committedPct}%` }}
                          title={`Đang sạc sẵn: ${committedKw.toFixed(1)} kW`}
                        />
                        <div
                          className="h-full bg-brand transition-all dark:bg-lime"
                          style={{ width: `${newPct}%` }}
                          title={`Phân bổ mới: ${newKw.toFixed(1)} kW`}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden="true" />
                      Đang sạc sẵn: <strong>{committedKw.toFixed(1)} kW</strong> ({committedAllocations.length} cổng)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-brand dark:bg-lime" aria-hidden="true" />
                      Phân bổ mới: <strong>{newKw.toFixed(1)} kW</strong> ({newAllocations.length} cổng rảnh)
                    </span>
                  </div>
                </div>

                {/* Bảng phân bổ gọn */}
                {editableAllocations.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-neutral-200 py-6 text-center text-xs text-neutral-500 dark:border-white/10">
                    Không có nhu cầu sạc mới trong khung giờ này.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-neutral-200/80 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-white/10">
                        <tr>
                          <th className="py-2 pr-3 font-semibold">Xe / Yêu cầu</th>
                          <th className="py-2 pr-3 font-semibold">Cổng sạc</th>
                          <th className="py-2 pr-3 font-semibold">Công suất (kW)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                        {editableAllocations.map((alloc, idx) => {
                          const demandObj = alloc.demandId
                            ? context?.demands.find((d) => d.demandId === alloc.demandId)
                            : undefined;
                          const label = formatDemandLabel(alloc.demandId, idx);
                          const isLow = demandObj ? demandObj.chargingNeed.currentBattery < 25 : false;
                          const portText = formatPortLabel(portLabelById.get(alloc.portId), alloc.portId, idx);
                          const portMaxKw = portMaxKwById.get(alloc.portId);
                          const isThrottled =
                            portMaxKw !== undefined && Number(alloc.allocatedPowerKw) < portMaxKw - 0.05;
                          return (
                            <tr
                              key={`${alloc.portId}-${idx}`}
                              className={!alloc.demandId ? "bg-sky-50/35 dark:bg-sky-500/[0.04]" : undefined}
                            >
                              <td className="py-2.5 pr-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-semibold">{label.title}</span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      alloc.demandId
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                        : "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300"
                                    }`}
                                  >
                                    {alloc.demandId ? "Phân bổ mới" : "Đang sạc sẵn"}
                                  </span>
                                  {demandObj && (
                                    <span className="tabular-nums text-neutral-500">
                                      {demandObj.chargingNeed.currentBattery}% → {demandObj.chargingNeed.targetBattery}%
                                    </span>
                                  )}
                                  {isLow && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
                                      Pin thấp
                                    </span>
                                  )}
                                </div>
                                {label.subtitle && (
                                  <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                                    {label.subtitle}
                                  </p>
                                )}
                              </td>
                              <td className="py-2.5 pr-3 font-medium text-neutral-700 dark:text-neutral-200">
                                {portText}
                              </td>
                              <td className="py-2.5 pr-3">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    max={portMaxKw ?? 25}
                                    value={alloc.allocatedPowerKw}
                                    onChange={(e) => adjustPlan(idx, parseFloat(e.target.value) || 0)}
                                    className="w-20 rounded-lg border border-neutral-300 bg-transparent px-2 py-1 text-xs font-semibold tabular-nums outline-none focus:border-brand dark:border-white/20"
                                  />
                                  <span>kW</span>
                                </div>
                                {isThrottled && (
                                  <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                    Giảm tải tự động ({Number(alloc.allocatedPowerKw).toFixed(1)}/{portMaxKw} kW)
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {draft.waitingRequests.length > 0 && (
                  <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                    <strong>Chưa đủ cổng trong khung này (chờ lượt sau):</strong>{" "}
                    {draft.waitingRequests.map(formatWaitingItem).join(", ")}
                  </div>
                )}

                {validatedPlan && !appliedResult && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-lime">
                    ✓ Kế hoạch hợp lệ (không vượt giới hạn kW, không trùng cổng hỏng hoặc lịch đã đặt), sẵn sàng áp dụng.
                  </div>
                )}

                {appliedResult && (
                  <div className="space-y-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">
                        ✓ Đã áp dụng lịch sạc ({appliedResult.allocations.length} phân bổ cổng &amp; công suất).
                      </span>
                      <StatusBadge
                        status="COMPLETED"
                        label={`Phiên bản v${(validatedPlan?.baseVersion ?? 0) + 1}`}
                      />
                    </div>
                    <p className="text-[11px] opacity-85">
                      Đã lưu kế hoạch vào hệ thống, tự cấp cổng cho các yêu cầu sạc đang chờ (UC07) và giữ nguyên các
                      phiên đang sạc/lịch đã đặt trước. Cổng có sự cố bên UC11 tự động được loại trừ.
                    </p>
                  </div>
                )}
              </div>

              {/* Thanh hành động đáy */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 pt-4 dark:border-white/10">
                <Button variant="ghost" onClick={cancelApply} className="text-xs">
                  Hủy
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={validatedPlan ? "outline" : "primary"}
                    onClick={() => void requestPlanValidation()}
                    loading={validating}
                    className="text-xs"
                  >
                    Kiểm tra hợp lệ
                  </Button>
                  {validatedPlan && (
                    <Button
                      variant="primary"
                      onClick={() => void confirmSchedule()}
                      loading={applying}
                      className="text-xs"
                    >
                      Áp dụng lịch sạc
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StepPill({ num, label, state }: { num: number; label: string; state: "done" | "active" | "idle" }) {
  return (
    <div className="flex items-center gap-2.5">
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
      <span
        className={`text-xs ${
          state === "active"
            ? "font-bold text-neutral-900 dark:text-white"
            : state === "done"
              ? "font-medium text-neutral-700 dark:text-neutral-200"
              : "text-neutral-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
