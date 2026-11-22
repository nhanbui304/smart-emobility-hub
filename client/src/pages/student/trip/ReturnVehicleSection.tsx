// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Chuyến đi hiện tại → chọn Hub trả → nhận vị trí đỗ → đỗ xe, xác nhận (khóa xe) → kết quả; hoặc dừng trả xe.
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../../api/client";
import { hubApi } from "../../../api/hubs";
import { newRequestId } from "../../../api/requestId";
import { returnApi } from "../../../api/return";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { ErrorMessage } from "../../../components/ErrorMessage";
import { StatusBadge } from "../../../components/StatusBadge";
import { useAsync } from "../../../hooks/useAsync";
import type { CurrentTripInfo, ReturnResult } from "../../../types";
import { sharedVehiclePlate } from "../../../utils/display";

const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

interface AlternativeHub {
  id: string;
  name: string;
  freeSlots: number;
}

interface PendingConfirm {
  tripId: string;
  requestId: string;
}

const PENDING_CONFIRM_KEY = "smart-emobility:pending-return-confirm";

function loadPendingConfirm(): PendingConfirm | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CONFIRM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingConfirm>;
    if (typeof parsed.tripId === "string" && typeof parsed.requestId === "string") {
      return { tripId: parsed.tripId, requestId: parsed.requestId };
    }
  } catch {
    // sessionStorage không khả dụng
  }
  return null;
}

function savePendingConfirm(value: PendingConfirm | null): void {
  try {
    if (value) sessionStorage.setItem(PENDING_CONFIRM_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_CONFIRM_KEY);
  } catch {
    // bỏ qua lỗi storage
  }
}

