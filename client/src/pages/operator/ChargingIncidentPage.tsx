// Owner: Ngô Minh Triết (UC11 Handle Operational Incident), Nguyễn Hoàng Nhân (UC13 Manage Smart Charging Schedule)
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";
import { SmartChargingPanel } from "./SmartChargingPanel";

export function ChargingIncidentPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Lịch sạc và sự cố" subtitle="Điều phối lịch sạc thông minh và xử lý sự cố vận hành" />
      <div className="grid gap-6 xl:grid-cols-2">
        <SmartChargingPanel />
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Sự cố vận hành (UC11)</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Ghi nhận sự cố tài nguyên → xử lý đặt chỗ bị ảnh hưởng → xác nhận khắc phục.
            </p>
          </Card>
          <StubNotice
            owner="Ngô Minh Triết (UC11)"
            useCases="UC11"
            todo={[
              "UC11: form báo sự cố (tài nguyên, mô tả, mức ảnh hưởng) → danh sách đặt chỗ bị ảnh hưởng → phương án xử lý",
              "Xử lý lỗi VERSION_CONFLICT: tải lại dữ liệu và báo Operator",
            ]}
          />
        </div>
      </div>
    </div>
  );
}
