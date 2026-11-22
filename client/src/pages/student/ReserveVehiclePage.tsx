// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { hubApi } from "../../api/hubs";
import { reservationApi } from "../../api/reservation";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { useAsync } from "../../hooks/useAsync";
import type { ReservationPreview, VehicleReservation } from "../../types";
import { estimateRangeKm, sharedVehiclePlate, vehicleTypeLabel } from "../../utils/display";
import { newRequestId } from "../../utils/requestId";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export function ReserveVehiclePage() {
  const { hubId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const suggestedVehicleId = searchParams.get("vehicleId");

  const hubs = useAsync(() => hubApi.list(), []);
  const vehicles = useAsync(() => reservationApi.getReservableVehicles(hubId), [hubId]);
  const hub = hubs.data?.find((h) => h.id === hubId);

  const available = vehicles.data ?? [];
  const suggested = available.find((vehicle) => vehicle.id === suggestedVehicleId);
  const orderedVehicles = suggested
    ? [suggested, ...available.filter((vehicle) => vehicle.id !== suggested.id)]
    : available;

  const [preview, setPreview] = useState<ReservationPreview | null>(null);
  const [result, setResult] = useState<VehicleReservation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoPreparing, setAutoPreparing] = useState(Boolean(suggestedVehicleId));

  // requestId sinh MỘT lần cho mỗi lần mở màn hình xác nhận; mất mạng thì gửi lại cùng mã.
  const requestId = useRef(newRequestId());
  const autoPreparedKey = useRef<string | null>(null);

  /** Khi đi từ chọn xe trực tiếp (URL có ?vehicleId=...), tự động mở thẳng bước xác nhận đúng xe đó. */
  useEffect(() => {
    if (!hubId || !suggestedVehicleId) {
      setAutoPreparing(false);
      return;
    }
    const key = `${hubId}:${suggestedVehicleId}`;
    if (autoPreparedKey.current === key) return;
    autoPreparedKey.current = key;

    let cancelled = false;
    setAutoPreparing(true);
    setError(null);
    setUnavailableNotice(null);
    setPreview(null);

    void reservationApi
      .prepareReservation(hubId, suggestedVehicleId)
      .then((res) => {
        if (cancelled) return;
        setPreview(res);
        requestId.current = newRequestId();
      })
      .catch((err) => {
        if (cancelled) return;
        // Xe vừa hết khả dụng hoặc không thuộc Hub này -> báo rõ, không tự thay bằng xe khác
        const reason = err instanceof Error ? err.message : "Xe không còn khả dụng để đặt.";
        setUnavailableNotice(
          `Xe bạn vừa chọn hiện không còn khả dụng (${reason}). Vui lòng chọn một xe khác trong danh sách bên dưới.`,
        );
        setSearchParams({}, { replace: true });
        void vehicles.reload();
      })
      .finally(() => {
        if (!cancelled) setAutoPreparing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubId, suggestedVehicleId]);

  /** Lỗi do server từ chối (không phải mất mạng) thì lần bấm sau dùng mã mới. */
  function renewIfRejected(err: unknown) {
    if (!(err instanceof ApiError) || err.code !== "NETWORK_ERROR") requestId.current = newRequestId();
  }

  async function onSelect(vehicleId: string) {
    setError(null);
    setUnavailableNotice(null);
    setBusy(true);
    try {
      setPreview(await reservationApi.prepareReservation(hubId, vehicleId));
      requestId.current = newRequestId();
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Xe vừa hết khả dụng.";
      setUnavailableNotice(`Không thể chuẩn bị đặt xe này (${reason}). Vui lòng chọn xe khác.`);
      void vehicles.reload();
    } finally {
      setBusy(false);
    }
  }

  function backToList() {
    setPreview(null);
    setError(null);
    if (suggestedVehicleId) {
      setSearchParams({}, { replace: true });
    }
  }

  async function onConfirm() {
    if (!preview) return;
    setError(null);
    setUnavailableNotice(null);
    setBusy(true);
    try {
      setResult(await reservationApi.confirmReservation(requestId.current, hubId, preview.vehicle.id));
      setPreview(null);
    } catch (err) {
      renewIfRejected(err);
      if (err instanceof ApiError && (err.code === "CONFLICT" || err.code === "NOT_FOUND")) {
        setPreview(null);
        setUnavailableNotice(
          `${err.message || "Xe vừa hết khả dụng."} Vui lòng chọn lại một xe khác trong danh sách đã làm mới.`,
        );
        if (suggestedVehicleId) setSearchParams({}, { replace: true });
        void vehicles.reload();
      } else {
        setError(err);
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
      <Link to="/student" className="text-sm text-neutral-500 hover:underline">
        ← Quay lại Khám phá Hub
      </Link>
      <PageHeader title="Đặt xe dùng chung" subtitle={hub?.name} />
      <ErrorMessage error={error} />

      {unavailableNotice && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {unavailableNotice}
        </div>
      )}

      {autoPreparing ? (
        <Card className="flex items-center justify-center gap-3 p-8">
          <Spinner />
          <span className="text-sm text-neutral-500">Đang kiểm tra trạng thái xe bạn đã chọn...</span>
        </Card>
      ) : preview ? (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand dark:text-lime">
                Xác nhận đặt xe
              </p>
              <h2 className="mt-0.5 text-lg font-bold">{hub?.name ?? "Mobility Hub"}</h2>
            </div>
            <div className="rounded-xl border-2 border-brand bg-emerald-50/70 px-3.5 py-2 text-center dark:border-lime dark:bg-lime/10">
              <p className="text-[9px] font-bold uppercase tracking-wider text-brand dark:text-lime">Biển số</p>
              <p className="font-mono text-sm font-extrabold">{sharedVehiclePlate(preview.vehicle.code)}</p>
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-lime">{preview.vehicle.code}</p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface p-3.5 text-sm dark:bg-white/5">
            <div>
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">Hub nhận xe</dt>
              <dd className="font-semibold">{hub?.name ?? preview.hubId}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">Loại xe</dt>
              <dd className="font-semibold">{vehicleTypeLabel(preview.vehicle.type)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">Mức pin</dt>
              <dd className="font-semibold text-emerald-700 dark:text-lime">
                {preview.vehicle.batteryLevel}% (~{estimateRangeKm(preview.vehicle.batteryLevel, preview.vehicle.type)} km)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">Giữ xe đến</dt>
              <dd className="font-semibold">{timeOf(preview.pickupDeadline)}</dd>
            </div>
          </dl>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Lượt đặt chỉ được tạo khi bạn bấm <strong>Xác nhận đặt xe</strong>.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={backToList} disabled={busy}>
              Chọn xe khác
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
          <ul data-tour="st-reserve-list" className="grid gap-3 md:grid-cols-2">
            {orderedVehicles.map((v) => (
              <li key={v.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-neutral-300 bg-surface px-3 py-1.5 text-center dark:border-white/15 dark:bg-white/5">
                      <p className="font-mono text-xs font-extrabold">{sharedVehiclePlate(v.code)}</p>
                      <p className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">{v.code}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{vehicleTypeLabel(v.type)}</p>
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
