// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import { useEffect, useMemo, useState } from "react";
import { incidentApi, type IncidentResourceOption } from "../../api/incident";
import { newRequestId } from "../../api/requestId";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { StatusBadge } from "../../components/StatusBadge";
import type { Incident, IncidentContext, IncidentDetails, IncidentImpact } from "../../types";

const IMPACT_OPTIONS: Array<{ value: IncidentImpact; label: string }> = [
  { value: "LOW", label: "Thấp" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "HIGH", label: "Cao (Ưu tiên)" },
];

const ACTION_TYPE_OPTIONS = [
  { value: "RESTRICT_AND_NOTIFY", label: "Hạn chế tài nguyên & thông báo người dùng" },
  { value: "REASSIGN_ALTERNATIVE", label: "Chuyển sang tài nguyên thay thế khả dụng" },
  { value: "SCHEDULE_MAINTENANCE", label: "Đưa đi bảo trì kỹ thuật" },
] as const;

export function IncidentManagementPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<IncidentResourceOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED">("OPEN");
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  // Form ghi nhận sự cố mới
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [resourceContext, setResourceContext] = useState<IncidentContext | null>(null);
  const [description, setDescription] = useState<string>("");
  const [impactLevel, setImpactLevel] = useState<IncidentImpact>("MEDIUM");
  const [affectedScope, setAffectedScope] = useState<string>("Tài nguyên đơn lẻ tại Hub");
  const [reportRequestId, setReportRequestId] = useState<string>(newRequestId);

  // Chi tiết sự cố đang chọn
  const [activeIncidentId, setActiveIncidentId] = useState<string>("");
  const [incidentDetails, setIncidentDetails] = useState<IncidentDetails | null>(null);
  const [actionType, setActionType] = useState<string>(ACTION_TYPE_OPTIONS[0].value);
  const [allocationChangesText, setAllocationChangesText] = useState<string>("");
  const [planRequestId, setPlanRequestId] = useState<string>(newRequestId);

  const [isResolved, setIsResolved] = useState<boolean>(true);
  const [evidence, setEvidence] = useState<string>("");
  const [resolutionRequestId, setResolutionRequestId] = useState<string>(newRequestId);

  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const resourceById = useMemo(() => new Map(resources.map((r) => [r.id, r])), [resources]);

  const openIncidents = useMemo(() => incidents.filter((i) => i.status !== "CLOSED"), [incidents]);
  const closedIncidents = useMemo(() => incidents.filter((i) => i.status === "CLOSED"), [incidents]);
  const visibleIncidents = statusFilter === "OPEN" ? openIncidents : closedIncidents;

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
        const firstOpen = overview.incidents.find((i) => i.status !== "CLOSED") ?? overview.incidents[0];
        if (firstOpen) {
          setActiveIncidentId(firstOpen.id);
          void incidentApi
            .openExistingIncident(firstOpen.id)
            .then((det) => {
              if (active) setIncidentDetails(det);
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
      setReportRequestId(newRequestId());
      setShowCreateForm(false);
      setStatusFilter("OPEN");
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
    setShowCreateForm(false);
    setActiveIncidentId(incidentId);
    setError(null);
    setInfoMsg(null);
    setPlanRequestId(newRequestId());
    setResolutionRequestId(newRequestId());
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
      setPlanRequestId(newRequestId());
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
      setResolutionRequestId(newRequestId());
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

  const activeResInfo = incidentDetails ? resourceById.get(incidentDetails.incident.resourceId) : undefined;

  return (
    <div className="space-y-4">
      <ErrorMessage error={error} />
      {infoMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {infoMsg}
        </div>
      )}

      {/* Bố cục Master–Detail 2 cột (Trái danh sách 5 | Phải xử lý / tạo mới 7) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Cột trái: Danh sách sự cố */}
        <Card className="space-y-4 lg:col-span-5">
          <div data-tour="uc11-create">
            <Button
              type="button"
              variant="primary"
              fullWidth
              onClick={() => {
                setShowCreateForm(true);
                setError(null);
                setInfoMsg(null);
              }}
            >
              + Ghi nhận sự cố mới
            </Button>
          </div>

          <div data-tour="uc11-list" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("OPEN")}
              className={`cursor-pointer rounded-xl border py-2 text-xs font-semibold transition ${
                statusFilter === "OPEN"
                  ? "border-brand bg-brand/5 text-brand dark:border-lime dark:bg-lime/10 dark:text-lime"
                  : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-white/10"
              }`}
            >
              Đang mở ({openIncidents.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("CLOSED")}
              className={`cursor-pointer rounded-xl border py-2 text-xs font-semibold transition ${
                statusFilter === "CLOSED"
                  ? "border-brand bg-brand/5 text-brand dark:border-lime dark:bg-lime/10 dark:text-lime"
                  : "border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-white/10"
              }`}
            >
              Đã đóng ({closedIncidents.length})
            </button>
          </div>

          {visibleIncidents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-200 py-10 text-center text-xs text-neutral-500 dark:border-white/10">
              {statusFilter === "OPEN" ? "Không có sự cố nào đang mở." : "Chưa có sự cố đã đóng."}
            </div>
          ) : (
            <div className="max-h-[520px] space-y-2.5 overflow-y-auto pr-0.5">
              {visibleIncidents.map((inc) => {
                const resInfo = resourceById.get(inc.resourceId);
                const isSelected = !showCreateForm && activeIncidentId === inc.id;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => void handleOpenIncident(inc.id)}
                    className={`w-full cursor-pointer space-y-1.5 rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-brand bg-emerald-50/50 dark:border-lime dark:bg-lime/10"
                        : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                    }`}
                  >
                    <p className="text-xs font-bold">
                      {resInfo ? `[${resInfo.hubName}] ${resInfo.label}` : inc.resourceId}
                    </p>
                    <p className="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">{inc.description}</p>
                    <div className="flex items-center justify-between pt-0.5">
                      <StatusBadge status={inc.status} />
                      <span className="text-[11px] font-medium text-neutral-400">
                        {inc.impactLevel} · v{inc.version}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </Card>

        {/* Cột phải: Tạo sự cố mới HOẶC Xử lý 2 bước cho sự cố đang chọn */}
        <Card className="lg:col-span-7">
          <div data-tour="uc11-detail" className="h-full">
          {showCreateForm ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-white/10">
                <h2 className="text-base font-bold">Ghi nhận sự cố mới</h2>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10"
                >
                  Đóng
                </button>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold">Tài nguyên gặp lỗi</label>
                  <select
                    value={selectedResourceId}
                    onChange={(e) => void handleSelectResource(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand dark:border-white/15 dark:bg-white/5"
                  >
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.hubName}] {r.label} — {r.status}
                      </option>
                    ))}
                  </select>
                </div>

                {resourceContext && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-neutral-100/80 px-3.5 py-2 text-xs sm:col-span-2 dark:bg-white/5">
                    <span>
                      Trạng thái: <StatusBadge status={resourceContext.resourceStatus} />
                    </span>
                    <span className="text-neutral-500">
                      Sự cố đang mở: <strong>{resourceContext.openIncidents.length}</strong>
                    </span>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold">Mức độ</label>
                  <select
                    value={impactLevel}
                    onChange={(e) => setImpactLevel(e.target.value as IncidentImpact)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-white/15 dark:bg-white/5"
                  >
                    {IMPACT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold">Phạm vi</label>
                  <input
                    type="text"
                    value={affectedScope}
                    onChange={(e) => setAffectedScope(e.target.value)}
                    placeholder="Vd: Cổng sạc số 01"
                    className="w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-white/15"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold">Mô tả tình trạng lỗi</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Nhập ngắn gọn lỗi của cổng sạc / chỗ đỗ / xe..."
                    className="w-full rounded-xl border border-neutral-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-brand dark:border-white/15"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={busy}
                  disabled={!selectedResourceId || description.trim().length < 3}
                  onClick={() => void handleReportIncident()}
                >
                  Ghi nhận &amp; Hạn chế tài nguyên
                </Button>
              </div>
            </div>
          ) : !incidentDetails ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-8 text-center dark:border-white/10">
              <p className="text-sm font-semibold">Chọn một sự cố để xử lý</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Hoặc bấm <strong>+ Ghi nhận sự cố mới</strong> ở cột bên trái.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Header sự cố */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-white/10">
                <div>
                  <h2 className="text-lg font-bold">
                    {activeResInfo
                      ? `[${activeResInfo.hubName}] ${activeResInfo.label}`
                      : incidentDetails.incident.resourceId}
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {incidentDetails.incident.description} · v{incidentDetails.incident.version}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-500/20 dark:text-red-300">
                    {incidentDetails.incident.impactLevel}
                  </span>
                  <StatusBadge status={incidentDetails.incident.status} />
                </div>
              </div>

              {/* Thanh tóm tắt ảnh hưởng 1 dòng */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/80 px-4 py-2.5 text-xs font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <span>
                  Đặt chỗ / lịch sạc bị ảnh hưởng: <strong>{incidentDetails.affectedServices.length}</strong>
                </span>
                {incidentDetails.affectedServices.length > 0 && (
                  <span className="font-mono text-[11px] opacity-80">
                    {incidentDetails.affectedServices.slice(0, 3).join(", ")}
                  </span>
                )}
              </div>

              {incidentDetails.incident.status !== "CLOSED" ? (
                <div className="space-y-4">
                  {/* Bước 1: Phương án xử lý */}
                  <div className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <h3 className="text-sm font-bold">Bước 1 · Chọn phương án xử lý</h3>
                    <select
                      value={actionType}
                      onChange={(e) => setActionType(e.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-medium outline-none focus:border-brand dark:border-white/15 dark:bg-neutral-900"
                    >
                      {ACTION_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={allocationChangesText}
                      onChange={(e) => setAllocationChangesText(e.target.value)}
                      placeholder="Ghi chú thêm (tùy chọn, mặc định tự thông báo người bị ảnh hưởng)"
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs outline-none focus:border-brand dark:border-white/15 dark:bg-neutral-900"
                    />
                    <div className="flex justify-end">
                      <Button variant="outline" loading={busy} onClick={() => void handleSubmitPlan()} className="text-xs">
                        Lưu phương án xử lý
                      </Button>
                    </div>
                  </div>

                  {/* Bước 2: Xác minh & Khôi phục */}
                  <div className="space-y-3 rounded-2xl border-2 border-brand/25 p-4 dark:border-lime/25">
                    <h3 className="text-sm font-bold">Bước 2 · Xác minh khắc phục &amp; Khôi phục</h3>
                    <input
                      type="text"
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="Nhập minh chứng kỹ thuật (vd: Đã thay CB, đo điện áp ổn định 220V)..."
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs outline-none focus:border-brand dark:border-white/15 dark:bg-white/5"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={isResolved}
                          onChange={(e) => setIsResolved(e.target.checked)}
                          className="rounded border-neutral-300"
                        />
                        <span>Đã khắc phục xong, mở lại tài nguyên</span>
                      </label>
                      <Button
                        variant="primary"
                        loading={busy}
                        disabled={!evidence.trim()}
                        onClick={() => void handleVerifyResolution()}
                        className="text-xs"
                      >
                        {isResolved ? "Đóng sự cố & Khôi phục" : "Lưu tiến độ"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <p className="font-bold">✓ Sự cố đã đóng và tài nguyên đã khôi phục</p>
                  {incidentDetails.incident.resolutionNote && (
                    <p className="mt-1 opacity-90">{incidentDetails.incident.resolutionNote}</p>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </Card>
      </div>
    </div>
  );
}
