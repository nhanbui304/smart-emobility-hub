// Owner: Bùi Quang Nhân (UC06), Ngô Minh Triết (UC08), Nguyễn Hoàng Nhân (UC09)
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { PageHeader } from "../../components/PageHeader";
import { useAsync } from "../../hooks/useAsync";
import { ManageChargingSchedulePanel } from "./ManageChargingSchedulePanel";
import { PrivateVehiclesCard } from "./PrivateVehiclesCard";
import { ScheduleChargingPanel } from "./ScheduleChargingPanel";
import { ParkingReservationSection } from "./parking/ParkingReservationSection";

type VehicleTab = "parking" | "schedule" | "manage";

const TABS: Array<{ key: VehicleTab; label: string; tourId: string }> = [
  { key: "parking", label: "Đặt chỗ đỗ", tourId: "st-parking" },
  { key: "schedule", label: "Đặt lịch sạc", tourId: "st-charge-schedule" },
  { key: "manage", label: "Quản lý lịch sạc", tourId: "st-charge-manage" },
];

function parseTab(raw: string | null): VehicleTab {
  if (raw === "schedule" || raw === "manage" || raw === "parking") return raw;
  return "parking";
}

export function MyVehiclePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const manageFromUrl = searchParams.get("manageVehicles") === "1";

  const [latestReservationId, setLatestReservationId] = useState<string>("init");
  const [justCreated, setJustCreated] = useState(false);
  const [vehicleVersion, setVehicleVersion] = useState(0);
  const [manageOpen, setManageOpen] = useState<boolean>(manageFromUrl);

  const myVehicles = useAsync(() => authApi.myVehicles(), []);
  const vehicles = myVehicles.data ?? [];

  const hubIdParam = searchParams.get("hubId");

  useEffect(() => {
    if (manageFromUrl) setManageOpen(true);
  }, [manageFromUrl]);

  // Chỉ tự mở khung quản lý xe khi tải xong mà sinh viên chưa đăng ký xe nào (0 xe)
  useEffect(() => {
    if (!myVehicles.loading && myVehicles.data !== null && myVehicles.data.length === 0) {
      setManageOpen(true);
    }
  }, [myVehicles.loading, myVehicles.data]);

  function toggleManageVehicles(nextOpen?: boolean) {
    const resolved = nextOpen ?? !manageOpen;
    setManageOpen(resolved);
    const next = new URLSearchParams(searchParams);
    if (resolved) next.set("manageVehicles", "1");
    else next.delete("manageVehicles");
    setSearchParams(next, { replace: true });
  }

  function switchTab(tab: VehicleTab) {
    const next = new URLSearchParams(searchParams);
    if (tab === "parking") next.delete("tab");
    else next.set("tab", tab);
    if (hubIdParam) next.set("hubId", hubIdParam);
    setSearchParams(next, { replace: true });
    if (tab === "manage") setJustCreated(false);
  }

  function handleChargingCreated(reservationId: string) {
    setLatestReservationId(reservationId);
    setJustCreated(true);
  }

  async function handleVehiclesChanged() {
    await myVehicles.reload();
    setVehicleVersion((v) => v + 1);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Xe của tôi"
        subtitle="Đặt chỗ đỗ, đặt lịch sạc và quản lý lịch cho xe cá nhân"
        actions={
          <button
            type="button"
            data-tour="st-vehicle-manage-btn"
            aria-expanded={manageOpen}
            onClick={() => toggleManageVehicles()}
            className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-semibold transition active:scale-[0.99] ${
              manageOpen
                ? "border-brand bg-brand text-lime dark:border-lime dark:bg-lime dark:text-brand-dark"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-brand hover:text-brand dark:border-white/15 dark:bg-panel-dark dark:text-neutral-200 dark:hover:border-lime dark:hover:text-lime"
            }`}
          >
            Quản lý xe cá nhân ({vehicles.length} xe)
          </button>
        }
      />

      {manageOpen && (
        <PrivateVehiclesCard
          vehicles={vehicles}
          loading={myVehicles.loading}
          loadError={myVehicles.error}
          onRetryLoad={() => void myVehicles.reload()}
          onChanged={handleVehiclesChanged}
          onClose={() => toggleManageVehicles(false)}
        />
      )}

      {/* Lối tắt Sạc ngay (UC07) riêng và dễ thấy trên cả desktop lẫn điện thoại */}
      <Link
        to={hubIdParam ? `/student/charging-request?hubId=${hubIdParam}` : "/student/charging-request"}
        data-tour="st-charge-now-link"
        className="flex items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-emerald-50/70 px-4 py-3.5 transition hover:border-brand hover:bg-emerald-50 dark:border-lime/30 dark:bg-lime/10 dark:hover:border-lime"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand dark:text-lime">Cần sạc gấp ngay tại Hub?</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            Gửi yêu cầu sạc tức thời để nhận cổng trống hoặc vào hàng đợi.
          </p>
        </div>
        <span className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-lime dark:bg-lime dark:text-brand-dark">
          Sạc ngay →
        </span>
      </Link>

      {/* 3 Tab gọn gàng tách riêng từng thao tác */}
      <div
        role="tablist"
        aria-label="Chức năng xe cá nhân"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-neutral-200 bg-neutral-100/90 p-1 dark:border-white/10 dark:bg-white/5"
      >
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-tour={t.tourId}
              onClick={() => switchTab(t.key)}
              className={`relative cursor-pointer rounded-xl px-2 py-2.5 text-center text-xs font-semibold transition sm:text-sm ${
                active
                  ? "bg-brand text-lime shadow-sm dark:bg-lime dark:text-brand-dark"
                  : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
              }`}
            >
              <span>{t.label}</span>
              {t.key === "manage" && justCreated && !active && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 dark:bg-lime" />
              )}
            </button>
          );
        })}
      </div>

      {justCreated && activeTab === "schedule" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <span>Đã tạo lịch sạc mới thành công.</span>
          <button
            type="button"
            onClick={() => switchTab("manage")}
            className="cursor-pointer font-bold underline"
          >
            Xem trong Quản lý lịch sạc →
          </button>
        </div>
      )}

      {activeTab === "parking" && <ParkingReservationSection key={vehicleVersion} />}

      {activeTab === "schedule" && <ScheduleChargingPanel key={vehicleVersion} onCreated={handleChargingCreated} />}

      {activeTab === "manage" && <ManageChargingSchedulePanel key={`${vehicleVersion}:${latestReservationId}`} />}
    </div>
  );
}
