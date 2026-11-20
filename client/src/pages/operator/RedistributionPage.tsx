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
import { ApiError } from "../../api/client";
import { hubApi } from "../../api/hubs";
import { redistributionApi } from "../../api/redistribution";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import type { RedistributionPreview } from "../../types";
import { newRequestId } from "../../utils/requestId";

type Command = { requestId: string } & (
  | { kind: "create"; sourceHubId: string; targetHubId: string; vehicleIds: string[]; eta: string }
  | { kind: "depart" | "arrive"; orderId: string; vehicleId: string }
  | { kind: "cancel" | "close"; orderId: string }
);

function loadCommand(key: string): Command | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as Command | null;
  } catch {
    return null;
  }
}

function sendCommand(command: Command) {
  switch (command.kind) {
    case "create":
      return redistributionApi.createOrder(
        command.requestId, command.sourceHubId, command.targetHubId, command.vehicleIds, command.eta,
      );
    case "depart":
      return redistributionApi.confirmDeparture(command.requestId, command.orderId, command.vehicleId);
    case "arrive":
      return redistributionApi.confirmArrival(command.requestId, command.orderId, command.vehicleId);
    case "cancel":
      return redistributionApi.cancelPendingItems(command.requestId, command.orderId);
    case "close":
      return redistributionApi.closeOrder(command.requestId, command.orderId);
  }
}

/** Mặc định ETA = 30 phút nữa, định dạng cho ô datetime-local (giờ địa phương). */
function defaultEta(): string {
  const d = new Date(Date.now() + 30 * 60_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function RedistributionPage() {
  const { user } = useAuth();
  const storageKey = `smart-emobility:redistribution-command:${user?.id ?? ""}`;
  const hubs = useAsync(() => hubApi.list(), []);
  const orders = useAsync(() => redistributionApi.listOrders(), [user?.id]);
  const [sourceHubId, setSourceHubId] = useState("");
  const [targetHubId, setTargetHubId] = useState("");
  const [eta, setEta] = useState(defaultEta);
  const [preview, setPreview] = useState<RedistributionPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Command | null>(() => loadCommand(storageKey));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const hubName = (id: string) => hubs.data?.find((h) => h.id === id)?.name ?? "Hub";

  function savePending(command: Command | null) {
    setPending(command);
    try {
      if (command) sessionStorage.setItem(storageKey, JSON.stringify(command));
      else sessionStorage.removeItem(storageKey);
    } catch {
      // Yêu cầu vẫn có thể thử lại khi trang còn mở.
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

  async function submit(command: Command) {
    if (!user || busy) return;
    savePending(command);
    await run(async () => {
      try {
        await sendCommand(command);
        savePending(null);
        if (command.kind === "create") {
          setPreview(null);
          setSelected([]);
        }
      } catch (err) {
        if (!(err instanceof ApiError && err.code === "NETWORK_ERROR")) savePending(null);
        throw err;
      } finally {
        await orders.reload();
      }
    });
  }

  function onCreate() {
    if (!preview || pending) return;
    void submit({
      kind: "create",
      requestId: newRequestId(),
      sourceHubId: preview.sourceHub.id,
      targetHubId: preview.targetHub.id,
      vehicleIds: selected,
      eta: preview.eta,
    });
  }

  const writesDisabled = busy || !!pending;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const canPreview = sourceHubId && targetHubId && eta;

  return (
    <div className="space-y-6">
      <PageHeader title="Điều chuyển xe" subtitle="Chuyển xe từ Hub thừa sang Hub thiếu" />
      <ErrorMessage error={error} />

      {pending && (
        <Card className="space-y-3">
          <p className="text-sm">Chưa nhận được kết quả thao tác điều chuyển. Gửi lại để kiểm tra.</p>
          <Button loading={busy} onClick={() => void submit(pending)}>Gửi lại thao tác</Button>
        </Card>
      )}

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
            disabled={writesDisabled || selected.length === 0 || selected.length > preview.availableCapacity}
            onClick={onCreate}
          >
            Xác nhận điều chuyển {selected.length} xe
          </Button>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Lệnh điều chuyển</h2>
        <ErrorMessage error={orders.error} onRetry={() => void orders.reload()} />
        {orders.data?.length === 0 && <p className="text-sm text-neutral-500">Chưa có lệnh nào.</p>}
        {orders.data?.map((o) => {
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
                        <Button variant="outline" disabled={writesDisabled} onClick={() => void submit({ kind: "depart", requestId: newRequestId(), orderId: o.id, vehicleId: i.vehicleId })}>
                          Đã rời Hub nguồn
                        </Button>
                      )}
                      {i.status === "IN_TRANSIT" && (
                        <Button variant="outline" disabled={writesDisabled} onClick={() => void submit({ kind: "arrive", requestId: newRequestId(), orderId: o.id, vehicleId: i.vehicleId })}>
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
                    <Button variant="danger" disabled={writesDisabled} onClick={() => void submit({ kind: "cancel", requestId: newRequestId(), orderId: o.id })}>
                      Hủy các xe chưa xuất phát
                    </Button>
                  )}
                  <Button disabled={writesDisabled || !done} onClick={() => void submit({ kind: "close", requestId: newRequestId(), orderId: o.id })}>
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
