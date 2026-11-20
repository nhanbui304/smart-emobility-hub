// Owner: Bùi Quang Nhân (UC06), Ngô Minh Triết (UC08), Nguyễn Hoàng Nhân (UC09)
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { ManageChargingSchedulePanel } from "./ManageChargingSchedulePanel";
import { ParkingReservationSection } from "./parking/ParkingReservationSection";

export function MyVehiclePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Xe của tôi" subtitle="Quản lý chỗ đỗ và lịch sạc cho phương tiện cá nhân tại các Hub ĐHQG-HCM" />
      <ParkingReservationSection />
      <ManageChargingSchedulePanel />
      <Link
        to="/student/charging-request"
        className="flex items-center justify-between rounded-2xl border border-neutral-200/80 bg-white p-4 transition hover:border-brand dark:border-white/10 dark:bg-panel-dark dark:hover:border-lime"
      >
        <div>
          <p className="text-sm font-bold">Cần sạc gấp ngay tại Hub?</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Gửi yêu cầu sạc trực tiếp và nhận phân bổ cổng sạc trống gần nhất.
          </p>
        </div>
        <span className="shrink-0 rounded-xl bg-surface px-3.5 py-2 text-xs font-semibold text-brand dark:bg-white/10 dark:text-lime">
          Sạc ngay →
        </span>
      </Link>
    </div>
  );
}
