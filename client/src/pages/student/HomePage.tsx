// Owner: Ngô Minh Triết (UC01), Lê Quốc Linh (View Hub & Resource Status)
// Giao diện Trang chủ Map-First ĐHQG-HCM: bản đồ thật CartoDB + pin live 5 Hub + thẻ xem nhanh Hub & xe đang đặt.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";
import { hubApi } from "../../api/hubs";
import { reservationApi } from "../../api/reservation";
import { returnApi } from "../../api/return";
import { CampusHubMap, type MapMetric } from "../../components/CampusHubMap";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import type { HubStatus } from "../../types";
import { MobilitySearchPanel } from "./MobilitySearchPanel";
import {
  connectorTypeLabel,
  estimateRangeKm,
  googleMapsDirectionsUrl,
  sharedVehiclePlate,
  vehicleTypeLabel,
} from "../../utils/display";

const SHARED_MODES: { value: MapMetric; label: string }[] = [
  { value: "RENT_VEHICLE", label: "Thuê xe" },
];

const PRIVATE_MODES: { value: MapMetric; label: string }[] = [
  { value: "PARK", label: "Đỗ xe" },
  { value: "CHARGE", label: "Sạc xe" },
];

function formatCountdown(deadlineIso: string, nowMs: number): string {
  const ms = Math.max(0, new Date(deadlineIso).getTime() - nowMs);
  const totalSec = Math.floor(ms / 1000);
  return `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;
}

export function HomePage() {
  const { user } = useAuth();
  const { data: hubs, loading, error, reload } = useAsync(() => hubApi.list(), [], { refreshEveryMs: 3000 });
  const activeReservations = useAsync(() => reservationApi.getMyReservations().catch(() => []), [], {
    refreshEveryMs: 5000,
  });
  const currentTrip = useAsync(() => returnApi.getCurrentTrip().catch(() => null), [], { refreshEveryMs: 5000 });
  const myVehicles = useAsync(() => authApi.myVehicles().catch(() => []), []);

  const [mode, setMode] = useState<MapMetric>("RENT_VEHICLE");
  const [query, setQuery] = useState("");
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const filteredHubs = useMemo(() => {
    const list = hubs ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((h) => h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q));
  }, [hubs, query]);

  // Mặc định chọn Hub đầu tiên khi tải xong
  useEffect(() => {
    if (!selectedHubId && filteredHubs[0]) {
      setSelectedHubId(filteredHubs[0].id);
    } else if (selectedHubId && filteredHubs.length > 0 && !filteredHubs.some((h) => h.id === selectedHubId)) {
      setSelectedHubId(filteredHubs[0].id);
    }
  }, [filteredHubs, selectedHubId]);

  const selectedHub = useMemo(
    () => (hubs ?? []).find((h) => h.id === selectedHubId) ?? filteredHubs[0] ?? null,
    [hubs, filteredHubs, selectedHubId],
  );

  // Tải danh sách xe tại Hub đang chọn để xem nhanh biển số + % pin ngay trên Trang chủ
  const selectedHubDetail = useAsync(
    () => (selectedHub ? hubApi.detail(selectedHub.id) : Promise.resolve(null)),
    [selectedHub?.id],
    { refreshEveryMs: 5000 },
  );

  const topAvailableVehicles = useMemo(() => {
    return (selectedHubDetail.data?.vehicles ?? [])
      .filter((v) => v.status === "AVAILABLE")
      .sort((a, b) => b.batteryLevel - a.batteryLevel)
      .slice(0, 3);
  }, [selectedHubDetail.data?.vehicles]);

  const activeBooking = activeReservations.data?.find((r) => r.status === "RESERVED") ?? null;
  const bookingHubDetail = useAsync(
    () => (activeBooking ? hubApi.detail(activeBooking.hubId) : Promise.resolve(null)),
    [activeBooking?.hubId],
  );
  const bookedVehicle = bookingHubDetail.data?.vehicles.find((v) => v.id === activeBooking?.vehicleId);
  const bookedHubName = hubs?.find((h) => h.id === activeBooking?.hubId)?.name;

  return (
    <div className="space-y-6">
      {/* Khối Bản đồ ĐHQG-HCM tương tác + Thẻ nổi */}
      <section className="relative">
        {/* Thanh chọn chế độ & tìm nhanh nổi phía trên */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Xin chào, {user?.fullName ?? "bạn"}
            </p>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">Khám phá Mobility Hub tại ĐHQG-HCM</h1>
          </div>

          <div data-tour="st-home-modes" className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-panel-dark"
              role="radiogroup"
              aria-label="Mục đích sử dụng"
            >
              <div className="flex items-center gap-1">
                <span className="px-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  Xe dùng chung:
                </span>
                {SHARED_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    onClick={() => setMode(m.value)}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                      mode === m.value
                        ? "bg-brand text-lime dark:bg-lime dark:text-brand-dark"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <span aria-hidden className="h-4 w-px bg-neutral-200 dark:bg-white/15" />

              <div className="flex items-center gap-1">
                <span className="px-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  Xe cá nhân:
                </span>
                {PRIVATE_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === m.value}
                    onClick={() => setMode(m.value)}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                      mode === m.value
                        ? "bg-brand text-lime dark:bg-lime dark:text-brand-dark"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm nhanh Hub..."
              aria-label="Tìm nhanh Hub"
              className="w-48 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs outline-none transition focus:border-brand dark:border-white/10 dark:bg-panel-dark dark:focus:border-lime"
            />
          </div>
        </div>

        {loading && !hubs && <Spinner />}
        <ErrorMessage error={error} onRetry={() => void reload()} />

        {/* Bố cục Map-First: Bản đồ thật bên trái (7/12) + Thẻ xem nhanh Hub bên phải (5/12) */}
        {hubs && hubs.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-12">
            <div data-tour="st-home-map" className="relative lg:col-span-7 xl:col-span-8">
              <CampusHubMap
                hubs={filteredHubs}
                selectedHubId={selectedHub?.id ?? null}
                onSelectHub={setSelectedHubId}
                mode="student"
                metric={mode}
                className="h-[380px] w-full shadow-sm lg:h-[520px]"
              />

              {/* Thẻ nổi trạng thái xe đang đặt / chuyến đi đang diễn ra (góc dưới bản đồ trên desktop) */}
              {currentTrip.data ? (
                <div className="mt-3 rounded-2xl border border-brand-light/40 bg-brand p-4 text-white shadow-lg lg:absolute lg:inset-x-4 lg:bottom-4 lg:z-[400] lg:mt-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-white px-3 py-1.5 text-center text-neutral-900">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Biển số</p>
                        <p className="font-mono text-xs font-extrabold">
                          {sharedVehiclePlate(currentTrip.data.vehicleCode)}
                        </p>
                      </div>
                      <div>
                        <span className="inline-block rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-brand-dark">
                          ĐANG TRONG CHUYẾN ĐI · {currentTrip.data.vehicleCode}
                        </span>
                        <p className="mt-0.5 text-sm font-bold">
                          {vehicleTypeLabel(currentTrip.data.vehicleType)} · Pin {currentTrip.data.batteryLevel}%
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/student/trips"
                      className="rounded-xl bg-lime px-4 py-2 text-xs font-bold text-brand-dark transition hover:bg-lime-dark"
                    >
                      Trả xe ngay →
                    </Link>
                  </div>
                </div>
              ) : activeBooking ? (
                <div className="mt-3 rounded-2xl border border-brand-light/40 bg-brand p-4 text-white shadow-lg lg:absolute lg:inset-x-4 lg:bottom-4 lg:z-[400] lg:mt-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-white px-3 py-1.5 text-center text-neutral-900">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Biển số</p>
                        <p className="font-mono text-xs font-extrabold">
                          {bookedVehicle ? sharedVehiclePlate(bookedVehicle.code) : "Đang tải..."}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-brand-dark">
                            ĐANG GIỮ · {formatCountdown(activeBooking.pickupDeadline, nowMs)}
                          </span>
                          {bookedVehicle && (
                            <span className="text-xs font-semibold text-emerald-200">
                              {bookedVehicle.code} · Pin {bookedVehicle.batteryLevel}%
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-bold">
                          {bookedVehicle ? vehicleTypeLabel(bookedVehicle.type) : "Xe dùng chung"} tại{" "}
                          {bookedHubName ?? "Hub"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/student/trips"
                        className="rounded-xl bg-lime px-4 py-2 text-xs font-bold text-brand-dark transition hover:bg-lime-dark"
                      >
                        Xem xe &amp; Mở khóa
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Thẻ chi tiết Hub đang chọn bên phải */}
            <div data-tour="st-home-hubcard" className="lg:col-span-5 xl:col-span-4">
              {selectedHub ? (
                <Card className="flex h-full flex-col justify-between space-y-5 p-5">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Đang hoạt động
                        </span>
                        <h2 className="mt-2 text-xl font-bold">{selectedHub.name}</h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{selectedHub.location}</p>
                      </div>
                      <a
                        href={googleMapsDirectionsUrl(selectedHub.name)}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-600 transition hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"
                      >
                        Chỉ đường ↗
                      </a>
                    </div>

                    {/* 3 ô thống kê nhanh */}
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <StatTile
                        label="Xe sẵn sàng"
                        value={`${selectedHub.availableVehicles}`}
                        tone="emerald"
                      />
                      <StatTile label="Chỗ trống" value={`${selectedHub.freeSlots}`} tone="neutral" />
                      <StatTile label="Cổng sạc" value={`${selectedHub.freeChargingPorts}`} tone="amber" />
                    </dl>

                    {mode === "RENT_VEHICLE" ? (
                      /* Gợi ý 3 xe pin cao nhất tại Hub cho nhu cầu thuê xe dùng chung */
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                          Xe pin cao sẵn sàng nhận ngay
                        </p>
                        {topAvailableVehicles.length === 0 ? (
                          <p className="rounded-xl bg-surface p-3 text-xs text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
                            Hiện chưa có xe sẵn sàng tại Hub này. Hãy bấm chọn một Hub khác trên bản đồ.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {topAvailableVehicles.map((v, idx) => (
                              <li key={v.id}>
                                <Link
                                  to={`/student/hubs/${selectedHub.id}/reserve?vehicleId=${v.id}`}
                                  className={`group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition ${
                                    idx === 0
                                      ? "border-emerald-500/50 bg-emerald-50/60 hover:border-brand hover:bg-emerald-50 dark:border-lime/40 dark:bg-lime/5 dark:hover:border-lime dark:hover:bg-lime/10"
                                      : "border-neutral-200/80 bg-surface/60 hover:border-brand hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-lime/60 dark:hover:bg-white/10"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <p className="font-mono text-xs font-bold">
                                      {sharedVehiclePlate(v.code)}{" "}
                                      <span className="font-sans font-semibold text-neutral-500 dark:text-neutral-400">
                                        · {v.code}
                                      </span>
                                    </p>
                                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                      {vehicleTypeLabel(v.type)} · ~{estimateRangeKm(v.batteryLevel, v.type)} km
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                      Pin {v.batteryLevel}%
                                    </span>
                                    <span className="text-xs font-semibold text-brand transition group-hover:translate-x-0.5 dark:text-lime">
                                      Chọn →
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      /* Khối tiện ích riêng cho Sinh viên có xe điện cá nhân (Đỗ xe / Sạc xe) */
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                          Tiện ích cho xe điện cá nhân
                        </p>

                        {myVehicles.data && myVehicles.data.length > 0 ? (
                          <div className="rounded-xl border border-neutral-200/90 bg-surface/70 p-3 dark:border-white/10 dark:bg-white/5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-neutral-900 dark:text-white">
                                    {myVehicles.data[0].plate}
                                  </span>
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                    {vehicleTypeLabel(myVehicles.data[0].type)}
                                  </span>
                                  {myVehicles.data.length > 1 && (
                                    <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                                      +{myVehicles.data.length - 1} xe
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                                  {connectorTypeLabel(myVehicles.data[0].connectorType)}
                                </p>
                              </div>
                              <Link
                                to="/student/my-vehicle?manageVehicles=1"
                                className="shrink-0 text-xs font-semibold text-brand transition hover:underline dark:text-lime"
                              >
                                Quản lý xe →
                              </Link>
                            </div>
                          </div>
                        ) : myVehicles.loading ? (
                          <p className="rounded-xl bg-surface p-3 text-xs text-neutral-500 dark:bg-white/5 dark:text-neutral-400">
                            Đang tải thông tin phương tiện cá nhân...
                          </p>
                        ) : (
                          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                              Bạn chưa đăng ký xe điện cá nhân
                            </p>
                            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                              Thêm biển số và chuẩn đầu cắm để đặt chỗ đỗ hoặc đặt lịch sạc nhanh tại các Hub.
                            </p>
                            <Link
                              to="/student/my-vehicle?manageVehicles=1"
                              className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-lime transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark dark:hover:bg-lime-dark"
                            >
                              + Đăng ký xe cá nhân →
                            </Link>
                          </div>
                        )}

                        <div className="space-y-1.5 rounded-xl border border-neutral-200/80 bg-white p-3 text-xs dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-neutral-600 dark:text-neutral-300">Chỗ đỗ thường tại Hub</span>
                            <span
                              className={`font-bold tabular-nums ${
                                mode === "PARK"
                                  ? "text-emerald-700 dark:text-lime"
                                  : "text-neutral-800 dark:text-neutral-100"
                              }`}
                            >
                              {selectedHub.freeSlots} chỗ đỗ thường đang trống
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-neutral-600 dark:text-neutral-300">Trạm sạc xe cá nhân</span>
                            <span
                              className={`font-bold tabular-nums ${
                                mode === "CHARGE"
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-neutral-800 dark:text-neutral-100"
                              }`}
                            >
                              {selectedHub.freeChargingPorts}/{selectedHub.totalChargingPorts} cổng sạc đang rảnh
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nút hành động theo chế độ đang chọn */}
                  <div className="space-y-2 pt-2">
                    {mode === "RENT_VEHICLE" && (
                      <Link
                        to={`/student/hubs/${selectedHub.id}/reserve`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-lime transition hover:bg-brand-light active:scale-[0.99] dark:bg-lime dark:text-brand-dark dark:hover:bg-lime-dark"
                      >
                        Xem tất cả xe →
                      </Link>
                    )}
                    {mode === "PARK" && (
                      <>
                        <Link
                          to={`/student/my-vehicle?hubId=${selectedHub.id}&tab=parking`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-lime transition hover:bg-brand-light active:scale-[0.99] dark:bg-lime dark:text-brand-dark dark:hover:bg-lime-dark"
                        >
                          Đặt chỗ đỗ tại Hub này →
                        </Link>
                        <Link
                          to={`/student/charging-request?hubId=${selectedHub.id}`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-surface/70 px-4 py-2.5 text-xs font-semibold text-neutral-700 transition hover:border-brand hover:text-brand active:scale-[0.99] dark:border-white/15 dark:bg-white/5 dark:text-neutral-200 dark:hover:border-lime dark:hover:text-lime"
                        >
                          Yêu cầu sạc ngay (UC07) →
                        </Link>
                      </>
                    )}
                    {mode === "CHARGE" && (
                      <>
                        <Link
                          to={`/student/my-vehicle?hubId=${selectedHub.id}&tab=schedule`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-lime transition hover:bg-brand-light active:scale-[0.99] dark:bg-lime dark:text-brand-dark dark:hover:bg-lime-dark"
                        >
                          Đặt lịch sạc trước →
                        </Link>
                        <Link
                          to={`/student/charging-request?hubId=${selectedHub.id}`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-surface/70 px-4 py-2.5 text-xs font-semibold text-neutral-700 transition hover:border-brand hover:text-brand active:scale-[0.99] dark:border-white/15 dark:bg-white/5 dark:text-neutral-200 dark:hover:border-lime dark:hover:text-lime"
                        >
                          Yêu cầu sạc ngay (UC07) →
                        </Link>
                      </>
                    )}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <Link to="/student/my-vehicle" className="font-medium text-neutral-500 hover:text-brand dark:text-neutral-400 dark:hover:text-lime">
                        Đỗ xe / Sạc xe cá nhân
                      </Link>
                      <Link to="/student/reservations" className="font-semibold text-brand dark:text-lime">
                        Đặt chỗ của tôi →
                      </Link>
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {selectedHub && hubs && (
        <div data-tour="st-home-search">
          <MobilitySearchPanel key={`${mode}:${selectedHub.id}`} purpose={mode} origin={selectedHub} hubs={hubs} />
        </div>
      )}

      {/* Dải chọn nhanh tất cả các Hub */}
      {hubs && hubs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold">Tất cả {hubs.length} Mobility Hub</h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              Bấm vào Hub để xem trên bản đồ hoặc đặt xe ngay
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {hubs.map((hub) => (
              <HubMiniCard
                key={hub.id}
                hub={hub}
                selected={selectedHub?.id === hub.id}
                onSelect={() => setSelectedHubId(hub.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone: "emerald" | "neutral" | "amber" }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-surface text-neutral-800 dark:bg-white/5 dark:text-neutral-100";
  return (
    <div className={`rounded-xl py-2.5 ${cls}`}>
      <dd className="text-xl font-extrabold tabular-nums">{value}</dd>
      <dt className="text-[11px] font-medium opacity-80">{label}</dt>
    </div>
  );
}

function HubMiniCard({
  hub,
  selected,
  onSelect,
}: {
  hub: HubStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full cursor-pointer rounded-2xl border p-3.5 text-left transition ${
          selected
            ? "border-brand bg-brand/5 ring-1 ring-brand dark:border-lime dark:bg-lime/10 dark:ring-lime"
            : "border-neutral-200/80 bg-white hover:border-neutral-300 dark:border-white/10 dark:bg-panel-dark dark:hover:border-white/20"
        }`}
      >
        <p className="truncate text-sm font-bold">{hub.name}</p>
        <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-lime">
          {hub.availableVehicles} xe · {hub.freeSlots} chỗ trống
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          {hub.freeChargingPorts}/{hub.totalChargingPorts} cổng sạc rảnh
        </p>
      </button>
    </li>
  );
}
