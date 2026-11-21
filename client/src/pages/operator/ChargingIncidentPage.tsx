// Owner: Ngô Minh Triết (UC11 Handle Operational Incident), Nguyễn Hoàng Nhân (UC13 Manage Smart Charging Schedule)
import { PageHeader } from "../../components/PageHeader";
import { SmartChargingPanel } from "./SmartChargingPanel";
import { IncidentManagementPanel } from "./IncidentManagementPanel";

export function ChargingIncidentPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Lịch sạc và sự cố" subtitle="Điều phối lịch sạc thông minh và xử lý sự cố vận hành" />
      <div className="grid gap-6 xl:grid-cols-2">
        <SmartChargingPanel />
        <IncidentManagementPanel />
      </div>
    </div>
  );
}
