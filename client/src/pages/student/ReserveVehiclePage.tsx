/* // Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle
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
  // Tạm dùng chi tiết Hub (đã chạy) để hiển thị xe; khi làm UC02 thay bằng reservationApi.getReservableVehicles(hubId)
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
          "Lấy danh sách xe có thể đặt: reservationApi.getReservableVehicles(hubId)",
          "Chọn xe → prepareReservation → màn hình xác nhận (hạn nhận xe)",
          "Xác nhận → reservationApi.confirmReservation(requestId, hubId, vehicleId); xe vừa bị người khác đặt thì báo lỗi rõ ràng",
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
 */
import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { ApiError } from "../../api/client";
import { reservationApi } from "../../api/reservation";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { useAsync } from "../../hooks/useAsync";
import type { ReservationPreview, SharedVehicle, VehicleReservation } from "../../types";
import { estimateRangeKm, sharedVehiclePlate, vehicleTypeLabel } from "../../utils/display";
import { newRequestId } from "../../utils/requestId";

const typeLabel = (t: SharedVehicle["type"]) => vehicleTypeLabel(t);
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

export function ReserveVehiclePage() {
  const { hubId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const suggestedVehicleId = searchParams.get("vehicleId");
  const { data: hub } = useAsync(() => hubApi.detail(hubId), [hubId]);
  const vehicles = useAsync(() => reservationApi.getReservableVehicles(hubId), [hubId], { refreshEveryMs: 3000 });

  const available = vehicles.data ?? [];
  const suggested = available.find((vehicle) => vehicle.id === suggestedVehicleId);
  const orderedVehicles = suggested ? [suggested, ...available.filter((vehicle) => vehicle.id !== suggested.id)] : available;

  const [preview, setPreview] = useState<ReservationPreview | null>(null);
  const [result, setResult] = useState<VehicleReservation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  // requestId sinh MỘT lần cho mỗi lần mở màn hình xác nhận; mất mạng thì gửi lại cùng mã.
  const requestId = useRef(newRequestId());

  /** Lỗi do server từ chối (không phải mất mạng) thì lần bấm sau dùng mã mới. */
  function renewIfRejected(err: unknown) {
    if (!(err instanceof ApiError) || err.code !== "NETWORK_ERROR") requestId.current = newRequestId();
  }

  async function onSelect(vehicleId: string) {
    setError(null);
    setBusy(true);
    try {
      setPreview(await reservationApi.prepareReservation(hubId, vehicleId));
      requestId.current = newRequestId();
    } catch (err) {
      setError(err);
      void vehicles.reload();
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      setResult(await reservationApi.confirmReservation(requestId.current, hubId, preview.vehicle.id));
      setPreview(null);
    } catch (err) {
      setError(err);
      renewIfRejected(err);
      if (err instanceof ApiError && err.code === "CONFLICT") {
        setPreview(null); // xe vừa bị người khác đặt → quay lại danh sách đã làm mới
        void vehicles.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const bookedVeh = vehicles.data?.find((v) => v.id === result.vehicleId);
    return (
      <div className="space-y-4">
        <PageHeader title="Đặt xe thành công" subtitle={hub?.name} />
        <Card tone="highlight" className="space-y-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/70">Hạn nhận xe tại {hub?.name}</p>
              <p className="mt-1 text-3xl font-extrabold text-lime">{timeOf(result.pickupDeadline)}</p>
            </div>
            {bookedVeh && (
              <div className="rounded-xl bg-white px-4 py-2 text-center text-neutral-900">
                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">Biển số xe</p>
                <p className="font-mono text-sm font-extrabold">{sharedVehiclePlate(bookedVeh.code)}</p>
                <p className="text-[11px] font-semibold text-brand">{bookedVeh.code}</p>
              </div>
            )}
          </div>
          <p className="text-sm text-white/80">
            Hãy đến đúng Hub, đối chiếu biển số trên thân xe và bấm <strong>Mở khóa nhận xe</strong> trước thời hạn trên.
          </p>
        </Card>
        <Link to="/student/trips">
          <Button fullWidth>Đến trang Chuyến đi để xem xe &amp; mở khóa</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/student" className="text-sm text-neutral-500">
        ← Quay lại
      </Link>
      <PageHeader title="Đặt xe dùng chung" subtitle={hub?.name} />
      <ErrorMessage error={error} />

      {preview ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Xác nhận đặt xe</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-neutral-500">Xe</dt>
            <dd className="font-semibold">{preview.vehicle.code}</dd>
            <dt className="text-neutral-500">Loại</dt>
            <dd>{typeLabel(preview.vehicle.type)}</dd>
            <dt className="text-neutral-500">Mức pin</dt>
            <dd>{preview.vehicle.batteryLevel}%</dd>
            <dt className="text-neutral-500">Hub nhận xe</dt>
            <dd>{hub?.name}</dd>
            <dt className="text-neutral-500">Giữ xe đến</dt>
            <dd className="font-semibold">{timeOf(preview.pickupDeadline)}</dd>
          </dl>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>
              Quay lại
            </Button>
            <Button fullWidth loading={busy} onClick={() => void onConfirm()}>
              Xác nhận đặt xe
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {vehicles.loading && !vehicles.data && <Spinner />}
          {vehicles.error ? <ErrorMessage error={vehicles.error} onRetry={() => void vehicles.reload()} /> : null}
          {vehicles.data?.length === 0 && (
            <EmptyState title="Hub này hiện không còn xe có thể đặt" description="Hãy chọn Hub khác ở Trang chủ." />
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {orderedVehicles.map((v) => (
              <li key={v.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-neutral-300 bg-surface px-3 py-1.5 text-center dark:border-white/15 dark:bg-white/5">
                      <p className="font-mono text-xs font-extrabold">{sharedVehiclePlate(v.code)}</p>
                      <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">{v.code}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{typeLabel(v.type)}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Pin <strong className="text-emerald-700 dark:text-lime">{v.batteryLevel}%</strong> · ~
                        {estimateRangeKm(v.batteryLevel, v.type)} km
                      </p>
                    </div>
                  </div>
                  <Button disabled={busy} onClick={() => void onSelect(v.id)} className="shrink-0 px-4 py-2 text-xs">
                    Chọn xe
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
