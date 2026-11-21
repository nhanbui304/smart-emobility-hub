// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network & Mục 2.3.3
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { incidentApi } from "../../api/incident";
import { monitoringApi } from "../../api/monitoring";
import { Button } from "../../components/Button";
import { CampusHubMap } from "../../components/CampusHubMap";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type { AlertDto, AlertType, HubStatus, VehicleStatus } from "../../types";

type AlertFilter = "ALL" | AlertType;
type VehicleFilter = "ALL" | VehicleStatus;
type ResourceFilter = "ALL" | "SHARED_VEHICLE" | "RESERVATIONS";

export function MonitoringPage() {
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("ALL");
  const [hubSearch, setHubSearch] = useState<string>("");
  const [onlyAlertedHubs, setOnlyAlertedHubs] = useState<boolean>(false);
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>("ALL");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("ALL");
  const detailSectionRef = useRef<HTMLDivElement | null>(null);

  const { data: incidentOverview } = useAsync(() => incidentApi.listOverview(), [], {
    refreshEveryMs: 10000,
  });

  const {
    data: overview,
    loading,
    error,
    lastLoadedAt,
    reload,
  } = useAsync(() => monitoringApi.overview(), [], {
    refreshEveryMs: 3000,
  });

  const {
    data: hubDetail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useAsync(
    () => (selectedHubId ? monitoringApi.hubDetail(selectedHubId) : Promise.resolve(null)),
    [selectedHubId],
    { refreshEveryMs: 3000 },
  );

  const hubs = overview?.hubs ?? [];
  const activeAlerts = overview?.activeAlerts ?? [];
  const connected = !error;

  const hubNameById = new Map<string, string>(hubs.map((h) => [h.id, h.name]));
  const alertsByHubId = new Map<string, AlertDto[]>();
  for (const a of activeAlerts) {
    const list = alertsByHubId.get(a.hubId) ?? [];
    list.push(a);
    alertsByHubId.set(a.hubId, list);
  }

  const totals = hubs.reduce(
    (acc, h) => ({
      vehicles: acc.vehicles + h.availableVehicles,
      totalVehicles: acc.totalVehicles + h.totalVehicles,
      slots: acc.slots + h.freeSlots,
      totalSlots: acc.totalSlots + h.totalSlots,
      ports: acc.ports + h.freeChargingPorts,
      totalPorts: acc.totalPorts + h.totalChargingPorts,
    }),
    { vehicles: 0, totalVehicles: 0, slots: 0, totalSlots: 0, ports: 0, totalPorts: 0 },
  );

  const filteredAlerts =
    alertFilter === "ALL" ? activeAlerts : activeAlerts.filter((a) => a.type === alertFilter);

  const filteredHubs = hubs.filter((h) => {
    const matchesSearch =
      hubSearch.trim() === "" ||
      h.name.toLowerCase().includes(hubSearch.toLowerCase()) ||
      h.location.toLowerCase().includes(hubSearch.toLowerCase());
    const hasAlert = (alertsByHubId.get(h.id)?.length ?? 0) > 0;
    return matchesSearch && (!onlyAlertedHubs || hasAlert);
  });

  const filteredDetailVehicles = (hubDetail?.vehicles ?? []).filter(
    (v) => vehicleFilter === "ALL" || v.status === vehicleFilter,
  );

  const selectedHub = selectedHubId ? hubs.find((h) => h.id === selectedHubId) ?? null : null;
  const selectedHubAlerts = selectedHubId ? (alertsByHubId.get(selectedHubId) ?? []) : [];
  const selectedHubOpenIncidents = (() => {
    if (!selectedHub || !incidentOverview) return [];
    const resourceById = new Map(incidentOverview.resources.map((r) => [r.id, r]));
    return incidentOverview.incidents
      .filter((inc) => {
        if (inc.status === "CLOSED") return false;
        const res = resourceById.get(inc.resourceId);
        return res?.hubName === selectedHub.name;
      })
      .map((inc) => ({
        incident: inc,
        resourceLabel: resourceById.get(inc.resourceId)?.label ?? inc.resourceId,
      }));
  })();
  const selectedHubMaintenanceVehicles = (hubDetail?.vehicles ?? []).filter(
    (v) => v.status === "UNDER_MAINTENANCE",
  );

  const handleRefresh = () => {
    void reload();
    if (selectedHubId) void reloadDetail();
  };

  const scrollToDetail = () => {
    detailSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-5">
      {/* Header tối giản */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Giám sát mạng lưới</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${connected
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-lime"
              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
              }`}
          >
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500 dark:bg-lime" : "bg-red-500"}`} />
            {connected ? "Live · 3s" : "Mất kết nối"}
          </span>
          {lastLoadedAt && (
            <span className="text-xs tabular-nums text-neutral-400">
              {lastLoadedAt.toLocaleTimeString("vi-VN")}
            </span>
          )}
        </div>
        <Button variant="outline" onClick={handleRefresh} loading={loading} className="px-4 py-2 text-xs">
          Làm mới
        </Button>
      </header>

      {/* Cảnh báo lỗi kết nối nhưng vẫn giữ dữ liệu gần nhất */}
      {Boolean(error) && overview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>
            <strong>Không thể làm mới dữ liệu.</strong> Đang hiển thị bản lúc{" "}
            {lastLoadedAt ? lastLoadedAt.toLocaleTimeString("vi-VN") : "trước đó"}.
          </span>
          <Button variant="outline" onClick={handleRefresh} className="px-3 py-1 text-xs">
            Thử lại
          </Button>
        </div>
      )}

      {loading && !overview && <Spinner />}
      {!overview && <ErrorMessage error={error} onRetry={handleRefresh} />}

      {overview && (
        <>
          {/* 4 thẻ KPI gọn 1 hàng */}
          <div data-tour="op-kpi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi tone="highlight" label="Xe sẵn sàng" value={`${totals.vehicles}`} sub={`/ ${totals.totalVehicles} xe`} />
            <Kpi label="Chỗ đỗ trống" value={`${totals.slots}`} sub={`/ ${totals.totalSlots} chỗ`} />
            <Kpi label="Cổng sạc rảnh" value={`${totals.ports}`} sub={`/ ${totals.totalPorts} cổng`} />
            <Kpi
              tone={activeAlerts.length > 0 ? "warn" : "default"}
              label="Cảnh báo mở"
              value={`${activeAlerts.length}`}
              sub={activeAlerts.length > 0 ? `${alertsByHubId.size} Hub cần chú ý` : "Tất cả ổn định"}
            />
          </div>

          {/* Bản đồ 5 Hub + Thanh tra nhanh Hub & Sự cố dính liền bên phải */}
          <div className="grid gap-5 lg:grid-cols-12">
            <Card className="space-y-3 p-4 lg:col-span-7 xl:col-span-8">
              <div data-tour="op-map" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">Bản đồ 5 Mobility Hub — ĐHQG-HCM</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Vàng = Có cảnh báo · Bấm để xem
                  </span>
                </div>
                <CampusHubMap
                  hubs={hubs}
                  selectedHubId={selectedHubId}
                  onSelectHub={(id) => setSelectedHubId(id)}
                  mode="operator"
                  alertCountByHubId={new Map([...alertsByHubId.entries()].map(([k, list]) => [k, list.length]))}
                  className="h-[370px] w-full"
                />
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 lg:col-span-5 xl:col-span-4">
              <div data-tour="op-inspector" className="flex h-full flex-col justify-between">
              {!selectedHub ? (
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                        Xem nhanh Hub
                      </p>
                      <h3 className="mt-0.5 text-base font-bold">
                        {activeAlerts.length > 0 ? `${activeAlerts.length} cảnh báo cần chú ý` : "Mạng lưới ổn định"}
                      </h3>
                    </div>

                    {activeAlerts.length > 0 ? (
                      <div className="space-y-2">
                        {Array.from(alertsByHubId.entries()).map(([hId, list]) => (
                          <button
                            key={hId}
                            type="button"
                            onClick={() => setSelectedHubId(hId)}
                            className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-amber-300/80 bg-amber-50/70 px-3.5 py-2.5 text-left text-xs transition hover:bg-amber-100/80 dark:border-amber-400/25 dark:bg-amber-500/10 dark:hover:bg-amber-500/20"
                          >
                            <span className="font-semibold">{hubNameById.get(hId) ?? hId}</span>
                            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
                              {list.length} cảnh báo →
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-xs text-neutral-500 dark:border-white/10">
                        Bấm vào bất kỳ Hub nào trên bản đồ để kiểm tra nhanh xe, chỗ đỗ và cổng sạc.
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400">Chọn một pin trên bản đồ để mở chi tiết.</p>
                </div>
              ) : (
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="max-h-[310px] space-y-3 overflow-y-auto pr-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold">{selectedHub.name}</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{selectedHub.location}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHubId(null)}
                        className="cursor-pointer rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10"
                        aria-label="Đóng xem nhanh"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-neutral-100/80 px-2 py-2.5 dark:bg-white/5">
                        <p className="text-[11px] text-neutral-500">Xe sẵn sàng</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {selectedHub.availableVehicles}/{selectedHub.totalVehicles}
                        </p>
                      </div>
                      <div className="rounded-xl bg-neutral-100/80 px-2 py-2.5 dark:bg-white/5">
                        <p className="text-[11px] text-neutral-500">Chỗ trống</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {selectedHub.freeSlots}/{selectedHub.totalSlots}
                        </p>
                      </div>
                      <div className="rounded-xl bg-neutral-100/80 px-2 py-2.5 dark:bg-white/5">
                        <p className="text-[11px] text-neutral-500">Cổng sạc</p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums">
                          {selectedHub.freeChargingPorts}/{selectedHub.totalChargingPorts}
                        </p>
                      </div>
                    </div>

                    {selectedHubAlerts.length === 0 ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Không có cảnh báo tại Hub này.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedHubAlerts.map((a) => (
                          <div
                            key={a.id}
                            className="space-y-1 rounded-xl border border-amber-300/80 bg-amber-50/80 p-3 text-xs dark:border-amber-400/25 dark:bg-amber-500/10"
                          >
                            <StatusBadge status={a.type} />
                            <p className="text-neutral-700 dark:text-neutral-200">{describeAlert(a)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedHubOpenIncidents.map(({ incident, resourceLabel }) => (
                      <div
                        key={incident.id}
                        className="rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs dark:border-red-500/25 dark:bg-red-500/10"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-red-900 dark:text-red-200">{resourceLabel}</span>
                          <StatusBadge status={incident.status} />
                        </div>
                        <p className="mt-0.5 text-red-800/90 dark:text-red-200/80">{incident.description}</p>
                      </div>
                    ))}

                    {selectedHubMaintenanceVehicles.length > 0 && (
                      <div className="rounded-xl border border-neutral-200 px-3 py-2.5 text-xs dark:border-white/10">
                        <p className="font-medium text-neutral-500">
                          Xe bảo trì ({selectedHubMaintenanceVehicles.length}):
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {selectedHubMaintenanceVehicles.map((v) => (
                            <span
                              key={v.id}
                              className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
                            >
                              {v.code} · {v.batteryLevel}%
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 border-t border-neutral-200/80 pt-3 dark:border-white/10">
                    {(selectedHubAlerts.some((a) => a.type === "RESOURCE_FAULT") ||
                      selectedHubOpenIncidents.length > 0 ||
                      selectedHubMaintenanceVehicles.length > 0) && (
                        <Link
                          to="/operator/charging-incidents?tab=incidents"
                          className="inline-flex flex-1 items-center justify-center rounded-xl border border-amber-400/70 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200"
                        >
                          Xử lý sự cố
                        </Link>
                      )}
                    {selectedHubAlerts.some((a) => a.type === "LOW_VEHICLE" || a.type === "NEAR_FULL") && (
                      <Link
                        to="/operator/redistribution"
                        className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark"
                      >
                        Điều chuyển xe
                      </Link>
                    )}
                    <Button variant="outline" onClick={scrollToDetail} className="w-full py-2 text-xs">
                      Xem toàn bộ xe &amp; đặt chỗ ↓
                    </Button>
                  </div>
                </div>
              )}
              </div>
            </Card>
          </div>

          {/* Cảnh báo vận hành — chỉ mở rộng khi có cảnh báo */}
          {activeAlerts.length > 0 && (
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Cảnh báo đang mở ({activeAlerts.length})</h2>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "ALL", label: "Tất cả" },
                      { key: "LOW_VEHICLE", label: "Thiếu xe" },
                      { key: "NEAR_FULL", label: "Sắp đầy" },
                      { key: "RESOURCE_FAULT", label: "Lỗi tài nguyên" },
                      { key: "DATA_STALE", label: "Dữ liệu cũ" },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setAlertFilter(tab.key)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition ${alertFilter === tab.key
                        ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAlerts.length === 0 ? (
                <p className="py-3 text-center text-xs text-neutral-500">Không có cảnh báo thuộc nhóm này.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredAlerts.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      hubName={hubNameById.get(alert.hubId) ?? alert.hubId}
                      onSelectHub={() => setSelectedHubId(alert.hubId)}
                    />
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Bảng tổng quan 5 Hub gọn gàng */}
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-sm font-bold">Tổng quan 5 Hub</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={hubSearch}
                  onChange={(e) => setHubSearch(e.target.value)}
                  placeholder="Tìm Hub..."
                  className="w-48 rounded-xl border border-neutral-200 bg-transparent px-3 py-1.5 text-xs outline-none focus:border-brand dark:border-white/15 dark:focus:border-lime"
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={onlyAlertedHubs}
                    onChange={(e) => setOnlyAlertedHubs(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Chỉ Hub có cảnh báo
                </label>
              </div>
            </div>

            {filteredHubs.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Không tìm thấy Hub phù hợp"
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setHubSearch("");
                        setOnlyAlertedHubs(false);
                      }}
                    >
                      Đặt lại
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-y border-neutral-200/80 bg-neutral-50/70 text-[11px] uppercase tracking-wider text-neutral-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-neutral-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Hub</th>
                      <th className="px-5 py-3 font-semibold">Xe sẵn sàng</th>
                      <th className="px-5 py-3 font-semibold">Chỗ trống</th>
                      <th className="px-5 py-3 font-semibold">Cổng sạc</th>
                      <th className="px-5 py-3 font-semibold">Pin TB</th>
                      <th className="px-5 py-3 font-semibold">Trạng thái</th>
                      <th className="px-5 py-3 text-right font-semibold">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
                    {filteredHubs.map((h) => (
                      <HubRow
                        key={h.id}
                        hub={h}
                        alerts={alertsByHubId.get(h.id) ?? []}
                        selected={selectedHubId === h.id}
                        onSelect={() => setSelectedHubId(selectedHubId === h.id ? null : h.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Chi tiết đầy đủ của Hub đang chọn */}
          {selectedHubId && (
            <div ref={detailSectionRef}>
              <Card className="space-y-4 border-brand/30 dark:border-lime/30">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 pb-3 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">
                      Tài nguyên tại {hubDetail?.name ?? hubNameById.get(selectedHubId)}
                    </h2>
                    {hubDetail?.isDataStale && <StatusBadge status="DATA_STALE" label="Dữ liệu cũ" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { key: "ALL", label: "Tất cả" },
                        { key: "SHARED_VEHICLE", label: "Xe dùng chung" },
                        { key: "RESERVATIONS", label: "Đặt chỗ & Sạc" },
                      ] as const
                    ).map((rf) => (
                      <button
                        key={rf.key}
                        type="button"
                        onClick={() => setResourceFilter(rf.key)}
                        className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition ${resourceFilter === rf.key
                          ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                          }`}
                      >
                        {rf.label}
                      </button>
                    ))}
                    <Button variant="ghost" onClick={() => setSelectedHubId(null)} className="px-2.5 py-1 text-xs">
                      Đóng
                    </Button>
                  </div>
                </div>

                {detailLoading && !hubDetail && <Spinner />}
                <ErrorMessage
                  error={detailError}
                  onRetry={() => {
                    void reload();
                    void reloadDetail();
                  }}
                />

                {hubDetail && (
                  <div className="space-y-5">
                    {(resourceFilter === "ALL" || resourceFilter === "SHARED_VEHICLE") && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Xe tại Hub ({filteredDetailVehicles.length}/{hubDetail.vehicles.length})
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {(
                              [
                                { key: "ALL", label: "Tất cả" },
                                { key: "AVAILABLE", label: "Sẵn sàng" },
                                { key: "CHARGING", label: "Đang sạc" },
                                { key: "RESERVED", label: "Đã đặt" },
                                { key: "UNDER_MAINTENANCE", label: "Bảo trì" },
                              ] as const
                            ).map((vf) => (
                              <button
                                key={vf.key}
                                type="button"
                                onClick={() => setVehicleFilter(vf.key)}
                                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium transition ${vehicleFilter === vf.key
                                  ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                                  }`}
                              >
                                {vf.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {filteredDetailVehicles.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-neutral-200 py-4 text-center text-xs text-neutral-500 dark:border-white/10">
                            Không có xe khớp trạng thái.
                          </p>
                        ) : (
                          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredDetailVehicles.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center justify-between rounded-xl border border-neutral-200/80 px-3.5 py-2.5 text-sm dark:border-white/10"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold">{v.code}</span>
                                    <span className="text-[11px] text-neutral-400">
                                      {v.type === "E_BIKE" ? "Xe đạp" : "Xe máy"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    Pin <strong className="tabular-nums">{v.batteryLevel}%</strong>
                                  </p>
                                </div>
                                <StatusBadge status={v.status} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {(resourceFilter === "ALL" || resourceFilter === "RESERVATIONS") && (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border border-neutral-200/80 p-3.5 dark:border-white/10">
                          <p className="text-xs text-neutral-500">Đặt xe đang giữ</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums">
                            {hubDetail.reservations.vehicleReservations.length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-neutral-200/80 p-3.5 dark:border-white/10">
                          <p className="text-xs text-neutral-500">Chỗ đỗ đang giữ / đặt</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums">
                            {hubDetail.reservations.parkingAllocations.length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-neutral-200/80 p-3.5 dark:border-white/10">
                          <p className="text-xs text-neutral-500">Lịch sạc xe cá nhân</p>
                          <p className="mt-1 text-2xl font-bold tabular-nums">
                            {hubDetail.reservations.chargingReservations.length}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "highlight" | "warn";
}) {
  if (tone === "warn") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-400/30 dark:bg-amber-500/10">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{label}</p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-amber-900 dark:text-amber-200">{value}</span>
          <span className="text-xs text-amber-700/80 dark:text-amber-300/80">{sub}</span>
        </div>
      </div>
    );
  }
  return (
    <Card tone={tone === "highlight" ? "highlight" : "default"} className="p-4">
      <p className={`text-xs font-medium ${tone === "highlight" ? "text-white/75" : "text-neutral-500 dark:text-neutral-400"}`}>
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-3xl font-bold tabular-nums ${tone === "highlight" ? "text-lime" : ""}`}>{value}</span>
        <span className={`text-xs ${tone === "highlight" ? "text-white/65" : "text-neutral-500 dark:text-neutral-400"}`}>
          {sub}
        </span>
      </div>
    </Card>
  );
}

function describeAlert(alert: AlertDto): string {
  if (alert.type === "LOW_VEHICLE") {
    return `Còn ${alert.value} xe khả dụng (ngưỡng ≤ ${alert.threshold} xe).`;
  }
  if (alert.type === "NEAR_FULL") {
    const windowStr = alert.evaluationWindow
      ? ` (${new Date(alert.evaluationWindow.startTime).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })}–${new Date(alert.evaluationWindow.endTime).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })})`
      : "";
    return `Còn ${alert.value} chỗ trống (ngưỡng ≤ ${alert.threshold})${windowStr}.`;
  }
  if (alert.type === "RESOURCE_FAULT") {
    return `${alert.value} tài nguyên đang lỗi / bảo trì.`;
  }
  if (alert.type === "DATA_STALE") {
    return `Chưa cập nhật ${alert.value}s (ngưỡng ${alert.threshold}s).`;
  }
  return "";
}

function AlertCard({
  alert,
  hubName,
  onSelectHub,
}: {
  alert: AlertDto;
  hubName: string;
  onSelectHub: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/60 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-500/5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={alert.type} />
          <span className="text-sm font-semibold">{hubName}</span>
        </div>
        <p className="text-xs text-neutral-700 dark:text-neutral-300">{describeAlert(alert)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelectHub}
          className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100 dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10"
        >
          Xem Hub
        </button>
        {(alert.type === "LOW_VEHICLE" || alert.type === "NEAR_FULL") && (
          <Link
            to="/operator/redistribution"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark"
          >
            Điều chuyển
          </Link>
        )}
        {alert.type === "RESOURCE_FAULT" && (
          <Link
            to="/operator/charging-incidents?tab=incidents"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark"
          >
            Xử lý
          </Link>
        )}
      </div>
    </div>
  );
}

function HubRow({
  hub,
  alerts,
  selected,
  onSelect,
}: {
  hub: HubStatus;
  alerts: AlertDto[];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-white/5 ${selected ? "bg-brand/5 dark:bg-lime/5" : ""
        }`}
    >
      <td className="px-5 py-3">
        <p className="font-semibold">{hub.name}</p>
      </td>
      <td className="px-5 py-3 font-semibold tabular-nums">
        {hub.availableVehicles}/{hub.totalVehicles}
      </td>
      <td className="px-5 py-3 tabular-nums">
        {hub.freeSlots}/{hub.totalSlots}
      </td>
      <td className="px-5 py-3 tabular-nums">
        {hub.freeChargingPorts}/{hub.totalChargingPorts}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand dark:bg-lime" style={{ width: `${hub.averageBattery}%` }} />
          </div>
          <span className="text-xs tabular-nums">{hub.averageBattery}%</span>
        </div>
      </td>
      <td className="px-5 py-3">
        {alerts.length === 0 ? (
          <StatusBadge status="IN_SERVICE" label="Ổn định" />
        ) : (
          <div className="flex flex-wrap gap-1">
            {alerts.map((a) => (
              <StatusBadge key={a.id} status={a.type} />
            ))}
          </div>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <span className="text-xs font-semibold text-brand dark:text-lime">
          {selected ? "Đang xem" : "Xem →"}
        </span>
      </td>
    </tr>
  );
}
