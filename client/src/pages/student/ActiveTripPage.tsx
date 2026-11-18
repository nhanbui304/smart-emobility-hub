// Owner: Lê Quốc Linh (UC03, UC04), Bùi Quang Nhân (UC05 Return Shared Vehicle)
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";
import { ReturnVehicleSection } from "./trip/ReturnVehicleSection";

export function ActiveTripPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Chuyến đi" subtitle="Đặt xe hiện tại và chuyến đi đang diễn ra" />
      <StubNotice
        owner="Lê Quốc Linh (UC03, UC04)"
        useCases="UC03, UC04"
        todo={[
          "Hiển thị đặt xe còn hiệu lực + đếm ngược hạn nhận xe; nút Hủy đặt xe (UC03)",
          "Nút Nhận xe: preparePickUp → confirmPickUp; xử lý kết quả SUCCESS / FAILED / UNKNOWN (UC04)",
        ]}
      />
      {/* UC05 – Bùi Quang Nhân: chuyến đi hiện tại và trả xe (dữ liệu từ returnApi.getCurrentTrip) */}
      <ReturnVehicleSection />
      <EmptyState title="Chưa có đặt xe" description="Đặt xe ở Trang chủ, rồi quay lại đây để nhận xe." />
    </div>
  );
}
