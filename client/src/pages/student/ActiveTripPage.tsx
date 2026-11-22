// Owner: Lê Quốc Linh (UC03, UC04), Bùi Quang Nhân (UC05 Return Shared Vehicle)
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ReturnVehicleSection } from "./trip/ReturnVehicleSection";
import { VehicleReservationPanel } from "./VehicleReservationPanel";

export function ActiveTripPage() {
  const [tripReloadKey, setTripReloadKey] = useState<string>("init");
  const [resState, setResState] = useState({ loading: true, count: 0 });
  const [tripState, setTripState] = useState({ loading: true, hasTrip: false, hasReturnResult: false });

  const handleResStatus = useCallback((next: { loading: boolean; count: number }) => {
    setResState((prev) => (prev.loading === next.loading && prev.count === next.count ? prev : next));
  }, []);

  const handleTripStatus = useCallback(
    (next: { loading: boolean; hasTrip: boolean; hasReturnResult: boolean }) => {
      setTripState((prev) =>
        prev.loading === next.loading &&
        prev.hasTrip === next.hasTrip &&
        prev.hasReturnResult === next.hasReturnResult
          ? prev
          : next,
      );
    },
    [],
  );

  const isLoading = resState.loading || tripState.loading;
  const hasReservation = resState.count > 0;
  const hasActiveTrip = tripState.hasTrip;
  const showUnifiedEmpty = !isLoading && !hasReservation && !hasActiveTrip && !tripState.hasReturnResult;

  return (
    <div className="space-y-4">
      <PageHeader title="Chuyến đi" subtitle="Theo dõi xe đã đặt và chuyến đi đang thuê" />

      {showUnifiedEmpty && (
        <EmptyState
          title="Chưa có lượt đặt xe hoặc chuyến đi nào"
          description="Chọn một xe khả dụng tại trang Khám phá Hub để bắt đầu thuê xe."
          action={
            <Link to="/student">
              <Button>Khám phá Hub &amp; Đặt xe</Button>
            </Link>
          }
        />
      )}

      {/* Khi đang thuê xe: ưu tiên hiện Xe đang thuê + form Trả xe ở trên, ẩn thông báo trống về đặt xe */}
      {hasActiveTrip ? (
        <>
          <div data-tour="st-trip-return">
            <ReturnVehicleSection key={tripReloadKey} hideEmpty onStatusChange={handleTripStatus} />
          </div>
          <div data-tour="st-trip-booking">
            <VehicleReservationPanel
              hideEmpty
              onStatusChange={handleResStatus}
              onTripStarted={(trip) => setTripReloadKey(trip.id)}
            />
          </div>
        </>
      ) : (
        <>
          <div data-tour="st-trip-booking">
            <VehicleReservationPanel
              hideEmpty
              onStatusChange={handleResStatus}
              onTripStarted={(trip) => {
                setTripState((prev) => ({ ...prev, hasTrip: true }));
                setTripReloadKey(trip.id);
              }}
            />
          </div>
          <div data-tour="st-trip-return">
            <ReturnVehicleSection key={tripReloadKey} hideEmpty onStatusChange={handleTripStatus} />
          </div>
        </>
      )}
    </div>
  );
}
