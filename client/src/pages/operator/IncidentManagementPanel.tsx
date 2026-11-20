// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
// Tách thành panel riêng để nhúng vào ChargingIncidentPage mà không xung đột với UC13 (Hoàng Nhân).
import { useEffect, useMemo, useState } from "react";
import { incidentApi, type IncidentResourceOption } from "../../api/incident";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { StatusBadge } from "../../components/StatusBadge";
import type {
  Incident,
  IncidentContext,
  IncidentDetails,
  IncidentImpact,
} from "../../types";

function generateRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const IMPACT_OPTIONS: Array<{ value: IncidentImpact; label: string }> = [
  { value: "LOW", label: "Thấp (LOW)" },
  { value: "MEDIUM", label: "Trung bình (MEDIUM)" },
  { value: "HIGH", label: "Cao (HIGH – Ưu tiên xử lý)" },
];

const ACTION_TYPE_OPTIONS = [
  { value: "RESTRICT_AND_NOTIFY", label: "Hạn chế tài nguyên & thông báo người dùng" },
  { value: "REASSIGN_ALTERNATIVE", label: "Chuyển sang tài nguyên thay thế khả dụng" },
  { value: "SCHEDULE_MAINTENANCE", label: "Đưa đi bảo trì kỹ thuật" },
] as const;

