// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
/* import { PageHeader } from "../../components/PageHeader";
import { StubNotice } from "../../components/StubNotice";

export function RedistributionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Điều chuyển xe" subtitle="Chuyển xe từ Hub thừa sang Hub thiếu" />
      <StubNotice
        owner="Lê Quốc Linh"
        useCases="UC12"
        todo={[
          "Chọn Hub nguồn, Hub đích, danh sách xe AVAILABLE → createRedistributionOrder",
          "Theo dõi từng xe: xác nhận rời Hub / tới Hub",
          "Hủy các xe chưa xuất phát",
        ]}
      />
    </div>
  );
}
 */
// Owner: Lê Quốc Linh – UC12 Coordinate Vehicle Redistribution
import { useState } from "react";
import { hubApi } from "../../api/hubs";
import { redistributionApi } from "../../api/redistribution";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type { RedistributionItem, RedistributionOrder, RedistributionPreview } from "../../types";
import { newRequestId } from "../../utils/requestId";

/** Lệnh điều chuyển kèm tiến độ từng xe (server trả thêm `items`) và mã xe để hiển thị. */
type OrderView = RedistributionOrder & { items: RedistributionItem[]; vehicleCodes: Record<string, string> };

const STORAGE_KEY = "smart-emobility:redistribution-orders";

function loadOrders(): OrderView[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as OrderView[];
  } catch {
    return [];
  }
}

