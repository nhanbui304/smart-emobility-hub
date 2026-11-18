// Owner: Bùi Quang Nhân (UC06), Ngô Minh Triết (UC08), Nguyễn Hoàng Nhân (UC09)
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";
import { ParkingReservationSection } from "./parking/ParkingReservationSection";

export function MyVehiclePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Xe của tôi" subtitle="Đặt chỗ đỗ và lịch sạc cho xe cá nhân" />
      <StubNotice
        owner="Ngô Minh Triết (UC08) · Nguyễn Hoàng Nhân (UC09)"
        useCases="UC08, UC09"
        todo={[
          "Đặt lịch sạc: chargingReservationApi.findChargingSlots → confirmChargingReservation (UC08)",
          "Xem / đổi / hủy lịch sạc, gửi kèm expectedVersion (UC09)",
        ]}
      />
      {/* UC06, Cancel Parking Reservation – Bùi Quang Nhân */}
      <ParkingReservationSection />
      {/* UC08, UC09 – Ngô Minh Triết, Nguyễn Hoàng Nhân: thêm phần đặt / quản lý lịch sạc bên dưới */}
      <Card className="p-4">
        <p className="text-xs text-neutral-500">Sạc</p>
        <p className="mt-1 font-semibold">Đặt lịch sạc</p>
      </Card>
      <Link
        to="/student/charging-request"
        className="block rounded-xl2 border border-neutral-200 bg-white p-4 text-sm font-semibold dark:border-white/10 dark:bg-panel-dark"
      >
        Sạc ngay tại Hub (UC07) →
      </Link>
    </div>
  );
}
