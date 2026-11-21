// Owner: Bùi Quang Nhân (UC06), Ngô Minh Triết (UC08), Nguyễn Hoàng Nhân (UC09)
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { ManageChargingSchedulePanel } from "./ManageChargingSchedulePanel";
import { ParkingReservationSection } from "./parking/ParkingReservationSection";
import { ScheduleChargingPanel } from "./ScheduleChargingPanel";

export function MyVehiclePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Xe của tôi" subtitle="Đặt chỗ đỗ và lịch sạc cho xe cá nhân" />
      <ParkingReservationSection />
      <ManageChargingSchedulePanel />
      <ScheduleChargingPanel />
      <Link
        to="/student/charging-request"
        className="block rounded-xl2 border border-neutral-200 bg-white p-4 text-sm font-semibold dark:border-white/10 dark:bg-panel-dark"
      >
        Sạc ngay tại Hub (UC07) →
      </Link>
    </div>
  );
}