export function IncidentManagementPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<IncidentResourceOption[]>([]);

  // Form báo cáo sự cố mới
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [resourceContext, setResourceContext] = useState<IncidentContext | null>(null);
  const [description, setDescription] = useState<string>("");
  const [impactLevel, setImpactLevel] = useState<IncidentImpact>("MEDIUM");
  const [affectedScope, setAffectedScope] = useState<string>("Tài nguyên đơn lẻ tại Hub");
  const [reportRequestId, setReportRequestId] = useState<string>(generateRequestId);

  // Chi tiết sự cố đang chọn để xử lý & xác minh khắc phục
  const [activeIncidentId, setActiveIncidentId] = useState<string>("");
  const [incidentDetails, setIncidentDetails] = useState<IncidentDetails | null>(null);
  const [actionType, setActionType] = useState<string>(ACTION_TYPE_OPTIONS[0].value);
  const [allocationChangesText, setAllocationChangesText] = useState<string>("");
  const [planRequestId, setPlanRequestId] = useState<string>(generateRequestId);

  const [isResolved, setIsResolved] = useState<boolean>(true);
  const [evidence, setEvidence] = useState<string>("");
  const [resolutionRequestId, setResolutionRequestId] = useState<string>(generateRequestId);

  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const resourceById = useMemo(
    () => new Map(resources.map((r) => [r.id, r])),
    [resources],
  );

  async function refreshOverview(keepIncidentId?: string) {
    const overview = await incidentApi.listOverview();
    setIncidents(overview.incidents);
    setResources(overview.resources);
    setSelectedResourceId((prev) => prev || overview.resources[0]?.id || "");
    const targetIncId = keepIncidentId ?? activeIncidentId;
    if (targetIncId) {
      try {
        const det = await incidentApi.openExistingIncident(targetIncId);
        setIncidentDetails(det);
      } catch {
        setIncidentDetails(null);
      }
    }
  }

  useEffect(() => {
    let active = true;
    void incidentApi
      .listOverview()
      .then((overview) => {
        if (!active) return;
        setIncidents(overview.incidents);
        setResources(overview.resources);
        const firstResId = overview.resources[0]?.id ?? "";
        setSelectedResourceId(firstResId);
        if (firstResId) {
          void incidentApi
            .openIncidentManagement(firstResId)
            .then((ctx) => {
              if (active) setResourceContext(ctx);
            })
            .catch(() => undefined);
        }
      })
      .catch((err) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSelectResource(resId: string) {
    setSelectedResourceId(resId);
    setResourceContext(null);
    setError(null);
    if (!resId) return;
    try {
      const ctx = await incidentApi.openIncidentManagement(resId);
      setResourceContext(ctx);
    } catch (err) {
      setError(err);
    }
  }

  async function handleReportIncident() {
    if (!selectedResourceId || !description.trim() || !affectedScope.trim()) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      const res = await incidentApi.submitIncident(
        reportRequestId,
        selectedResourceId,
        description.trim(),
        impactLevel,
        affectedScope.trim(),
      );
      setInfoMsg(res.message);
      setDescription("");
      setReportRequestId(generateRequestId());
      if (res.incidentId) {
        setActiveIncidentId(res.incidentId);
      }
      await refreshOverview(res.incidentId);
      await handleSelectResource(selectedResourceId);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenIncident(incidentId: string) {
    setActiveIncidentId(incidentId);
    setError(null);
    setInfoMsg(null);
    setPlanRequestId(generateRequestId());
    setResolutionRequestId(generateRequestId());
    try {
      const details = await incidentApi.openExistingIncident(incidentId);
      setIncidentDetails(details);
    } catch (err) {
      setError(err);
    }
  }

  async function handleSubmitPlan() {
    if (!activeIncidentId) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      const changes = allocationChangesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await incidentApi.submitHandlingPlan(planRequestId, activeIncidentId, {
        actionType,
        allocationChanges: changes.length > 0 ? changes : ["NOTIFY_AFFECTED_USERS"],
      });
      setInfoMsg(res.message);
      setPlanRequestId(generateRequestId());
      setAllocationChangesText("");
      await refreshOverview(activeIncidentId);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyResolution() {
    if (!activeIncidentId || !evidence.trim()) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      const res = await incidentApi.submitResolutionResult(resolutionRequestId, activeIncidentId, {
        isResolved,
        evidence: evidence.trim(),
      });
      setInfoMsg(res.message);
      setEvidence("");
      setResolutionRequestId(generateRequestId());
      await refreshOverview(activeIncidentId);
      if (selectedResourceId) {
        await handleSelectResource(selectedResourceId);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Sự cố vận hành
        </p>
        <h2 className="mt-0.5 text-base font-bold">Ghi nhận, xử lý &amp; xác minh khắc phục sự cố</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Hạn chế phân bổ mới cho tài nguyên hỏng, lưu phương án xử lý và khôi phục phục vụ khi khắc phục xong.
        </p>
      </div>

      <ErrorMessage error={error} />
      {infoMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {infoMsg}
        </div>
      )}

      {/* Phần 1: Ghi nhận sự cố mới */}
      <div className="space-y-3 rounded-xl border border-neutral-200 p-3.5 text-xs dark:border-white/10">
        <h3 className="text-sm font-bold">1. Ghi nhận sự cố tài nguyên</h3>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block font-medium">Chọn tài nguyên</label>
            <select
              value={selectedResourceId}
              onChange={(e) => void handleSelectResource(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
            >
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.hubName}] {r.label} — {r.status}
                </option>
              ))}
            </select>
          </div>

          {resourceContext && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 sm:col-span-2 dark:bg-white/5">
              <span>
                Trạng thái hiện tại: <StatusBadge status={resourceContext.resourceStatus} />
              </span>
              <span className="text-neutral-500">
                Sự cố đang mở: <strong>{resourceContext.openIncidents.length}</strong>
              </span>
            </div>
          )}

          <div>
            <label className="mb-1 block font-medium">Mức độ ảnh hưởng</label>
            <select
              value={impactLevel}
              onChange={(e) => setImpactLevel(e.target.value as IncidentImpact)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
            >
              {IMPACT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium">Phạm vi ảnh hưởng</label>
            <input
              type="text"
              value={affectedScope}
              onChange={(e) => setAffectedScope(e.target.value)}
              placeholder="Vd: Cổng sạc số 01 tại Hub"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block font-medium">Mô tả sự cố</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả chi tiết tình trạng lỗi của cổng sạc / chỗ đỗ / xe..."
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="danger"
          fullWidth
          loading={busy}
          disabled={!selectedResourceId || description.trim().length < 3}
          onClick={() => void handleReportIncident()}
          className="py-2 text-xs"
        >
          Ghi nhận sự cố &amp; hạn chế tài nguyên
        </Button>
      </div>

      {/* Phần 2: Danh sách sự cố đã ghi nhận */}
      <div className="space-y-2 text-xs">
        <h3 className="text-sm font-bold">2. Danh sách sự cố ({incidents.length})</h3>
        {incidents.length === 0 ? (
          <p className="text-neutral-500">Chưa có sự cố nào được ghi nhận.</p>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {incidents.map((inc) => {
              const resInfo = resourceById.get(inc.resourceId);
              const isSelected = activeIncidentId === inc.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => void handleOpenIncident(inc.id)}
                  className={`flex w-full items-start justify-between gap-2 rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-brand bg-brand/5 dark:border-lime dark:bg-lime/10"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {resInfo ? `[${resInfo.hubName}] ${resInfo.label}` : inc.resourceId}
                    </p>
                    <p className="text-neutral-600 dark:text-neutral-300">{inc.description}</p>
                    <p className="text-[11px] text-neutral-500">
                      Mức độ: {inc.impactLevel} · v{inc.version}
                    </p>
                  </div>
                  <StatusBadge status={inc.status} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Phần 3: Xử lý phương án & xác minh khắc phục cho sự cố đang chọn */}
      {incidentDetails && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/50 p-3.5 text-xs dark:border-amber-500/40 dark:bg-amber-500/10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Chi tiết &amp; xử lý sự cố</p>
              <p className="font-mono text-[11px] text-neutral-500">{incidentDetails.incident.id}</p>
            </div>
            <StatusBadge status={incidentDetails.incident.status} />
          </div>

          <div className="rounded-lg bg-white/80 p-2.5 dark:bg-black/20">
            <p className="font-semibold">
              Dịch vụ / đặt chỗ bị ảnh hưởng ({incidentDetails.affectedServices.length}):
            </p>
            {incidentDetails.affectedServices.length === 0 ? (
              <p className="text-neutral-500">Không có đặt chỗ hay lịch sạc nào đang bị ảnh hưởng.</p>
            ) : (
              <ul className="mt-1 list-disc pl-4 font-mono text-[11px]">
                {incidentDetails.affectedServices.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </div>

          {incidentDetails.incident.status !== "CLOSED" && (
            <>
              <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-panel-dark">
                <p className="font-bold">Bước A: Áp dụng phương án xử lý</p>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={allocationChangesText}
                  onChange={(e) => setAllocationChangesText(e.target.value)}
                  placeholder="Ghi chú thay đổi phân bổ (mỗi dòng 1 mục, vd: NOTIFY_AFFECTED_USERS hoặc REASSIGN:<resourceId>)"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
                />
                <Button
                  type="button"
                  variant="dark"
                  loading={busy}
                  onClick={() => void handleSubmitPlan()}
                  className="w-full py-2 text-xs"
                >
                  Lưu phương án xử lý &amp; thông báo
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-neutral-200 bg-white p-3 dark:border-white/10 dark:bg-panel-dark">
                <p className="font-bold">Bước B: Xác minh kết quả khắc phục</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isResolved}
                    onChange={(e) => setIsResolved(e.target.checked)}
                  />
                  <span>Đã khắc phục hoàn toàn và sẵn sàng đưa tài nguyên vào phục vụ lại</span>
                </label>
                <input
                  type="text"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Nhập bằng chứng / ghi chú kiểm tra kỹ thuật..."
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
                />
                <Button
                  type="button"
                  variant="primary"
                  loading={busy}
                  disabled={!evidence.trim()}
                  onClick={() => void handleVerifyResolution()}
                  className="w-full py-2 text-xs"
                >
                  {isResolved ? "Xác nhận khắc phục & đóng sự cố" : "Lưu tiến độ (giữ đang xử lý)"}
                </Button>
              </div>
            </>
          )}

          {incidentDetails.incident.status === "CLOSED" && incidentDetails.incident.resolutionNote && (
            <p className="rounded-lg bg-emerald-50 p-2.5 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
              <strong>Kết quả đóng sự cố:</strong> {incidentDetails.incident.resolutionNote}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