export function ReturnVehicleSection({
  hideEmpty = false,
  reloadSignal,
  onStatusChange,
}: {
  hideEmpty?: boolean;
  reloadSignal?: string;
  onStatusChange?: (state: { loading: boolean; hasTrip: boolean; hasReturnResult: boolean }) => void;
}) {
  const current = useAsync(() => returnApi.getCurrentTrip(), [], { refreshEveryMs: 5000 });
  const hubs = useAsync(() => hubApi.list(), []);
  const [hubId, setHubId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [alternatives, setAlternatives] = useState<AlternativeHub[]>([]);
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(loadPendingConfirm);

  const pendingReq = useRef<Record<string, string>>({});
  const confirming = useRef(false);
  const autoRecoveredReqId = useRef<string | null>(null);

  function updatePendingConfirm(next: PendingConfirm | null) {
    setPendingConfirm(next);
    savePendingConfirm(next);
  }

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
      await current.reload();
    }
  }

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

  const prepare = (info: CurrentTripInfo, targetHubId: string) =>
    run("prepare", async () => {
      setAlternatives([]);
      setResult(null);
      try {
        await withRequestId(`prepare:${info.trip.id}:${targetHubId}`, (reqId) =>
          returnApi.prepareReturn(reqId, info.trip.id, targetHubId),
        );
      } catch (err) {
        // Ext 3a: Hub hết chỗ → gợi ý Hub khác
        const details = err instanceof ApiError ? (err.details as { alternativeHubs?: AlternativeHub[] }) : undefined;
        setAlternatives(details?.alternativeHubs ?? []);
        throw err;
      }
    });

  async function sendConfirmation(pending: PendingConfirm) {
    if (confirming.current) return;
    confirming.current = true;
    setResult(null);
    // Lưu mã trước khi gửi để tải lại trang vẫn khôi phục được kết quả nếu mất phản hồi.
    updatePendingConfirm(pending);
    await run("confirm", async () => {
      try {
        const res = await returnApi.confirmReturn(pending.requestId, pending.tripId);
        updatePendingConfirm(null);
        setResult(res);
      } catch (err) {
        const retryable = err instanceof ApiError && (
          err.code === "NETWORK_ERROR" ||
          (err.details as { code?: string } | undefined)?.code === "RETURN_CONFIRM_IN_PROGRESS"
        );
        if (!retryable) updatePendingConfirm(null);
        throw err;
      } finally {
        confirming.current = false;
      }
    });
  }

  const confirm = (info: CurrentTripInfo) =>
    sendConfirmation({
      tripId: info.trip.id,
      requestId: pendingConfirm?.tripId === info.trip.id ? pendingConfirm.requestId : newRequestId(),
    });

  const abandon = (info: CurrentTripInfo) =>
    run("abandon", async () => {
      await withRequestId(`abandon:${info.trip.id}`, (reqId) => returnApi.abandonReturn(reqId, info.trip.id));
      updatePendingConfirm(null);
      setResult(null);
    });

  // Ext 9b: sau khi mất kết nối, nếu server đã kết thúc chuyến (/trips/current trả null) thì gửi lại đúng requestId cũ để lấy lại kết quả trả xe
  useEffect(() => {
    if (!pendingConfirm) return;
    if (current.data && current.data.trip.id !== pendingConfirm.tripId) {
      updatePendingConfirm(null);
      return;
    }
    if (current.loading || current.error || current.data || confirming.current || busy === "confirm") return;
    if (autoRecoveredReqId.current === pendingConfirm.requestId) return;
    autoRecoveredReqId.current = pendingConfirm.requestId;
    void sendConfirmation(pendingConfirm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.loading, current.error, current.data, pendingConfirm, busy]);

  const info = current.data ?? null;
  const selectedHubId = hubId || hubs.data?.[0]?.id || "";
  const lastReloadSignal = useRef<string | undefined>(reloadSignal);

  useEffect(() => {
    if (!reloadSignal || reloadSignal === lastReloadSignal.current) return;
    lastReloadSignal.current = reloadSignal;
    setResult(null);
    setError(null);
    void current.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadSignal]);

  useEffect(() => {
    onStatusChange?.({
      loading: current.loading && current.data === undefined,
      hasTrip: Boolean(info || pendingConfirm),
      hasReturnResult: result?.outcome === "SUCCESS",
    });
  }, [current.loading, current.data, info, pendingConfirm, result, onStatusChange]);

  if (!info && !pendingConfirm && result?.outcome !== "SUCCESS" && !error && !current.error && hideEmpty) {
    return null;
  }

  return (
    <section className="space-y-3">
      {result?.outcome === "SUCCESS" && !info && <ReturnSuccess result={result} />}

      {!info ? (
        (pendingConfirm ? (
          <Card className="space-y-3 p-5">
            <p className="font-semibold">Đang khôi phục kết quả trả xe</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              Kết nối vừa bị gián đoạn trong lúc xác nhận trả xe. Bấm bên dưới để kiểm tra lại kết quả đã ghi nhận trên
              hệ thống.
            </p>
            <Button fullWidth loading={busy === "confirm"} onClick={() => void sendConfirmation(pendingConfirm)}>
              Kiểm tra lại kết quả trả xe
            </Button>
          </Card>
        ) : !result && !hideEmpty && (
          <Card tone="highlight">
            <p className="text-sm text-white/70">Xe đang thuê</p>
            <p className="mt-1 text-lg font-semibold">{current.loading ? "Đang tải…" : "Chưa có chuyến đi"}</p>
          </Card>
        ))
      ) : (
        <Card tone="highlight" className="space-y-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-lime">Xe đang thuê</p>
              <div className="mt-1 flex flex-wrap items-center gap-2.5">
                <span className="rounded-lg bg-white px-2.5 py-1 font-mono text-sm font-extrabold text-neutral-900">
                  {sharedVehiclePlate(info.vehicleCode)}
                </span>
                <p className="text-xl font-bold">{info.vehicleCode}</p>
              </div>
              <p className="text-sm text-white/80">
                {info.vehicleType === "E_BIKE" ? "Xe đạp điện" : "Xe máy điện"} · Pin {info.batteryLevel}% · Bắt đầu{" "}
                {timeFormat.format(new Date(info.trip.startedAt))}
              </p>
            </div>
            <StatusBadge status={info.trip.status} />
          </div>
        </Card>
      )}

      {info?.trip.status === "ACTIVE" && (
        <Card className="space-y-3 p-4">
          <p className="font-semibold">Trả xe</p>
          <div>
            <label htmlFor="return-hub" className="label">
              Hub trả xe
            </label>
            <select
              id="return-hub"
              className="input"
              value={selectedHubId}
              onChange={(e) => setHubId(e.target.value)}
            >
              {hubs.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} · còn {h.freeSlots} chỗ
                </option>
              ))}
            </select>
          </div>
          <Button fullWidth variant="dark" loading={busy === "prepare"} onClick={() => void prepare(info, selectedHubId)}>
            Nhận vị trí đỗ
          </Button>
          {alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">Hub gợi ý còn chỗ:</p>
              {alternatives.map((h) => (
                <button
                  key={h.id}
                  onClick={() => {
                    setHubId(h.id);
                    void prepare(info, h.id);
                  }}
                  className="flex w-full items-center justify-between rounded-lg bg-surface px-3 py-2.5 text-sm font-semibold hover:bg-neutral-200 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <span>{h.name}</span>
                  <span className="text-neutral-500">còn {h.freeSlots} chỗ →</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {info?.trip.status === "RETURN_IN_PROGRESS" && (
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm text-neutral-500">Đưa xe vào vị trí</p>
            <p className="text-3xl font-bold">{info.returnSlotCode}</p>
            <p className="text-sm text-neutral-500">tại {info.returnHubName}</p>
          </div>
          {result?.outcome === "FAILED" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Khóa xe chưa thành công. Kiểm tra xe đã vào hẳn vị trí rồi bấm thử lại, hoặc liên hệ Operator. Vị trí vẫn
              được giữ cho bạn.
            </p>
          )}
          <Button fullWidth loading={busy === "confirm"} onClick={() => void confirm(info)}>
            {result?.outcome === "FAILED" ? "Thử khóa xe lại" : "Đã đỗ xe – Khóa và trả xe"}
          </Button>
          <Button fullWidth variant="ghost" loading={busy === "abandon"} onClick={() => void abandon(info)}>
            Dừng trả xe
          </Button>
        </Card>
      )}

      {info?.trip.status === "PENDING_RECONCILIATION" && (
        <Card className="space-y-2 p-5">
          <p className="font-semibold">Đang chờ xác minh</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Hệ thống chưa xác định được kết quả khóa xe tại {info.returnSlotCode} ({info.returnHubName}). Operator đã
            được báo để kiểm tra; bạn không cần thao tác thêm.
          </p>
        </Card>
      )}

      <ErrorMessage error={error ?? current.error} />
    </section>
  );
}

/** UC05 bước 9: kết quả trả xe thành công. */
function ReturnSuccess({ result }: { result: ReturnResult }) {
  return (
    <Card className="space-y-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">Trả xe thành công</p>
        <StatusBadge status={result.trip.status} />
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Chuyến đi kết thúc lúc {result.returnedAt ? timeFormat.format(new Date(result.returnedAt)) : "–"}. Xe đã được khóa
        tại vị trí trả. Cảm ơn bạn!
      </p>
      {result.pendingReconciliation && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Hệ thống đang đối soát dữ liệu trả xe; Operator sẽ kiểm tra, bạn không cần thao tác thêm.
        </p>
      )}
    </Card>
  );
}
