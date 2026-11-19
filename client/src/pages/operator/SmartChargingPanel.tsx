// Owner: Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
// Giao diện ChargingScheduleView khớp class diagram Submission #3 (docs/hoangnhan_submission3/UC13.drawio):
// - selectHubAndTimeRange(hubId, timeRange) -> chargingScheduleApi.loadChargingContext
// - selectPriorityRule(ruleId) -> chargingScheduleApi.generateProposedSchedule
// - adjustPlan(planDraftId, changes) & requestPlanValidation(planDraftId) -> chargingScheduleApi.validatePlan
// - confirmSchedule(planDraftId) -> chargingScheduleApi.applyChargingSchedule (kèm requestId & baseVersion)
// - cancelApply(planDraftId) -> hủy áp dụng (Ext 7a)
import { useEffect, useState } from "react";
import { chargingScheduleApi } from "../../api/chargingSchedule";
import { ApiError } from "../../api/client";
import { hubApi } from "../../api/hubs";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type {
  ChargingContext,
  PlanAdjustment,
  PlanAllocation,
  PlanDraft,
  ScheduleResult,
  TimeRange,
  ValidatedPlan,
} from "../../types";

const PRIORITY_RULES = [
  {
    id: "LOW_BATTERY_FIRST",
    label: "Ưu tiên xe pin thấp (< 25% xét trước)",
    description: "Phân bổ cổng sạc trước cho các xe có mức pin dưới ngưỡng ưu tiên, sắp xếp tăng dần theo % pin.",
  },
  {
    id: "SOONEST_USE_FIRST",
    label: "Ưu tiên xe sắp cần sử dụng / gửi yêu cầu trước (FIFO)",
    description: "Ưu tiên các yêu cầu sạc đã ghi nhận thời điểm trước, sau đó xét đến mức pin.",
  },
  {
    id: "MAX_NEED_FIRST",
    label: "Ưu tiên nhu cầu thiếu hụt năng lượng lớn nhất",
    description: "Sắp xếp theo độ chênh lệch (Mục tiêu pin % - Pin hiện tại %) từ cao xuống thấp.",
  },
] as const;

function getDefaultTimeRange(): { startLocal: string; endLocal: string } {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60_000);
  const end = new Date(now.getTime() + 125 * 60_000);
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return { startLocal: toLocalInput(start), endLocal: toLocalInput(end) };
}

