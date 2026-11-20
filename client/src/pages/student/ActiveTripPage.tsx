// Owner: Lê Quốc Linh (UC03, UC04), Bùi Quang Nhân (UC05 Return Shared Vehicle)
import { useState } from "react";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { StubNotice } from "../../components/StubNotice";
import type { Trip } from "../../types";
import { getStoredTrip, storeTrip } from "../../utils/activeTrip";
import { VehicleReservationPanel } from "./VehicleReservationPanel";

export function ActiveTripPage() {
  const [trip, setTrip] = useState<Trip | null>(() => getStoredTrip());

  function handleTripStarted(started: Trip) {
    storeTrip(started);
    setTrip(started);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Chuyến đi" subtitle="Đặt xe hiện tại và chuyến đi đang diễn ra" />

      {/* Lê Quốc Linh – UC03 hủy đặt xe, UC04 nhận xe (xem VehicleReservationPanel.tsx) */}
      <VehicleReservationPanel onTripStarted={handleTripStarted} />

      {trip && (
        <Card tone="highlight" className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70">Chuyến đi hiện tại</p>
            <StatusBadge status={trip.status} />
          </div>
          <p className="text-lg font-semibold">
            Bắt đầu lúc {new Date(trip.startedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="break-all font-mono text-xs text-white/60">Mã chuyến đi: {trip.id}</p>
        </Card>
      )}

      {/* Bùi Quang Nhân – UC05: dùng `trip` ở trên; sau khi trả xe gọi clearStoredTrip() (utils/activeTrip.ts) rồi setTrip(null) */}
      <StubNotice
        owner="Bùi Quang Nhân"
        useCases="UC05"
        todo={["Khi đang đi (trip.status = ACTIVE): chọn Hub trả xe → prepareReturn → confirmReturn (UC05)"]}
      />
    </div>
  );
}