/** Mặc định ETA = 30 phút nữa, định dạng cho ô datetime-local (giờ địa phương). */
function defaultEta(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function RedistributionPage() {
  const hubs = useAsync(() => hubApi.list(), []);
  const [sourceHubId, setSourceHubId] = useState("");
  const [targetHubId, setTargetHubId] = useState("");
  const [eta, setEta] = useState(defaultEta);
  const [preview, setPreview] = useState<RedistributionPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [orders, setOrders] = useState<OrderView[]>(loadOrders);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const hubName = (id: string) => hubs.data?.find((h) => h.id === id)?.name ?? "Hub";

  function saveOrders(next: OrderView[]) {
    setOrders(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* chỉ là tiện ích hiển thị */
    }
  }

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setError(null);
    setBusy(true);
    try {
      return await action();
    } catch (err) {
      setError(err);
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function onPreview() {
    const res = await run(() => redistributionApi.getRedistributionOptions(sourceHubId, targetHubId, new Date(eta).toISOString()));
    if (res) {
      setPreview(res);
      setSelected([]);
    }
  }

  async function onCreate() {
    if (!preview) return;
    // requestId mới cho mỗi lần bấm; lệnh chỉ tạo một lần vì sau khi tạo xong màn hình xác nhận được đóng.
    const created = await run(() =>
      redistributionApi.createOrder(newRequestId(), sourceHubId, targetHubId, selected, new Date(eta).toISOString()),
    );
    if (created) {
      const withItems = created as OrderView;
      const codes: Record<string, string> = {};
      for (const v of preview.vehicles) codes[v.id] = v.code;
      saveOrders([{ ...withItems, items: withItems.items ?? [], vehicleCodes: codes }, ...orders]);
      setPreview(null);
      setSelected([]);
    }
  }

  function patchOrder(orderId: string, change: (o: OrderView) => OrderView) {
    saveOrders(orders.map((o) => (o.id === orderId ? change(o) : o)));
  }

  function replaceItem(orderId: string, item: RedistributionItem) {
    patchOrder(orderId, (o) => ({
      ...o,
      status: o.status === "CREATED" ? "IN_PROGRESS" : o.status,
      items: o.items.map((i) => (i.id === item.id ? item : i)),
    }));
  }

  async function onDepart(o: OrderView, vehicleId: string) {
    const item = await run(() => redistributionApi.confirmDeparture(newRequestId(), o.id, vehicleId));
    if (item) replaceItem(o.id, item);
  }

  async function onArrive(o: OrderView, vehicleId: string) {
    const item = await run(() => redistributionApi.confirmArrival(newRequestId(), o.id, vehicleId));
    if (item) replaceItem(o.id, item);
  }

  async function onCancelPending(o: OrderView) {
    const res = await run(() => redistributionApi.cancelPendingItems(newRequestId(), o.id));
    if (res) patchOrder(o.id, (cur) => ({ ...cur, ...(res as OrderView), vehicleCodes: cur.vehicleCodes }));
  }

  async function onClose(o: OrderView) {
    const res = await run(() => redistributionApi.closeOrder(newRequestId(), o.id));
    if (res) patchOrder(o.id, (cur) => ({ ...cur, ...(res as OrderView), vehicleCodes: cur.vehicleCodes }));
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const canPreview = sourceHubId && targetHubId && eta;

  return (
    <div className="space-y-6">
      <PageHeader title="Điều chuyển xe" subtitle="Chuyển xe từ Hub thừa sang Hub thiếu" />
      <ErrorMessage error={error} />

      <Card className="space-y-4">
        <h2 className="text-lg font-bold">1. Chọn Hub và thời điểm</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <HubSelect label="Hub nguồn" value={sourceHubId} onChange={setSourceHubId} hubs={hubs.data ?? []} />
          <HubSelect label="Hub đích" value={targetHubId} onChange={setTargetHubId} hubs={hubs.data ?? []} />
          <label className="text-sm">
            <span className="mb-1 block font-medium">Dự kiến tiếp nhận</span>
            <input
              type="datetime-local"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-600"
            />
          </label>
        </div>
        <Button disabled={!canPreview} loading={busy && !preview} onClick={() => void onPreview()}>
          Xem phương án
        </Button>
      </Card>

      {preview && (
        <Card className="space-y-3">
          <h2 className="text-lg font-bold">2. Chọn xe điều chuyển</h2>
          <p className="text-sm text-neutral-500">
            {preview.sourceHub.name} → {preview.targetHub.name} · Hub đích còn nhận được{" "}
            <b>{preview.availableCapacity}</b> xe vào thời điểm đã chọn.
          </p>
          {preview.vehicles.length === 0 && <p className="text-sm">Hub nguồn không có xe nào đủ điều kiện điều chuyển.</p>}
          <ul className="grid gap-2 md:grid-cols-2">
            {preview.vehicles.map((v) => (
              <li key={v.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
                  <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} />
                  <span className="font-semibold">{v.code}</span>
                  <span className="text-xs text-neutral-500">Pin {v.batteryLevel}%</span>
                </label>
              </li>
            ))}
          </ul>
          {selected.length > preview.availableCapacity && (
            <p className="text-sm text-red-600">Số xe đã chọn vượt sức chứa của Hub đích.</p>
          )}
          <Button
            loading={busy}
            disabled={selected.length === 0 || selected.length > preview.availableCapacity}
            onClick={() => void onCreate()}
          >
            Xác nhận điều chuyển {selected.length} xe
          </Button>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Lệnh điều chuyển (phiên làm việc này)</h2>
        {orders.length === 0 && <p className="text-sm text-neutral-500">Chưa có lệnh nào.</p>}
        {orders.map((o) => {
          const open = o.status === "CREATED" || o.status === "IN_PROGRESS";
          const hasPending = o.items.some((i) => i.status === "PENDING");
          const done = o.items.every((i) => i.status === "ARRIVED" || i.status === "CANCELLED");
          return (
            <Card key={o.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {hubName(o.sourceHubId)} → {hubName(o.targetHubId)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Dự kiến {o.eta ? new Date(o.eta).toLocaleString("vi-VN") : "—"}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <ul className="divide-y divide-neutral-200 dark:divide-white/10">
                {o.items.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{o.vehicleCodes[i.vehicleId] ?? i.vehicleId.slice(0, 8)}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={i.status} />
                      {i.status === "PENDING" && open && (
                        <Button variant="outline" disabled={busy} onClick={() => void onDepart(o, i.vehicleId)}>
                          Đã rời Hub nguồn
                        </Button>
                      )}
                      {i.status === "IN_TRANSIT" && (
                        <Button variant="outline" disabled={busy} onClick={() => void onArrive(o, i.vehicleId)}>
                          Đã tới Hub đích
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {open && (
                <div className="flex flex-wrap gap-2">
                  {hasPending && (
                    <Button variant="danger" disabled={busy} onClick={() => void onCancelPending(o)}>
                      Hủy các xe chưa xuất phát
                    </Button>
                  )}
                  <Button disabled={busy || !done} onClick={() => void onClose(o)}>
                    Đóng lệnh
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function HubSelect({
  label,
  value,
  onChange,
  hubs,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hubs: { id: string; name: string }[];
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2.5 dark:border-neutral-600"
      >
        <option value="">— Chọn Hub —</option>
        {hubs.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </label>
  );
}
