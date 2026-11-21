// Owner: Lê Quốc Linh (UC03, UC04), Bùi Quang Nhân (UC05 Return Shared Vehicle)
import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { VehicleReservationPanel } from "./VehicleReservationPanel";
import { ReturnVehicleSection } from "./trip/ReturnVehicleSection";

export function ActiveTripPage() {
  const [tripId, setTripId] = useState<string>();

  return (
    <div className="space-y-4">
      <PageHeader title="Chuyến đi" subtitle="Đặt xe hiện tại và chuyến đi đang diễn ra" />
      <VehicleReservationPanel onTripStarted={(trip) => setTripId(trip.id)} />
      <ReturnVehicleSection key={tripId} />
    </div>
  );
}
