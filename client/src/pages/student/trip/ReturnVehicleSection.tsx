// Owner: Bùi Quang Nhân – UC05 Return Shared Vehicle
// Chuyến đi hiện tại → chọn Hub trả → nhận vị trí đỗ → đỗ xe, xác nhận (khóa xe) → kết quả; hoặc dừng trả xe.
import { useRef, useState } from "react";
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

const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

interface AlternativeHub {
  id: string;
  name: string;
  freeSlots: number;
}

export function ReturnVehicleSection() {
  const current = useAsync(() => returnApi.getCurrentTrip(), [], { refreshEveryMs: 5000 });
  const hubs = useAsync(() => hubApi.list(), []);
  const [hubId, setHubId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [alternatives, setAlternatives] = useState<AlternativeHub[]>([]);
  const [result, setResult] = useState<ReturnResult | null>(null);

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

  const confirm = (info: CurrentTripInfo) =>
    run("confirm", async () => {
      const res = await withRequestId(`confirm:${info.trip.id}`, (reqId) =>
        returnApi.confirmReturn(reqId, info.trip.id),
      );
      setResult(res);
    });

  const abandon = (info: CurrentTripInfo) =>
    run("abandon", async () => {
      await withRequestId(`abandon:${info.trip.id}`, (reqId) => returnApi.abandonReturn(reqId, info.trip.id));
      setResult(null);
    });

  const info = current.data ?? null;
  const selectedHubId = hubId || hubs.data?.[0]?.id || "";

  return (
    <section className="space-y-3">
      {result?.outcome === "SUCCESS" && !info && <ReturnSuccess result={result} />}

      {!info ? (
        !result && (
          <Card tone="highlight">
            <p className="text-sm text-white/70">Chuyến đi hiện tại</p>
            <p className="mt-1 text-lg font-semibold">{current.loading ? "Đang tải…" : "Chưa có chuyến đi"}</p>
          </Card>
        )
      ) : (
        <Card tone="highlight" className="space-y-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-white/70">Chuyến đi hiện tại</p>
              <p className="text-2xl font-bold">{info.vehicleCode}</p>
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