export function SmartChargingPanel() {
  const { data: hubs, loading: hubsLoading } = useAsync(() => hubApi.list(), []);
  const [selectedHubId, setSelectedHubId] = useState<string>("");
  const [{ startLocal, endLocal }, setTimeInput] = useState(getDefaultTimeRange);
  const [ruleId, setRuleId] = useState<string>("LOW_BATTERY_FIRST");

  const [context, setContext] = useState<ChargingContext | null>(null);
  const [contextLoading, setContextLoading] = useState<boolean>(false);

  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [editableAllocations, setEditableAllocations] = useState<PlanAllocation[]>([]);
  const [proposalLoading, setProposalLoading] = useState<boolean>(false);

  const [validatedPlan, setValidatedPlan] = useState<ValidatedPlan | null>(null);
  const [validating, setValidating] = useState<boolean>(false);

  const [appliedResult, setAppliedResult] = useState<ScheduleResult | null>(null);
  const [applying, setApplying] = useState<boolean>(false);
  const [pendingRequestId, setPendingRequestId] = useState<string>(() => crypto.randomUUID());

  const [error, setError] = useState<unknown>(null);
  const [versionConflictNotice, setVersionConflictNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedHubId && hubs && hubs.length > 0) {
      setSelectedHubId(hubs[0]!.id);
    }
  }, [hubs, selectedHubId]);

  const buildTimeRange = (): TimeRange => ({
    startTime: new Date(startLocal).toISOString(),
    endTime: new Date(endLocal).toISOString(),
  });

  // ChargingScheduleView.selectHubAndTimeRange (UC13 bước 1–2)
  const selectHubAndTimeRange = async (hubIdArg?: string) => {
    const targetHubId = hubIdArg ?? selectedHubId;
    if (!targetHubId) return;

    setError(null);
    setVersionConflictNotice(null);
    setContextLoading(true);
    try {
      const tr = buildTimeRange();
      const ctx = await chargingScheduleApi.loadChargingContext(targetHubId, tr);
      setContext(ctx);
      setDraft(null);
      setEditableAllocations([]);
      setValidatedPlan(null);
      setAppliedResult(null);
    } catch (err) {
      setError(err);
    } finally {
      setContextLoading(false);
    }
  };

  // ChargingScheduleView.selectPriorityRule (UC13 bước 3–4)
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
      setPendingRequestId(crypto.randomUUID());
    } catch (err) {
      setError(err);
    } finally {
      setProposalLoading(false);
    }
  };

  // ChargingScheduleView.adjustPlan (UC13 bước 5)
  const adjustPlan = (index: number, newPowerKw: number) => {
    setEditableAllocations((prev) =>
      prev.map((item, i) => (i === index ? { ...item, allocatedPowerKw: newPowerKw } : item)),
    );
    // Khi chỉnh sửa tay công suất, cần kiểm tra lại ở bước 6 trước khi áp dụng
    setValidatedPlan(null);
  };

  // ChargingScheduleView.requestPlanValidation (UC13 bước 6)
  const requestPlanValidation = async () => {
    if (!draft) return;
    setError(null);
    setValidating(true);
    try {
      const adjustments: PlanAdjustment[] = editableAllocations.map((alloc, idx) => ({
        demandId: draft.servedRequests[idx] ?? `alloc-${idx}`,
        portId: alloc.portId,
        positionId: alloc.positionId,
        timeRange: alloc.timeRange,
        allocatedPowerKw: Number(alloc.allocatedPowerKw),
      }));
      const validated = await chargingScheduleApi.validatePlan(draft.planDraftId, adjustments);
      setValidatedPlan(validated);
      setPendingRequestId(crypto.randomUUID());
    } catch (err) {
      setValidatedPlan(null);
      setError(err);
    } finally {
      setValidating(false);
    }
  };

  // ChargingScheduleView.confirmSchedule (UC13 bước 7–9)
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
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        // UC13 Ext 8a: Nhu cầu, tài nguyên hoặc kế hoạch đã thay đổi -> yêu cầu tải lại bước 2
        setVersionConflictNotice(err.message);
      } else {
        setError(err);
      }
    } finally {
      setApplying(false);
    }
  };

  // ChargingScheduleView.cancelApply (UC13 Ext 7a)
  const cancelApply = () => {
    setDraft(null);
    setEditableAllocations([]);
    setValidatedPlan(null);
    setError(null);
  };

  const totalProposedKw = editableAllocations.reduce(
    (sum, a) => sum + (Number(a.allocatedPowerKw) || 0),
    0,
  );
  const selectedHubName = hubs?.find((h) => h.id === selectedHubId)?.name ?? "Hub đã chọn";

  return (
    <Card className="space-y-6">
      <div className="border-b border-neutral-200 pb-4 dark:border-white/10">
        <div>
          <h2 className="text-lg font-bold">Lịch sạc thông minh</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Điều phối phân bổ cổng sạc &amp; công suất theo giới hạn điện của Hub, mức pin và thứ tự ưu tiên.
          </p>
        </div>
      </div>

      {/* Bước 1–2: Chọn Hub và khoảng thời gian điều phối */}
      <div className="space-y-4 rounded-xl border border-neutral-200/80 p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">
          Chọn Mobility Hub &amp; Khung giờ điều phối
        </h3>
        {hubsLoading ? (
          <Spinner />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Mobility Hub
              </label>
              <select
                value={selectedHubId}
                onChange={(e) => setSelectedHubId(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand dark:border-white/15 dark:bg-neutral-900 dark:text-neutral-100"
              >
                {(hubs ?? []).map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.freeChargingPorts}/{h.totalChargingPorts} cổng rảnh)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
                Bắt đầu điều phối
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
                Kết thúc điều phối
              </label>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setTimeInput((prev) => ({ ...prev, endLocal: e.target.value }))}
                className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/15"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void selectHubAndTimeRange()}
            loading={contextLoading}
            disabled={!selectedHubId}
          >
            Tải dữ liệu sạc tại Hub
          </Button>
          {context && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Đã tải bối cảnh của <strong>{selectedHubName}</strong>: {context.demands.length} nhu cầu sạc · Giới hạn điện:{" "}
              <strong>{context.hubPowerCapacityKw} kW</strong>
            </span>
          )}
        </div>

        {/* Hiển thị tóm tắt bối cảnh sạc (UC13 bước 2) */}
        {context && (
          <div className="space-y-3 border-t border-neutral-200/70 pt-3 dark:border-white/10">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-neutral-100/80 p-2.5 dark:bg-white/5">
                <p className="text-xs text-neutral-500">Giới hạn công suất</p>
                <p className="text-lg font-bold">{context.hubPowerCapacityKw} kW</p>
              </div>
              <div className="rounded-lg bg-neutral-100/80 p-2.5 dark:bg-white/5">
                <p className="text-xs text-neutral-500">Nhu cầu cần sạc</p>
                <p className="text-lg font-bold">{context.demands.length} xe</p>
              </div>
              <div className="rounded-lg bg-neutral-100/80 p-2.5 dark:bg-white/5">
                <p className="text-xs text-neutral-500">Cam kết đã có</p>
                <p className="text-lg font-bold">
                  {context.confirmedReservations.length + context.activeSessions.length}
                </p>
              </div>
              <div className="rounded-lg bg-neutral-100/80 p-2.5 dark:bg-white/5">
                <p className="text-xs text-neutral-500">Tài nguyên hạn chế</p>
                <p className="text-lg font-bold">{context.restrictedResources.length}</p>
              </div>
            </div>

            {context.demands.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Danh sách nhu cầu sạc tại Hub:
                </p>
                <div className="flex flex-wrap gap-2">
                  {context.demands.map((d) => {
                    const isLow = d.chargingNeed.currentBattery < 25;
                    return (
                      <span
                        key={d.demandId}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                          isLow
                            ? "border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                            : "border-neutral-200 bg-white dark:border-white/10 dark:bg-white/5"
                        }`}
                      >
                        <strong>{d.demandId}</strong>: Pin {d.chargingNeed.currentBattery}% →{" "}
                        {d.chargingNeed.targetBattery}%
                        {isLow && <span className="font-semibold text-amber-600 dark:text-amber-300">(Pin thấp)</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {context.restrictedResources.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-2.5 text-xs text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                <strong>Tài nguyên đang bị hạn chế do sự cố / bảo trì (không đưa vào phương án):</strong>{" "}
                {context.restrictedResources.map((r) => r.reason).join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bước 3–4: Chọn quy tắc ưu tiên & Sinh kế hoạch đề xuất */}
      <div className="space-y-4 rounded-xl border border-neutral-200/80 p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">
          Chọn quy tắc ưu tiên &amp; Đề xuất kế hoạch phân bổ
        </h3>
        <div className="space-y-2">
          {PRIORITY_RULES.map((rule) => (
            <label
              key={rule.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                ruleId === rule.id
                  ? "border-brand bg-brand/5 dark:border-lime dark:bg-lime/10"
                  : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
              }`}
            >
              <input
                type="radio"
                name="priorityRule"
                value={rule.id}
                checked={ruleId === rule.id}
                onChange={() => setRuleId(rule.id)}
                className="mt-1"
              />
              <div>
                <p className="font-semibold">{rule.label}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{rule.description}</p>
              </div>
            </label>
          ))}
        </div>

        <Button
          variant="primary"
          onClick={() => void selectPriorityRule(ruleId)}
          loading={proposalLoading}
          disabled={!selectedHubId}
        >
          Sinh kế hoạch đề xuất
        </Button>
      </div>

      {/* Hiển thị lỗi hoặc cảnh báo xung đột phiên bản (Ext 8a) */}
      <ErrorMessage error={error} onRetry={() => void selectHubAndTimeRange()} />

      {versionConflictNotice && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-semibold">Dữ liệu sạc tại Hub vừa thay đổi</p>
          <p className="mt-1 text-xs">{versionConflictNotice}</p>
          <div className="mt-3">
            <Button variant="outline" onClick={() => void selectPriorityRule(ruleId)}>
              Tải lại dữ liệu &amp; Tính lại đề xuất
            </Button>
          </div>
        </div>
      )}

      {/* Bước 5–8: Xem đề xuất, điều chỉnh công suất, kiểm tra ràng buộc & áp dụng */}
      {draft && (
        <div className="space-y-4 rounded-xl border-2 border-brand/30 p-4 dark:border-lime/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">
                Kế hoạch phân bổ đề xuất
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Tổng công suất phân bổ:{" "}
                <strong
                  className={
                    context && totalProposedKw > context.hubPowerCapacityKw
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-lime"
                  }
                >
                  {totalProposedKw.toFixed(1)} kW
                </strong>{" "}
                / Giới hạn Hub: <strong>{context?.hubPowerCapacityKw ?? "—"} kW</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                status="ALLOCATED"
                label={`Đáp ứng: ${draft.servedRequests.length} nhu cầu`}
              />
              {draft.waitingRequests.length > 0 && (
                <StatusBadge
                  status="WAITING"
                  label={`Còn chờ: ${draft.waitingRequests.length}`}
                />
              )}
            </div>
          </div>

          {/* Bảng phân bổ cổng sạc & điều chỉnh công suất (UC13 bước 5) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 uppercase text-neutral-500 dark:border-white/10">
                <tr>
                  <th className="py-2 pr-3">Nhu cầu / Xe</th>
                  <th className="py-2 pr-3">Mã cổng sạc</th>
                  <th className="py-2 pr-3">Mã vị trí đỗ</th>
                  <th className="py-2 pr-3">Công suất cấp (kW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                {editableAllocations.map((alloc, idx) => {
                  const demandId = draft.servedRequests[idx] ?? `Cam kết #${idx + 1}`;
                  const demandObj = context?.demands.find((d) => d.demandId === demandId);
                  return (
                    <tr key={alloc.portId}>
                      <td className="py-2.5 pr-3 font-semibold">
                        {demandId}
                        {demandObj && (
                          <span className="ml-1.5 font-normal text-neutral-500">
                            ({demandObj.chargingNeed.currentBattery}% → {demandObj.chargingNeed.targetBattery}%)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-neutral-500">
                        {alloc.portId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-neutral-500">
                        {alloc.positionId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="25"
                          value={alloc.allocatedPowerKw}
                          onChange={(e) => adjustPlan(idx, parseFloat(e.target.value) || 0)}
                          className="w-24 rounded-lg border border-neutral-300 bg-transparent px-2.5 py-1 text-sm font-semibold outline-none focus:border-brand dark:border-white/20"
                        />{" "}
                        kW
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* UC13 Ext 4a: Hiển thị rõ các nhu cầu còn chờ (nếu số nhu cầu > số cổng sạc) */}
          {draft.waitingRequests.length > 0 && (
            <div className="rounded-lg border border-amber-300/70 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              <strong>Nhu cầu còn chờ phân bổ:</strong>{" "}
              {draft.waitingRequests.join(", ")}
            </div>
          )}

          {/* Bước 6 & 7: Nút Kiểm tra kế hoạch -> Xác nhận áp dụng */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void requestPlanValidation()}
                loading={validating}
              >
                Kiểm tra kế hoạch
              </Button>

              {validatedPlan && (
                <Button
                  variant="primary"
                  onClick={() => void confirmSchedule()}
                  loading={applying}
                >
                  Xác nhận áp dụng
                </Button>
              )}
            </div>

            <Button variant="ghost" onClick={cancelApply}>
              Hủy bỏ
            </Button>
          </div>

          {validatedPlan && !appliedResult && (
            <p className="text-xs font-medium text-emerald-700 dark:text-lime">
              ✓ Kế hoạch hợp lệ: Không vượt giới hạn công suất ({context?.hubPowerCapacityKw} kW), không cấp trùng tài nguyên và bảo toàn các lịch đã xác nhận.
            </p>
          )}
        </div>
      )}

      {/* Bước 9: Hiển thị kết quả áp dụng kế hoạch sạc thành công */}
      {appliedResult && (
        <div className="rounded-xl border border-emerald-400/60 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              ✓ Đã áp dụng kế hoạch sạc thông minh thành công!
            </p>
            <StatusBadge status="COMPLETED" label={`Mã kế hoạch: ${appliedResult.scheduleVersionId.slice(0, 8)}`} />
          </div>
          <p className="mt-1 text-xs opacity-90">
            Đã lưu {appliedResult.allocations.length} phân bổ cổng sạc vào hệ thống và gửi thông báo tới các bên liên quan. Kế hoạch sẽ có hiệu lực khi phương tiện kết nối sạc.
          </p>
        </div>
      )}
    </Card>
  );
}
