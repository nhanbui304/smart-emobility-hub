// Owner: Nguyễn Hoàng Nhân – UC10 Monitor Mobility Hub Network
// Bảng trạng thái Hub đã chạy: gọi /api/hubs, tự tải lại mỗi 3 giây (NFR cập nhật trong 3 giây).
// TODO (Hoàng Nhân): thêm cảnh báo (operationsApi.overview), chi tiết Hub, nút điều chuyển.
import { hubApi } from "../../api/hubs";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { StubNotice } from "../../components/StubNotice";
import { useAsync } from "../../hooks/useAsync";
import type { HubStatus } from "../../types";

export function MonitoringPage() {
  const {
    data: hubs,
    loading,
    error,
    lastLoadedAt,
    reload,
  } = useAsync(() => hubApi.list(), [], {
    refreshEveryMs: 3000,
  });
  const connected = !error;

  const totals = (hubs ?? []).reduce(
    (acc, h) => ({
      vehicles: acc.vehicles + h.availableVehicles,
      totalVehicles: acc.totalVehicles + h.totalVehicles,
      slots: acc.slots + h.freeSlots,
      ports: acc.ports + h.freeChargingPorts,
    }),
    { vehicles: 0, totalVehicles: 0, slots: 0, ports: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giám sát mạng lưới"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <StatusBadge
              status={connected ? "ACTIVE" : "OUT_OF_SERVICE"}
              label={connected ? "Tự cập nhật mỗi 3 giây" : "Mất kết nối máy chủ"}
            />
            {lastLoadedAt && <span>Cập nhật lúc {lastLoadedAt.toLocaleTimeString("vi-VN")}</span>}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          tone="highlight"
          label="Xe sẵn sàng"
          value={`${totals.vehicles}`}
          sub={`trên ${totals.totalVehicles} xe`}
        />
        <Kpi label="Chỗ đỗ trống" value={`${totals.slots}`} sub="toàn mạng lưới" />
        <Kpi label="Cổng sạc rảnh" value={`${totals.ports}`} sub="toàn mạng lưới" />
        <Kpi label="Số Hub" value={`${hubs?.length ?? 0}`} sub="đang hoạt động" />
      </div>

      {loading && !hubs && <Spinner />}
      <ErrorMessage error={error} onRetry={() => void reload()} />

      {hubs && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-white/10 dark:text-neutral-400">
              <tr>
                <th className="px-5 py-3 font-medium">Hub</th>
                <th className="px-5 py-3 font-medium">Xe sẵn sàng</th>
                <th className="px-5 py-3 font-medium">Chỗ trống</th>
                <th className="px-5 py-3 font-medium">Cổng sạc rảnh</th>
                <th className="px-5 py-3 font-medium">Pin trung bình</th>
                <th className="px-5 py-3 font-medium">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/5">
              {hubs.map((h) => (
                <HubRow key={h.id} hub={h} />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <StubNotice
        owner="Nguyễn Hoàng Nhân"
        useCases="UC10"
        todo={[
          "Hiển thị cảnh báo đang mở (LOW_VEHICLE, NEAR_FULL, DATA_STALE) từ operationsApi.overview",
          "Bấm vào Hub → xem chi tiết xe, cổng sạc (operationsApi.hubDetail)",
        ]}
      />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "highlight" }) {
  return (
    <Card tone={tone === "highlight" ? "highlight" : "default"}>
      <p className={`text-sm ${tone ? "text-white/70" : "text-neutral-500 dark:text-neutral-400"}`}>{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone ? "text-lime" : ""}`}>{value}</p>
      <p className={`text-xs ${tone ? "text-white/60" : "text-neutral-500 dark:text-neutral-400"}`}>{sub}</p>
    </Card>
  );
}

function HubRow({ hub }: { hub: HubStatus }) {
  const low = hub.availableVehicles <= 2;
  return (
    <tr className="transition hover:bg-neutral-50 dark:hover:bg-white/5">
      <td className="px-5 py-3">
        <p className="font-semibold">{hub.name}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{hub.location}</p>
      </td>
      <td className="px-5 py-3">
        <span className="font-semibold tabular-nums">
          {hub.availableVehicles}/{hub.totalVehicles}
        </span>
        {low && (
          <span className="ml-2">
            <StatusBadge status="LOW_VEHICLE" />
          </span>
        )}
      </td>
      <td className="px-5 py-3 tabular-nums">
        {hub.freeSlots}/{hub.totalSlots}
      </td>
      <td className="px-5 py-3 tabular-nums">
        {hub.freeChargingPorts}/{hub.totalChargingPorts}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand dark:bg-lime" style={{ width: `${hub.averageBattery}%` }} />
          </div>
          <span className="tabular-nums">{hub.averageBattery}%</span>
        </div>
      </td>
      <td className="px-5 py-3 tabular-nums text-neutral-500 dark:text-neutral-400">
        {new Date(hub.lastUpdatedAt).toLocaleTimeString("vi-VN")}
      </td>
    </tr>
  );
}
