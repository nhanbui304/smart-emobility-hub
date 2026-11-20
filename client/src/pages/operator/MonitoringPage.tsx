// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network & Mục 2.3.3
// Giao diện Giám sát mạng lưới Hub cho Operator:
// - Tự động gọi monitoringApi.overview() mỗi 3 giây (NFR 3.1: phản ánh trạng thái <= 3 giây).
// - Hiển thị cảnh báo theo ngưỡng (LOW_VEHICLE, NEAR_FULL kèm evaluationWindow, RESOURCE_FAULT, DATA_STALE).
// - Hỗ trợ lọc theo loại cảnh báo, lọc Hub, lọc tài nguyên và xem chi tiết từng Hub (monitoringApi.hubDetail).
import { useState } from "react";
import { Link } from "react-router-dom";
import { monitoringApi } from "../../api/monitoring";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
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

  // UC10 bước 2 & 7: Tải trạng thái mạng lưới và làm mới tự động mỗi 3 giây
  const {
    data: overview,
    loading,
    error,
    lastLoadedAt,
    reload,
  } = useAsync(() => monitoringApi.overview(), [], {
    refreshEveryMs: 3000,
  });

  // UC10 bước 5–6: Tải chi tiết Hub khi Operator chọn một Hub
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

  // Map hubId -> tên Hub và danh sách cảnh báo của từng Hub
  const hubNameById = new Map<string, string>(hubs.map((h) => [h.id, h.name]));
  const alertsByHubId = new Map<string, AlertDto[]>();
  for (const a of activeAlerts) {
    const list = alertsByHubId.get(a.hubId) ?? [];
    list.push(a);
    alertsByHubId.set(a.hubId, list);
  }

  // Tổng hợp KPI toàn mạng lưới
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

  // UC10 bước 5: Lọc danh sách cảnh báo theo loại (MonitoringView.filterAlerts)
  const filteredAlerts =
    alertFilter === "ALL" ? activeAlerts : activeAlerts.filter((a) => a.type === alertFilter);

  // UC10 bước 5: Lọc danh sách Hub
  const filteredHubs = hubs.filter((h) => {
    const matchesSearch =
      hubSearch.trim() === "" ||
      h.name.toLowerCase().includes(hubSearch.toLowerCase()) ||
      h.location.toLowerCase().includes(hubSearch.toLowerCase());
    const hasAlert = (alertsByHubId.get(h.id)?.length ?? 0) > 0;
    return matchesSearch && (!onlyAlertedHubs || hasAlert);
  });

  // Lọc danh sách xe trong chi tiết Hub (MonitoringView.filterResources)
  const filteredDetailVehicles = (hubDetail?.vehicles ?? []).filter(
    (v) => vehicleFilter === "ALL" || v.status === vehicleFilter,
  );

  const handleRefresh = () => {
    void reload();
    if (selectedHubId) void reloadDetail();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giám sát mạng lưới"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge
              status={connected ? "ACTIVE" : "OUT_OF_SERVICE"}
              label={connected ? "Tự cập nhật mỗi 3 giây" : "Lỗi làm mới – Đang giữ dữ liệu gần nhất"}
            />
            {lastLoadedAt && (
              <span>Cập nhật lúc {lastLoadedAt.toLocaleTimeString("vi-VN")}</span>
            )}
          </span>
        }
        actions={
          <Button variant="outline" onClick={handleRefresh} loading={loading}>
            Làm mới ngay
          </Button>
        }
      />

      {/* UC10 Ext 7a: Làm mới thất bại nhưng vẫn có dữ liệu gần nhất -> cảnh báo & cho thử lại */}
      {Boolean(error) && overview && (
        <div className="rounded-xl2 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Không thể làm mới dữ liệu mạng lưới</p>
              <p className="mt-0.5 text-xs opacity-80">
                Đang hiển thị dữ liệu gần nhất lúc{" "}
                {lastLoadedAt ? lastLoadedAt.toLocaleTimeString("vi-VN") : "trước đó"}. Chi tiết:{" "}
                {error instanceof Error ? error.message : String(error)}
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              Thử lại
            </Button>
          </div>
        </div>
      )}

      {/* UC10 Ext 2a: Không tải được dữ liệu mạng lưới ngay từ đầu */}
      {loading && !overview && <Spinner />}
      {!overview && <ErrorMessage error={error} onRetry={handleRefresh} />}

      {overview && (
        <>
          {/* Thẻ chỉ số tổng quan (KPI) */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              tone="highlight"
              label="Xe sẵn sàng"
              value={`${totals.vehicles}`}
              sub={`trên tổng số ${totals.totalVehicles} xe dùng chung`}
            />
            <Kpi
              label="Chỗ đỗ trống"
              value={`${totals.slots}`}
              sub={`trên ${totals.totalSlots} vị trí (${totals.totalSlots - totals.slots} đang sử dụng/giữ)`}
            />
            <Kpi
              label="Cổng sạc rảnh"
              value={`${totals.ports}`}
              sub={`trên ${totals.totalPorts} cổng sạc toàn mạng lưới`}
            />
            <Kpi
              label="Cảnh báo đang mở"
              value={`${activeAlerts.length}`}
              sub={`trên ${hubs.length} Mobility Hub`}
            />
          </div>

          {/* UC10 bước 4 & Mục 2.3.3: Khu vực Cảnh báo Vận hành */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Cảnh báo vận hành</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Tự động phát hiện Hub thiếu xe (&lt; ngưỡng), sắp hết chỗ (&le; ngưỡng), tài nguyên sự cố hoặc dữ liệu quá hạn.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "ALL", label: `Tất cả (${activeAlerts.length})` },
                    { key: "LOW_VEHICLE", label: "Thiếu xe" },
                    { key: "NEAR_FULL", label: "Sắp đầy" },
                    { key: "RESOURCE_FAULT", label: "Tài nguyên lỗi" },
                    { key: "DATA_STALE", label: "Dữ liệu cũ" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAlertFilter(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      alertFilter === tab.key
                        ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                {activeAlerts.length === 0
                  ? "Toàn bộ các Hub đang hoạt động ổn định, không có cảnh báo vượt ngưỡng."
                  : "Không có cảnh báo nào khớp với bộ lọc đã chọn."}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredAlerts.map((alert) => {
                  const hubName = hubNameById.get(alert.hubId) ?? alert.hubId;
                  return (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      hubName={hubName}
                      onSelectHub={() => setSelectedHubId(alert.hubId)}
                    />
                  );
                })}
              </div>
            )}
          </Card>

          {/* UC10 bước 3 & 5: Bảng trạng thái các Hub kèm bộ lọc */}
          <Card className="space-y-4 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="text-base font-semibold">Trạng thái các Mobility Hub</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Bấm vào một Hub để xem chi tiết từng xe, mức pin và các đặt chỗ / lịch sạc liên quan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={hubSearch}
                  onChange={(e) => setHubSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc vị trí Hub..."
                  className="rounded-xl border border-neutral-300 bg-transparent px-3.5 py-2 text-sm outline-none focus:border-brand dark:border-white/15 dark:focus:border-lime"
                />
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={onlyAlertedHubs}
                    onChange={(e) => setOnlyAlertedHubs(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Chỉ hiện Hub có cảnh báo
                </label>
              </div>
            </div>

            {filteredHubs.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Không có Hub nào khớp bộ lọc"
                  description="Vui lòng điều chỉnh từ khóa tìm kiếm hoặc tắt bộ lọc cảnh báo."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setHubSearch("");
                        setOnlyAlertedHubs(false);
                      }}
                    >
                      Đặt lại bộ lọc
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="border-y border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Hub</th>
                      <th className="px-5 py-3 font-medium">Xe sẵn sàng</th>
                      <th className="px-5 py-3 font-medium">Chỗ đỗ trống</th>
                      <th className="px-5 py-3 font-medium">Cổng sạc rảnh</th>
                      <th className="px-5 py-3 font-medium">Pin trung bình</th>
                      <th className="px-5 py-3 font-medium">Cảnh báo</th>
                      <th className="px-5 py-3 font-medium">Cập nhật</th>
                      <th className="px-5 py-3 text-right font-medium">Thao tác</th>
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

          {/* UC10 bước 6: Panel xem chi tiết Hub được chọn */}
          {selectedHubId && (
            <Card className="space-y-5 border-2 border-brand/30 dark:border-lime/30">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-4 dark:border-white/10">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">
                      Chi tiết Hub: {hubDetail?.name ?? hubNameById.get(selectedHubId) ?? selectedHubId}
                    </h2>
                    {hubDetail?.isDataStale && (
                      <StatusBadge status="DATA_STALE" label="Dữ liệu quá hạn – Chưa xác minh" />
                    )}
                  </div>
                  {hubDetail && (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {hubDetail.location} · Cập nhật lần cuối:{" "}
                      {new Date(hubDetail.lastUpdatedAt).toLocaleTimeString("vi-VN")}
                    </p>
                  )}
                </div>
                <Button variant="ghost" onClick={() => setSelectedHubId(null)}>
                  Đóng chi tiết
                </Button>
              </div>

              {detailLoading && !hubDetail && <Spinner />}
              <ErrorMessage
                error={detailError}
                onRetry={() => {
                  // UC10 Ext 6a: Tải lại cả danh sách Hub (bước 2) và chi tiết Hub
                  void reload();
                  void reloadDetail();
                }}
              />

              {hubDetail && (
                <div className="space-y-6">
                  {/* UC10 bước 5 & MonitoringView.filterResources: Bộ lọc loại tài nguyên trong Hub */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3 dark:border-white/5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Loại tài nguyên hiển thị:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: "ALL", label: "Tất cả tài nguyên" },
                          { key: "SHARED_VEHICLE", label: "Phương tiện dùng chung" },
                          { key: "RESERVATIONS", label: "Đặt chỗ & Lịch sạc" },
                        ] as const
                      ).map((rf) => (
                        <button
                          key={rf.key}
                          type="button"
                          onClick={() => setResourceFilter(rf.key)}
                          className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                            resourceFilter === rf.key
                              ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-300"
                          }`}
                        >
                          {rf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Danh sách xe tại Hub kèm bộ lọc trạng thái */}
                  {(resourceFilter === "ALL" || resourceFilter === "SHARED_VEHICLE") && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        Danh sách phương tiện tại Hub ({filteredDetailVehicles.length}/{hubDetail.vehicles.length} xe)
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { key: "ALL", label: "Tất cả" },
                            { key: "AVAILABLE", label: "Sẵn sàng" },
                            { key: "CHARGING", label: "Đang sạc" },
                            { key: "RESERVED", label: "Đã đặt" },
                            { key: "UNDER_MAINTENANCE", label: "Đang bảo trì" },
                          ] as const
                        ).map((vf) => (
                          <button
                            key={vf.key}
                            type="button"
                            onClick={() => setVehicleFilter(vf.key)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                              vehicleFilter === vf.key
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
                        Không có xe nào khớp trạng thái đã lọc.
                      </p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredDetailVehicles.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between rounded-xl border border-neutral-200/80 p-3 text-sm dark:border-white/10"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{v.code}</span>
                                <span className="text-xs text-neutral-500">
                                  ({v.type === "E_BIKE" ? "Xe đạp điện" : "Xe máy điện"})
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Pin: <span className="font-semibold">{v.batteryLevel}%</span> · Cập nhật:{" "}
                                {new Date(v.lastUpdatedAt).toLocaleTimeString("vi-VN")}
                              </p>
                            </div>
                            <StatusBadge status={v.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Các đặt chỗ & lịch sạc còn hiệu lực liên quan tới Hub (UC10 bước 6) */}
                  {(resourceFilter === "ALL" || resourceFilter === "RESERVATIONS") && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-neutral-200/80 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Đặt xe dùng chung đang giữ
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {hubDetail.reservations.vehicleReservations.length}
                      </p>
                      {hubDetail.reservations.vehicleReservations.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {hubDetail.reservations.vehicleReservations.slice(0, 3).map((vr) => (
                            <li key={vr.id}>
                              Mã {vr.id.slice(0, 8)} · Hạn nhận:{" "}
                              {new Date(vr.pickupDeadline).toLocaleTimeString("vi-VN")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-neutral-200/80 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Phân bổ / giữ chỗ đỗ
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {hubDetail.reservations.parkingAllocations.length}
                      </p>
                      {hubDetail.reservations.parkingAllocations.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {hubDetail.reservations.parkingAllocations.slice(0, 3).map((pa) => (
                            <li key={pa.id}>
                              {pa.status === "HELD" ? "Giữ tạm" : "Đã đặt"} ·{" "}
                              {new Date(pa.startTime).toLocaleTimeString("vi-VN")} –{" "}
                              {new Date(pa.endTime).toLocaleTimeString("vi-VN")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-neutral-200/80 p-4 dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Lịch sạc xe cá nhân
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {hubDetail.reservations.chargingReservations.length}
                      </p>
                      {hubDetail.reservations.chargingReservations.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {hubDetail.reservations.chargingReservations.slice(0, 3).map((cr) => (
                            <li key={cr.id}>
                              Khung giờ:{" "}
                              {new Date(cr.startTime).toLocaleTimeString("vi-VN")} –{" "}
                              {new Date(cr.endTime).toLocaleTimeString("vi-VN")}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "highlight" }) {
  return (
    <Card tone={tone === "highlight" ? "highlight" : "default"}>
      <p className={`text-sm ${tone ? "text-white/70" : "text-neutral-500 dark:text-neutral-400"}`}>{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone ? "text-lime" : ""}`}>{value}</p>
      <p className={`text-xs ${tone ? "text-white/60" : "text-neutral-500 dark:text-neutral-400"}`}>{sub}</p>
    </Card>
  );
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
  let detailText = "";
  if (alert.type === "LOW_VEHICLE") {
    detailText = `Số xe khả dụng hiện tại: ${alert.value} xe (thấp hơn ngưỡng cấu hình ${alert.threshold} xe).`;
  } else if (alert.type === "NEAR_FULL") {
    const windowStr = alert.evaluationWindow
      ? ` trong khung đánh giá ${new Date(alert.evaluationWindow.startTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}–${new Date(alert.evaluationWindow.endTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "";
    detailText = `Số vị trí có thể tiếp nhận: ${alert.value} chỗ (ngưỡng tối thiểu ≤ ${alert.threshold} chỗ)${windowStr}.`;
  } else if (alert.type === "RESOURCE_FAULT") {
    detailText = `Phát hiện ${alert.value} tài nguyên (xe / vị trí đỗ / cổng sạc) đang bảo trì hoặc ngừng phục vụ.`;
  } else if (alert.type === "DATA_STALE") {
    detailText = `Dữ liệu chưa cập nhật trong ${alert.value} giây (vượt ngưỡng ${alert.threshold} giây) – Chưa đủ thông tin xác minh.`;
  }

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/60 p-4 dark:border-amber-400/20 dark:bg-amber-500/5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={alert.type} />
            <span className="font-semibold">{hubName}</span>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Cập nhật: {new Date(alert.updatedAt).toLocaleTimeString("vi-VN")}
          </span>
        </div>
        <p className="text-xs text-neutral-700 dark:text-neutral-300">{detailText}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onSelectHub}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark"
        >
          Xem chi tiết Hub
        </button>
        {(alert.type === "LOW_VEHICLE" || alert.type === "NEAR_FULL") && (
          <Link
            to="/operator/redistribution"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/5"
          >
            Điều chuyển xe
          </Link>
        )}
        {alert.type === "RESOURCE_FAULT" && (
          <Link
            to="/operator/charging-incidents"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/5"
          >
            Xử lý sự cố
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
  const isStale = alerts.some((a) => a.type === "DATA_STALE");
  const usedSlots = hub.totalSlots - hub.freeSlots;

  return (
    <tr
      className={`transition hover:bg-neutral-50 dark:hover:bg-white/5 ${
        selected ? "bg-brand/5 dark:bg-lime/5" : ""
      }`}
    >
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{hub.name}</p>
          {isStale && <StatusBadge status="DATA_STALE" label="Chưa xác minh" />}
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{hub.location}</p>
      </td>
      <td className="px-5 py-3">
        <span className="font-semibold tabular-nums">
          {hub.availableVehicles}/{hub.totalVehicles}
        </span>
      </td>
      <td className="px-5 py-3 tabular-nums">
        <div>
          <span className="font-semibold">
            {hub.freeSlots}/{hub.totalSlots}
          </span>{" "}
          <span className="text-xs text-neutral-500">trống</span>
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Đang dùng/giữ: {usedSlots}</p>
      </td>
      <td className="px-5 py-3 tabular-nums">
        {hub.freeChargingPorts}/{hub.totalChargingPorts}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand dark:bg-lime" style={{ width: `${hub.averageBattery}%` }} />
          </div>
          <span className="tabular-nums">{hub.averageBattery}%</span>
        </div>
      </td>
      <td className="px-5 py-3">
        {alerts.length === 0 ? (
          <StatusBadge status="IN_SERVICE" label="Bình thường" />
        ) : (
          <div className="flex flex-wrap gap-1">
            {alerts.map((a) => (
              <StatusBadge key={a.id} status={a.type} />
            ))}
          </div>
        )}
      </td>
      <td className="px-5 py-3 tabular-nums text-neutral-500 dark:text-neutral-400">
        {new Date(hub.lastUpdatedAt).toLocaleTimeString("vi-VN")}
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={onSelect}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-100 dark:border-white/15 dark:hover:bg-white/10"
        >
          {selected ? "Ẩn chi tiết" : "Xem chi tiết"}
        </button>
      </td>
    </tr>
  );
}
