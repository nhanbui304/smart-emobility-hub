// Owner: Ngô Minh Triết (UC11 Handle Operational Incident), Nguyễn Hoàng Nhân (UC13 Manage Smart Charging Schedule)
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";
import { IncidentManagementPanel } from "./IncidentManagementPanel";

export function ChargingIncidentPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Lịch sạc và sự cố" subtitle="Điều phối lịch sạc thông minh và xử lý sự cố vận hành" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold">Lịch sạc thông minh (UC13)</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Chọn Hub và khung giờ → sinh lịch đề xuất → chỉnh tay → áp dụng.
            </p>
          </Card>
          <StubNotice
            owner="Nguyễn Hoàng Nhân (UC13)"
            useCases="UC13"
            todo={[
              "UC13: chargingScheduleApi.loadChargingContext → generateProposedSchedule → validatePlan → applyChargingSchedule (gửi baseVersion)",
            ]}
          />
        </div>
        <IncidentManagementPanel />
      </div>
    </div>
  );
}
