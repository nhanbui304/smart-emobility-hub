// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle
import { Link, useParams } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { StubNotice } from "../../components/StubNotice";
import { useAsync } from "../../hooks/useAsync";

export function ReserveVehiclePage() {
  const { hubId = "" } = useParams();
  // Tạm dùng chi tiết Hub (đã chạy) để hiển thị xe; khi làm UC02 thay bằng vehicleApi.reservableVehicles(hubId)
  const { data: hub, loading, error, reload } = useAsync(() => hubApi.detail(hubId), [hubId]);

  return (
    <div className="space-y-4">
      <Link to="/student" className="text-sm text-neutral-500">
        ← Quay lại
      </Link>
      <PageHeader title="Đặt xe dùng chung" subtitle={hub?.name} />
      <StubNotice
        owner="Lê Quốc Linh"
        useCases="UC02"
        todo={[
          "Lấy danh sách xe có thể đặt: vehicleApi.reservableVehicles(hubId)",
          "Chọn xe → prepareReservation → màn hình xác nhận (hạn nhận xe)",
          "Xác nhận → vehicleApi.confirmReservation(hubId, vehicleId); xe vừa bị người khác đặt thì báo lỗi rõ ràng",
        ]}
      />
      {loading && <Spinner />}
      <ErrorMessage error={error} onRetry={() => void reload()} />
      <ul className="space-y-2">
        {hub?.vehicles.map((v) => (
          <li key={v.id}>
            <Card className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{v.code}</p>
                <p className="text-xs text-neutral-500">
                  {v.type === "E_BIKE" ? "Xe đạp điện" : "Xe máy điện"} · Pin {v.batteryLevel}%
                </p>
              </div>
              <StatusBadge status={v.status} />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
