// Owner: Ngô Minh Triết (UC11 Handle Operational Incident), Nguyễn Hoàng Nhân (UC13 Manage Smart Charging Schedule)
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";

export function ChargingIncidentPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Lịch sạc và sự cố" subtitle="Điều phối lịch sạc thông minh và xử lý sự cố vận hành" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Lịch sạc thông minh (UC13)</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Chọn Hub và khung giờ → sinh lịch đề xuất → chỉnh tay → áp dụng.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold">Sự cố vận hành (UC11)</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Ghi nhận sự cố tài nguyên → xử lý đặt chỗ bị ảnh hưởng → xác nhận khắc phục.
          </p>
        </Card>
      </div>
      <StubNotice
        owner="Ngô Minh Triết (UC11) · Nguyễn Hoàng Nhân (UC13)"
        useCases="UC11, UC13"
        todo={[
          "UC13: chargingScheduleApi.loadChargingContext → generateProposedSchedule → validatePlan → applyChargingSchedule (gửi baseVersion)",
          "UC11: form báo sự cố (tài nguyên, mô tả, mức ảnh hưởng) → danh sách đặt chỗ bị ảnh hưởng → phương án xử lý",
          "Xử lý lỗi VERSION_CONFLICT: tải lại dữ liệu và báo Operator",
        ]}
      />
    </div>
  );
}
