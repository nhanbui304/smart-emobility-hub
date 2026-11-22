// Owner: Ngô Minh Triết – UC11 Handle Operational Incident
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

function isFaultyStatus(status: string): boolean {
  return status === "UNDER_MAINTENANCE" || status === "OUT_OF_SERVICE";
}

export function IncidentManagementPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const contextHubId = searchParams.get("hubId");
  const contextIncidentId = searchParams.get("incidentId");
  const contextResourceId = searchParams.get("resourceId");

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [resources, setResources] = useState<IncidentResourceOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED">("OPEN");
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [chosenFaultResourceId, setChosenFaultResourceId] = useState<string>("");

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

  const contextHubName = useMemo(() => {
    if (!contextHubId) return null;
    return resources.find((r) => r.hubId === contextHubId)?.hubName ?? contextHubId;
  }, [contextHubId, resources]);

  const scopedResources = useMemo(
    () => (contextHubId ? resources.filter((r) => r.hubId === contextHubId) : resources),
    [contextHubId, resources],
  );

  const scopedIncidents = useMemo(() => {
    if (!contextHubId) return incidents;
    return incidents.filter((inc) => resourceById.get(inc.resourceId)?.hubId === contextHubId);
  }, [contextHubId, incidents, resourceById]);

  const openIncidents = useMemo(() => scopedIncidents.filter((i) => i.status !== "CLOSED"), [scopedIncidents]);
  const closedIncidents = useMemo(() => scopedIncidents.filter((i) => i.status === "CLOSED"), [scopedIncidents]);
  const visibleIncidents = statusFilter === "OPEN" ? openIncidents : closedIncidents;

  // Các tài nguyên lỗi/bảo trì thuộc Hub ngữ cảnh nhưng chưa có hồ sơ sự cố mở nào
  const faultyWithoutOpenIncident = useMemo(() => {
    const openResIds = new Set(incidents.filter((i) => i.status !== "CLOSED").map((i) => i.resourceId));
    return scopedResources.filter((r) => isFaultyStatus(r.status) && !openResIds.has(r.id));
  }, [incidents, scopedResources]);

  // Sắp xếp dropdown tài nguyên: đưa tài nguyên lỗi/bảo trì lên đầu để dễ chọn
  const orderedFormResources = useMemo(() => {
    const base = scopedResources.length > 0 ? scopedResources : resources;
    return [...base].sort((a, b) => Number(isFaultyStatus(b.status)) - Number(isFaultyStatus(a.status)));
  }, [scopedResources, resources]);

  function clearHubContext() {
    const next = new URLSearchParams(searchParams);
    next.delete("hubId");
    next.delete("incidentId");
    next.delete("resourceId");
    setSearchParams(next, { replace: true });
  }

  async function loadResourceContext(resId: string) {
    setSelectedResourceId(resId);
    setResourceContext(null);
    if (!resId) return;
    try {
      const ctx = await incidentApi.openIncidentManagement(resId);
      setResourceContext(ctx);
    } catch (err) {
      setError(err);
    }
  }

  async function refreshOverview(keepIncidentId?: string) {
    const overview = await incidentApi.listOverview();
    setIncidents(overview.incidents);
    setResources(overview.resources);
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
    setError(null);
    void incidentApi
      .listOverview()
      .then((overview) => {
        if (!active) return;
        setIncidents(overview.incidents);
        setResources(overview.resources);

        const resMap = new Map(overview.resources.map((r) => [r.id, r]));
        const inHubResources = contextHubId
          ? overview.resources.filter((r) => r.hubId === contextHubId)
          : overview.resources;
        const inHubIncidents = contextHubId
          ? overview.incidents.filter((inc) => resMap.get(inc.resourceId)?.hubId === contextHubId)
          : overview.incidents;
        const openInScope = inHubIncidents.filter((inc) => inc.status !== "CLOSED");

        // Xác định tài nguyên mặc định cho form tạo mới (ưu tiên resourceId từ URL -> tài nguyên lỗi trong Hub -> đầu danh sách)
        const faultyInScope = inHubResources.filter((r) => isFaultyStatus(r.status));
        const defaultResId =
          (contextResourceId && resMap.has(contextResourceId) ? contextResourceId : "") ||
          faultyInScope[0]?.id ||
          inHubResources[0]?.id ||
          overview.resources[0]?.id ||
          "";

        setChosenFaultResourceId(
          (contextResourceId && faultyInScope.some((r) => r.id === contextResourceId) ? contextResourceId : "") ||
            faultyInScope[0]?.id ||
            "",
        );
        setSelectedResourceId(defaultResId);
        if (defaultResId) {
          void incidentApi
            .openIncidentManagement(defaultResId)
            .then((ctx) => {
              if (active) setResourceContext(ctx);
            })
            .catch(() => undefined);
        }

        // Chỉ mở mặc định hồ sơ ĐANG MỞ trong đúng ngữ cảnh (hoặc đúng incidentId đang mở).
        // KHÔNG bao giờ tự chọn sự cố đã đóng hoặc sự cố của Hub khác làm chi tiết mặc định!
        const requestedOpen = contextIncidentId
          ? openInScope.find((inc) => inc.id === contextIncidentId)
          : undefined;
        const defaultOpen = requestedOpen ?? openInScope[0];

        if (defaultOpen) {
          setShowCreateForm(false);
          setStatusFilter("OPEN");
          setActiveIncidentId(defaultOpen.id);
          void incidentApi
            .openExistingIncident(defaultOpen.id)
            .then((det) => {
              if (active) setIncidentDetails(det);
            })
            .catch(() => undefined);
        } else {
          setShowCreateForm(false);
          setStatusFilter("OPEN");
          setActiveIncidentId("");
          setIncidentDetails(null);
        }
      })
      .catch((err) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, [contextHubId, contextIncidentId, contextResourceId]);

  async function handleSelectResource(resId: string) {
    setError(null);
    await loadResourceContext(resId);
  }

  function openCreateWithResource(resId?: string) {
    setShowCreateForm(true);
    setError(null);
    setInfoMsg(null);
    setReportRequestId(newRequestId());
    const targetId = resId || chosenFaultResourceId || orderedFormResources[0]?.id || "";
    if (targetId) {
      const targetRes = resourceById.get(targetId);
      if (targetRes) {
        setAffectedScope(`${targetRes.label} tại ${targetRes.hubName}`);
      }
      void loadResourceContext(targetId);
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
      await loadResourceContext(selectedResourceId);
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
        await loadResourceContext(selectedResourceId);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const activeResInfo = incidentDetails ? resourceById.get(incidentDetails.incident.resourceId) : undefined;
  const activeIncidentMatchesScope =
    !incidentDetails || !contextHubId || activeResInfo?.hubId === contextHubId;
  const displayedDetails = activeIncidentMatchesScope ? incidentDetails : null;

  return (
    <div className="space-y-4">
      {/* Banner ngữ cảnh khi đi từ cảnh báo Giám sát mạng lưới */}
      {contextHubId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/75 px-4 py-3 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div>
            <p className="font-bold">Ngữ cảnh xử lý từ Giám sát: {contextHubName}</p>
            <p className="mt-0.5 opacity-85">
              {openIncidents.length > 0
                ? `Đang có ${openIncidents.length} hồ sơ sự cố mở tại ${contextHubName}.`
                : faultyWithoutOpenIncident.length > 0
                  ? `Phát hiện ${faultyWithoutOpenIncident.length} tài nguyên đang lỗi/bảo trì nhưng chưa có hồ sơ sự cố UC11.`
                  : `Hiện không còn sự cố mở hoặc tài nguyên lỗi tại ${contextHubName}.`}
            </p>
          </div>
          <Button variant="outline" onClick={clearHubContext} className="px-3 py-1.5 text-xs">
            Xem tất cả Hub
          </Button>
        </div>
      )}

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
              onClick={() => openCreateWithResource()}
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
              <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-8 text-center text-xs text-neutral-500 dark:border-white/10">
                {statusFilter === "OPEN"
                  ? contextHubName
                    ? `Chưa có hồ sơ sự cố nào đang mở tại ${contextHubName}.`
                    : "Không có sự cố nào đang mở."
                  : contextHubName
                    ? `Chưa có sự cố đã đóng tại ${contextHubName}.`
                    : "Chưa có sự cố đã đóng."}
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

        {/* Cột phải: Tạo sự cố mới HOẶC Xử lý sự cố đang chọn HOẶC Danh sách tài nguyên lỗi chưa có hồ sơ */}
        <Card className="lg:col-span-7">
          <div data-tour="uc11-detail" className="h-full">
            {showCreateForm ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-white/10">
                  <h2 className="text-base font-bold">
                    Ghi nhận sự cố mới{contextHubName ? ` — ${contextHubName}` : ""}
                  </h2>
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
                      {orderedFormResources.map((r) => (
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
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand dark:border-white/15 dark:bg-white/5"
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
            ) : displayedDetails || faultyWithoutOpenIncident.length > 0 ? (
              <div className="space-y-6">
                {displayedDetails && (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200/80 pb-4 dark:border-white/10">
                      <div>
                        <h2 className="text-lg font-bold">
                          {activeResInfo
                            ? `[${activeResInfo.hubName}] ${activeResInfo.label}`
                            : displayedDetails.incident.resourceId}
                        </h2>
                        <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                          {displayedDetails.incident.description} · v{displayedDetails.incident.version}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold text-red-800 dark:bg-red-500/20 dark:text-red-300">
                          {displayedDetails.incident.impactLevel}
                        </span>
                        <StatusBadge status={displayedDetails.incident.status} />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50/80 px-4 py-2.5 text-xs font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      <span>
                        Đặt chỗ / lịch sạc bị ảnh hưởng: <strong>{displayedDetails.affectedServices.length}</strong>
                      </span>
                      {displayedDetails.affectedServices.length > 0 && (
                        <span className="font-mono text-[11px] opacity-80">
                          {displayedDetails.affectedServices.slice(0, 3).join(", ")}
                        </span>
                      )}
                    </div>

                    {displayedDetails.incident.status !== "CLOSED" ? (
                      <div className="space-y-4">
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
                        {displayedDetails.incident.resolutionNote && (
                          <p className="mt-1 opacity-90">{displayedDetails.incident.resolutionNote}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {faultyWithoutOpenIncident.length > 0 && (
                  /* Hiển thị độc lập các tài nguyên đang lỗi/bảo trì chưa có hồ sơ sự cố UC11 để không bị che khi Hub đã có sự cố mở khác */
                  <div
                    className={`space-y-4 ${
                      displayedDetails ? "border-t border-neutral-200/80 pt-5 dark:border-white/10" : ""
                    }`}
                  >
                    <div className="border-b border-neutral-200/80 pb-3 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Cảnh báo tài nguyên lỗi chưa có hồ sơ sự cố
                      </p>
                      <h2 className="mt-0.5 text-base font-bold">
                        {contextHubName
                          ? `Tài nguyên lỗi / bảo trì tại ${contextHubName} (${faultyWithoutOpenIncident.length})`
                          : `Tài nguyên đang lỗi / bảo trì chưa ghi nhận sự cố (${faultyWithoutOpenIncident.length})`}
                      </h2>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        Chọn đúng tài nguyên bên dưới và bấm <strong>Ghi nhận sự cố</strong> để tạo hồ sơ UC11 (hệ thống không tự tạo hồ sơ).
                      </p>
                    </div>

                    <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                      {faultyWithoutOpenIncident.map((res) => {
                        const selected = (chosenFaultResourceId || faultyWithoutOpenIncident[0]?.id) === res.id;
                        return (
                          <button
                            key={res.id}
                            type="button"
                            onClick={() => setChosenFaultResourceId(res.id)}
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left text-xs transition ${
                              selected
                                ? "border-brand bg-emerald-50/60 dark:border-lime dark:bg-lime/10"
                                : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5"
                            }`}
                          >
                            <div>
                              <p className="font-bold">
                                [{res.hubName}] {res.label}
                              </p>
                              <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                                Chưa có hồ sơ sự cố UC11 đang mở
                              </p>
                            </div>
                            <StatusBadge status={res.status} />
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200/80 pt-3 dark:border-white/10">
                      <Button
                        variant="primary"
                        onClick={() => openCreateWithResource(chosenFaultResourceId || faultyWithoutOpenIncident[0]?.id)}
                      >
                        Ghi nhận sự cố cho tài nguyên đã chọn
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 p-8 text-center dark:border-white/10">
                <p className="text-sm font-semibold">
                  {contextHubName
                    ? `Không có sự cố đang mở tại ${contextHubName}`
                    : "Chưa chọn hồ sơ sự cố nào"}
                </p>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  Chọn một sự cố trong danh sách bên trái, hoặc bấm <strong>+ Ghi nhận sự cố mới</strong> để tạo hồ sơ mới.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
