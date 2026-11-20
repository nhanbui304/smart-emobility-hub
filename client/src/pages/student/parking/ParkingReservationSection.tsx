// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation, mục 2.3.1
// Chọn Hub, xe, khung giờ → xem vị trí trống → giữ tạm (đếm ngược) → xác nhận đặt chỗ / bỏ giữ → hủy đặt chỗ.
import { useEffect, useRef, useState } from "react";
import { authApi } from "../../../api/auth";
import { ApiError } from "../../../api/client";
import { hubApi } from "../../../api/hubs";
import { parkingApi } from "../../../api/parking";
import { newRequestId } from "../../../api/requestId";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { ErrorMessage } from "../../../components/ErrorMessage";
import { Spinner } from "../../../components/Spinner";
import { StatusBadge } from "../../../components/StatusBadge";
import { useAsync } from "../../../hooks/useAsync";
import type { ActiveHold, ParkingAllocation, ParkingBooking, ParkingSlot } from "../../../types";

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

function tomorrowDate(): string {
  const d = new Date(Date.now() + 24 * 3_600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatRange(start: string, end: string): string {
  return `${timeFormat.format(new Date(start))} – ${timeFormat.format(new Date(end))}`;
}

export function ParkingReservationSection() {
  const vehicles = useAsync(() => authApi.myVehicles(), []);
  const hubs = useAsync(() => hubApi.list(), []);
  // Lượt giữ còn hạn được lấy từ server nên tải lại trang vẫn thấy, và không được gia hạn (Ext 7b)
  const activeHold = useAsync(() => parkingApi.getActiveHold(), [], { refreshEveryMs: 10_000 });

  const [hubId, setHubId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(tomorrowDate());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("10:00");
  const [slots, setSlots] = useState<ParkingSlot[] | null>(null);
  const [slotCodes, setSlotCodes] = useState<Record<string, string>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [booking, setBooking] = useState<ParkingBooking | null>(null);
  const [cancelledBooking, setCancelledBooking] = useState<ParkingAllocation | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!hubId && hubs.data?.[0]) setHubId(hubs.data[0].id);
  }, [hubs.data, hubId]);
  useEffect(() => {
    if (!vehicleId && vehicles.data?.[0]) setVehicleId(vehicles.data[0].id);
  }, [vehicles.data, vehicleId]);

  const pendingReq = useRef<Record<string, string>>({});

  /** Giữ nguyên requestId khi gặp NETWORK_ERROR để bấm thử lại không gửi trùng thao tác. */
  async function withRequestId<T>(key: string, fn: (requestId: string) => Promise<T>): Promise<T> {
    const requestId = (pendingReq.current[key] ??= newRequestId());
    try {
      const res = await fn(requestId);
      delete pendingReq.current[key];
      return res;
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "NETWORK_ERROR")) {
        delete pendingReq.current[key];
      }
      throw err;
    }
  }

  const timeRange = () => {
    if (!date || !startTime || !endTime) {
      throw new Error("Vui lòng chọn đầy đủ ngày, giờ bắt đầu và giờ kết thúc.");
    }
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Ngày hoặc giờ không hợp lệ.");
    }
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  };

  function rememberCodes(list: ParkingSlot[]) {
    setSlotCodes((prev) => ({ ...prev, ...Object.fromEntries(list.map((s) => [s.id, s.code])) }));
  }

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const search = () =>
    run("search", async () => {
      setSelectedSlotId(null);
      setBooking(null);
      setCancelledBooking(null);
      const found = await parkingApi.searchAvailableSlots(hubId, vehicleId, timeRange());
      setSlots(found);
      rememberCodes(found);
      if (found.length === 0) setNotice("Không còn vị trí phù hợp trong khung giờ này. Hãy đổi Hub hoặc thời gian.");
    });

  const hold = () =>
    run("hold", async () => {
      if (!selectedSlotId) return;
      const range = timeRange();
      try {
        await withRequestId(`hold:${selectedSlotId}:${vehicleId}:${range.startTime}:${range.endTime}`, (reqId) =>
          parkingApi.holdSlot(reqId, selectedSlotId, vehicleId, range),
        );
        setSlots(null);
        await activeHold.reload();
      } catch (err) {
        // Ext 5a: vị trí vừa bị giữ → cập nhật danh sách; Ext 5b: đang có lượt giữ khác → hiển thị lượt đó
        const details = err instanceof ApiError ? (err.details as { slots?: ParkingSlot[] } | undefined) : undefined;
        if (details?.slots) {
          setSlots(details.slots);
          rememberCodes(details.slots);
          setSelectedSlotId(null);
        }
        await activeHold.reload();
        throw err;
      }
    });

  const confirm = (current: ActiveHold) =>
    run("confirm", async () => {
      try {
        const confirmed = await withRequestId(`confirm:${current.hold.id}`, (reqId) =>
          parkingApi.confirmReservation(reqId, current.hold.id),
        );
        setBooking(confirmed);
      } finally {
        await activeHold.reload();
      }
    });

  const releaseHold = (current: ActiveHold) =>
    run("release", async () => {
      await withRequestId(`release:${current.hold.id}`, (reqId) => parkingApi.cancelHold(reqId, current.hold.id));
      setNotice("Đã bỏ lượt giữ chỗ.");
      await activeHold.reload();
    });

  const cancelBooking = (current: ParkingBooking) =>
    run("cancelBooking", async () => {
      setCancelledBooking(await parkingApi.cancelBooking(current.allocation.id));
      setBooking(null);
    });

  if (vehicles.loading || hubs.loading) return <Spinner />;
  const currentHold = activeHold.data ?? null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Đặt chỗ đỗ</h2>
      <ErrorMessage error={vehicles.error ?? hubs.error ?? activeHold.error} />

      {booking && <BookingCard booking={booking} busy={busy} onCancel={() => void cancelBooking(booking)} />}
      {cancelledBooking && (
        <Card className="p-4 text-sm">
          <StatusBadge status={cancelledBooking.status} /> Đặt chỗ {slotCodes[cancelledBooking.slotId] ?? ""} đã được hủy.
        </Card>
      )}

      {currentHold ? (
        <HoldCard
          hold={currentHold}
          slotCode={slotCodes[currentHold.hold.slotId]}
          busy={busy}
          onConfirm={() => void confirm(currentHold)}
          onRelease={() => void releaseHold(currentHold)}
          onExpired={() => void activeHold.reload()}
        />
      ) : (
        !booking && (
          <Card className="space-y-4 p-4">
            {vehicles.data?.length === 0 && (
              <p className="text-sm text-neutral-500">Bạn chưa có phương tiện cá nhân nên chưa đặt chỗ đỗ được.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label htmlFor="parking-hub" className="label">
                  Hub
                </label>
                <select id="parking-hub" className="input" value={hubId} onChange={(e) => setHubId(e.target.value)}>
                  {hubs.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="parking-vehicle" className="label">
                  Phương tiện
                </label>
                <select
                  id="parking-vehicle"
                  className="input"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  {vehicles.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.type === "E_BIKE" ? "Xe đạp điện" : "Xe máy điện"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label htmlFor="parking-date" className="label">
                  Ngày
                </label>
                <input
                  id="parking-date"
                  type="date"
                  className="input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="parking-start" className="label">
                  Từ
                </label>
                <input
                  id="parking-start"
                  type="time"
                  className="input"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="parking-end" className="label">
                  Đến
                </label>
                <input
                  id="parking-end"
                  type="time"
                  className="input"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <Button
              fullWidth
              variant="dark"
              loading={busy === "search"}
              disabled={!hubId || !vehicleId}
              onClick={() => void search()}
            >
              Tìm vị trí trống
            </Button>

            {slots && slots.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {slots.length} vị trí trống. Chọn một vị trí rồi bấm Giữ chỗ (xem danh sách chưa giữ chỗ).
                </p>
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Vị trí đỗ">
                  {slots.map((s) => (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={selectedSlotId === s.id}
                      onClick={() => setSelectedSlotId(s.id)}
                      className={`rounded-lg px-2 py-2.5 text-sm font-semibold transition ${
                        selectedSlotId === s.id
                          ? "bg-brand text-white dark:bg-lime dark:text-brand-dark"
                          : "bg-surface hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10"
                      }`}
                    >
                      {s.code}
                    </button>
                  ))}
                </div>
                <Button fullWidth loading={busy === "hold"} disabled={!selectedSlotId} onClick={() => void hold()}>
                  Giữ chỗ
                </Button>
              </div>
            )}
          </Card>
        )
      )}

      {notice && <p className="rounded-xl bg-surface px-4 py-3 text-sm dark:bg-white/5">{notice}</p>}
      <ErrorMessage error={error} />
    </section>
  );
}

/** UC06 bước 6–7: thông tin lượt giữ, hạn giữ và thời gian còn lại; xác nhận hoặc bỏ giữ. */
function HoldCard({
  hold,
  slotCode,
  busy,
  onConfirm,
  onRelease,
  onExpired,
}: {
  hold: ActiveHold;
  slotCode?: string;
  busy: string | null;
  onConfirm: () => void;
  onRelease: () => void;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState(hold.remainingSeconds);
  useEffect(() => {
    setRemaining(hold.remainingSeconds);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = Math.max(0, hold.remainingSeconds - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold.hold.id, hold.remainingSeconds]);

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  return (
    <Card tone="highlight" className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white/70">Đang giữ chỗ</p>
          <p className="text-2xl font-bold">{slotCode ?? "Vị trí đã chọn"}</p>
          <p className="mt-1 text-sm text-white/80">{formatRange(hold.hold.startTime, hold.hold.endTime)}</p>
        </div>
        <div className="text-right" aria-live="polite">
          <p className="text-xs text-white/70">Còn lại</p>
          <p className="text-2xl font-bold tabular-nums">
            {minutes}:{seconds}
          </p>
        </div>
      </div>
      <p className="text-xs text-white/70">
        Hạn giữ: {hold.hold.holdExpiresAt ? timeFormat.format(new Date(hold.hold.holdExpiresAt)) : "–"}. Quá hạn mà chưa
        xác nhận thì vị trí được giải phóng; tải lại trang không gia hạn.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" loading={busy === "release"} onClick={onRelease}>
          Bỏ giữ chỗ
        </Button>
        <Button loading={busy === "confirm"} disabled={remaining === 0} onClick={onConfirm}>
          Xác nhận đặt chỗ
        </Button>
      </div>
    </Card>
  );
}

/** UC06 bước 9: mã đặt chỗ, Hub, vị trí, khung giờ, điều kiện đến sử dụng; Cancel Parking Reservation. */
function BookingCard({
  booking,
  busy,
  onCancel,
}: {
  booking: ParkingBooking;
  busy: string | null;
  onCancel: () => void;
}) {
  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Đặt chỗ thành công</p>
        <StatusBadge status={booking.allocation.status} />
      </div>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-neutral-500">Mã đặt chỗ</dt>
        <dd className="font-mono font-semibold">{booking.allocation.id.slice(0, 8).toUpperCase()}</dd>
        <dt className="text-neutral-500">Vị trí</dt>
        <dd className="font-semibold">{booking.slotCode}</dd>
        <dt className="text-neutral-500">Khung giờ</dt>
        <dd>{formatRange(booking.allocation.startTime, booking.allocation.endTime)}</dd>
      </dl>
      <p className="rounded-lg bg-surface px-3 py-2 text-sm dark:bg-white/5">{booking.arrivalConditions}</p>
      <Button variant="outline" fullWidth loading={busy === "cancelBooking"} onClick={onCancel}>
        Hủy đặt chỗ
      </Button>
    </Card>
  );
}
