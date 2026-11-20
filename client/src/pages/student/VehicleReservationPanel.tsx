// Owner: Lê Quốc Linh – UC03 Cancel Vehicle Reservation, UC04 Pick Up Shared Vehicle
// Tách riêng khỏi ActiveTripPage để Quang Nhân (UC05) sửa trang đó mà không đụng phần này.
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { hubApi } from "../../api/hubs";
import { pickUpApi } from "../../api/pickUp";
import { reservationApi } from "../../api/reservation";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type { CancellationPreview, PickUpPreview, Trip, VehicleReservation } from "../../types";
import { newRequestId } from "../../utils/requestId";

type Mode = "idle" | "pickup" | "cancel";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function VehicleReservationPanel({ onTripStarted }: { onTripStarted: (trip: Trip) => void }) {
  const { data, loading, error, reload } = useAsync(() => reservationApi.getMyReservations(), [], {
    refreshEveryMs: 3000,
  });

  return (
    <div className="space-y-3">
      <ErrorMessage error={error} onRetry={() => void reload()} />
      {!loading && !error && data?.length === 0 && (
        <EmptyState title="Chưa có đặt xe" description="Đặt xe ở Trang chủ, rồi quay lại đây để nhận xe." />
      )}
      {data?.map((r) => (
        <ReservationCard key={r.id} reservation={r} onChanged={() => void reload()} onTripStarted={onTripStarted} />
      ))}
    </div>
  );
}

function ReservationCard({
  reservation,
  onChanged,
  onTripStarted,
}: {
  reservation: VehicleReservation;
  onChanged: () => void;
  onTripStarted: (trip: Trip) => void;
}) {
  const hub = useAsync(() => hubApi.detail(reservation.hubId), [reservation.hubId]);
  const vehicle = hub.data?.vehicles.find((v) => v.id === reservation.vehicleId);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = new Date(reservation.pickupDeadline).getTime() - now;

  const [mode, setMode] = useState<Mode>("idle");
  const [pickUpPreview, setPickUpPreview] = useState<PickUpPreview | null>(null);
  const [cancelPreview, setCancelPreview] = useState<CancellationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // requestId sinh một lần cho mỗi lần mở màn hình xác nhận; chỉ giữ lại khi mất mạng.
  const requestId = useRef(newRequestId());

  function renewIfRejected(e: unknown) {
    if (!(e instanceof ApiError) || e.code !== "NETWORK_ERROR") requestId.current = newRequestId();
  }

  function close() {
    setMode("idle");
    setPickUpPreview(null);
    setCancelPreview(null);
  }

  async function openPickUp() {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      setPickUpPreview(await pickUpApi.preparePickUp(reservation.id));
      requestId.current = newRequestId();
      setMode("pickup");
    } catch (e) {
      setErr(e);
      onChanged(); // đặt xe có thể vừa hết hạn / bị ảnh hưởng → tải lại danh sách
    } finally {
      setBusy(false);
    }
  }

  async function confirmPickUp() {
    setErr(null);
    setBusy(true);
    try {
      const res = await pickUpApi.confirmPickUp(requestId.current, reservation.id);
      requestId.current = newRequestId();
      close();
      if (res.outcome === "SUCCESS" && res.trip) {
        onTripStarted(res.trip);
      } else if (res.outcome === "FAILED") {
        setNotice(
          res.reservation.status === "RESERVED"
            ? "Mở khóa không thành công. Đặt xe vẫn được giữ, bạn có thể thử nhận xe lại."
            : "Mở khóa không thành công và đặt xe đã hết hạn. Vui lòng đặt lại.",
        );
      } else {
        setNotice("Chưa xác định được kết quả mở khóa. Đặt xe đang chờ xác minh, xe không được cấp cho người khác.");
      }
      onChanged();
    } catch (e) {
      setErr(e);
      renewIfRejected(e);
    } finally {
      setBusy(false);
    }
  }

  async function openCancel() {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      setCancelPreview(await reservationApi.prepareCancellation(reservation.id));
      requestId.current = newRequestId();
      setMode("cancel");
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function confirmCancel() {
    setErr(null);
    setBusy(true);
    try {
      await reservationApi.confirmCancellation(requestId.current, reservation.id);
      requestId.current = newRequestId();
      close();
      onChanged();
    } catch (e) {
      setErr(e);
      renewIfRejected(e);
    } finally {
      setBusy(false);
    }
  }

  const canAct = reservation.status === "RESERVED";

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">Đặt xe dùng chung</p>
          <p className="text-lg font-bold">{vehicle?.code ?? "Xe đã đặt"}</p>
          <p className="text-xs text-neutral-500">
            {hub.data?.name ?? "..."}
            {vehicle ? ` · Pin ${vehicle.batteryLevel}%` : ""}
          </p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      {canAct && (
        <p className={`text-sm ${remaining <= 0 ? "font-semibold text-red-600" : ""}`}>
          {remaining > 0 ? (
            <>
              Hạn nhận xe còn <span className="font-mono font-bold">{formatRemaining(remaining)}</span>
            </>
          ) : (
            "Đã quá hạn nhận xe, hệ thống sẽ giải phóng xe trong giây lát."
          )}
        </p>
      )}
      {!canAct && (
        <p className="text-sm text-neutral-500">Đang bàn giao hoặc chờ xác minh kết quả mở khóa; tạm thời chưa thao tác được.</p>
      )}

      {notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">{notice}</p>}
      <ErrorMessage error={err} />

      {mode === "pickup" && pickUpPreview && (
        <div className="space-y-2 rounded-xl bg-surface p-3 text-sm dark:bg-white/5">
          <p className="font-semibold">Xác nhận nhận xe {pickUpPreview.vehicleCode}</p>
          <p>Mức pin: {pickUpPreview.batteryLevel}%</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>
              Đóng
            </Button>
            <Button fullWidth loading={busy} onClick={() => void confirmPickUp()}>
              Mở khóa và nhận xe
            </Button>
          </div>
        </div>
      )}

      {mode === "cancel" && cancelPreview && (
        <div className="space-y-2 rounded-xl bg-surface p-3 text-sm dark:bg-white/5">
          <p>{cancelPreview.message}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close} disabled={busy}>
              Không hủy
            </Button>
            <Button variant="danger" fullWidth loading={busy} disabled={!cancelPreview.cancellationAllowed} onClick={() => void confirmCancel()}>
              Xác nhận hủy đặt xe
            </Button>
          </div>
        </div>
      )}

      {mode === "idle" && canAct && (
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void openCancel()}>
            Hủy đặt xe
          </Button>
          <Button fullWidth loading={busy} disabled={remaining <= 0} onClick={() => void openPickUp()}>
            Nhận xe
          </Button>
        </div>
      )}
    </Card>
  );
}
