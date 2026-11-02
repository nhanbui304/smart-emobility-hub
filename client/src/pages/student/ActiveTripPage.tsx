// Owner: Lê Quốc Linh (UC03, UC04), Bùi Quang Nhân (UC05 Return Shared Vehicle)
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";

export function ActiveTripPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Chuyến đi" subtitle="Đặt xe hiện tại và chuyến đi đang diễn ra" />
      <StubNotice
        owner="Lê Quốc Linh (UC03, UC04) · Bùi Quang Nhân (UC05)"
        useCases="UC03, UC04, UC05"
        todo={[
          "Hiển thị đặt xe còn hiệu lực + đếm ngược hạn nhận xe; nút Hủy đặt xe (UC03)",
          "Nút Nhận xe: preparePickUp → confirmPickUp; xử lý kết quả SUCCESS / FAILED / UNKNOWN (UC04)",
          "Khi đang đi: chọn Hub trả xe → prepareReturn → confirmReturn (UC05)",
        ]}
      />
      <Card tone="highlight">
        <p className="text-sm text-white/70">Chuyến đi hiện tại</p>
        <p className="mt-1 text-lg font-semibold">Chưa có chuyến đi</p>
      </Card>
      <EmptyState title="Chưa có đặt xe" description="Đặt xe ở Trang chủ, rồi quay lại đây để nhận xe." />
    </div>
  );
}
