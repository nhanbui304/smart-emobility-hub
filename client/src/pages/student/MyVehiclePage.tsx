// Owner: Bùi Quang Nhân (UC06), Ngô Minh Triết (UC08), Nguyễn Hoàng Nhân (UC09)
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { ManageChargingSchedulePanel } from "./ManageChargingSchedulePanel";
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
  const [latestReservationId, setLatestReservationId] = useState<string>("init");
  const [justCreated, setJustCreated] = useState(false);

  const hubIdParam = searchParams.get("hubId");

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

  return (
    <div className="space-y-5">
      <PageHeader title="Xe của tôi" subtitle="Đặt chỗ đỗ, đặt lịch sạc và quản lý lịch cho xe cá nhân" />

      {/* Lối tắt Sạc ngay (UC07) riêng và dễ thấy trên cả desktop lẫn điện thoại */}
      <Link
        to={hubIdParam ? `/student/charging-request?hubId=${hubIdParam}` : "/student/charging-request"}
        data-tour="st-charge-now-link"
        className="flex items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-emerald-50/70 px-4 py-3.5 transition hover:border-brand hover:bg-emerald-50 dark:border-lime/30 dark:bg-lime/10 dark:hover:border-lime"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-brand dark:text-lime">Cần sạc gấp ngay tại Hub?</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-300">
            Gửi yêu cầu sạc tức thời để nhận cổng trống hoặc vào hàng đợi (UC07).
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

      {activeTab === "parking" && (
        <div data-tour="st-parking">
          <ParkingReservationSection />
        </div>
      )}

      {activeTab === "schedule" && (
        <div data-tour="st-charge-schedule">
          <ScheduleChargingPanel onCreated={handleChargingCreated} />
        </div>
      )}

      {activeTab === "manage" && (
        <div data-tour="st-charge-manage">
          <ManageChargingSchedulePanel key={latestReservationId} />
        </div>
      )}
    </div>
  );
}
