// Owner: Lê Quốc Linh – View My Reservations
/* import { Link } from "react-router-dom";
import { myReservationsApi } from "../../api/myReservations";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { StubNotice } from "../../components/StubNotice";
import { useAsync } from "../../hooks/useAsync";

export function MyReservationsPage() {
  const { loading, error, reload } = useAsync(() => myReservationsApi.list(), []);

  return (
    <div className="space-y-4">
      <Link to="/student" className="text-sm text-neutral-500">
        ← Trang chủ
      </Link>
      <PageHeader title="Đặt chỗ của tôi" subtitle="Đặt xe, chỗ đỗ và lịch sạc còn hiệu lực" />
      <StubNotice
        owner="Lê Quốc Linh"
        useCases="View My Reservations"
        todo={[
          "Hiện thực MyReservationsService.getMyReservations",
          "Hiển thị 3 nhóm, mỗi mục có StatusBadge và thời gian",
        ]}
      />
      {loading && <Spinner />}
      <ErrorMessage error={error} onRetry={() => void reload()} />
    </div>
  );
}
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { myReservationsApi } from "../../api/myReservations";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import type { VehicleSummary } from "../../types";
import { sharedVehiclePlate } from "../../utils/display";

const dt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

async function loadAll() {
  const result = await myReservationsApi.list();
  const hubs = await hubApi.list();
  const hubIds = [...new Set(result.vehicleReservations.map((r) => r.hubId))];
  const details = await Promise.all(hubIds.map((id) => hubApi.detail(id)));
  const vehicles = new Map<string, VehicleSummary>();
  for (const d of details) for (const v of d.vehicles) vehicles.set(v.id, v);
  return { result, hubNames: new Map(hubs.map((h) => [h.id, h.name])), vehicles };
}

export function MyReservationsPage() {
  const { data, loading, error, reload } = useAsync(loadAll, [], { refreshEveryMs: 3000 });
  const r = data?.result;
  const empty = r && r.vehicleReservations.length + r.parkingAllocations.length + r.chargingReservations.length === 0;

  return (
    <div className="space-y-4">
      <Link to="/student" className="text-sm text-neutral-500">
        ← Trang chủ
      </Link>
      <PageHeader title="Đặt chỗ của tôi" subtitle="Đặt xe, chỗ đỗ và lịch sạc còn hiệu lực" />
      {loading && !data && <Spinner />}
      <ErrorMessage error={error} onRetry={() => void reload()} />
      {empty && <EmptyState title="Chưa có đặt chỗ nào còn hiệu lực" description="Đặt xe, chỗ đỗ hoặc lịch sạc để xem tại đây." />}

      {r && r.vehicleReservations.length > 0 && (
        <Section title="Đặt xe dùng chung">
          {r.vehicleReservations.map((v) => {
            const veh = data.vehicles.get(v.vehicleId);
            return (
              <Row
                key={v.id}
                title={veh ? `${sharedVehiclePlate(veh.code)} · ${veh.code}` : "Xe đã đặt"}
                lines={[data.hubNames.get(v.hubId) ?? "", `Hạn nhận xe: ${dt(v.pickupDeadline)}`]}
                status={v.status}
                link={v.status === "RESERVED" ? { to: "/student/trips", label: "Xem xe / nhận hoặc hủy" } : undefined}
              />
            );
          })}
        </Section>
      )}

      {r && r.parkingAllocations.length > 0 && (
        <Section title="Chỗ đỗ">
          {r.parkingAllocations.map((p) => (
            <Row
              key={p.id}
              title="Đặt chỗ đỗ"
              lines={[
                `${dt(p.startTime)} – ${dt(p.endTime)}`,
                ...(p.status === "HELD" && p.holdExpiresAt ? [`Giữ tạm đến ${dt(p.holdExpiresAt)}`] : []),
              ]}
              status={p.status}
            />
          ))}
        </Section>
      )}

      {r && r.chargingReservations.length > 0 && (
        <Section title="Lịch sạc">
          {r.chargingReservations.map((c) => (
            <Row
              key={c.id}
              title="Lịch sạc xe cá nhân"
              lines={[
                `${dt(c.startTime)} – ${dt(c.endTime)}`,
                ...(c.currentBattery != null && c.targetBattery != null ? [`Pin ${c.currentBattery}% → ${c.targetBattery}%`] : []),
              ]}
              status={c.status}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({
  title,
  lines,
  status,
  link,
}: {
  title: string;
  lines: string[];
  status: string;
  link?: { to: string; label: string };
}) {
  return (
    <li>
      <Card className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="font-semibold">{title}</p>
          {lines.filter(Boolean).map((l) => (
            <p key={l} className="text-xs text-neutral-500 dark:text-neutral-400">
              {l}
            </p>
          ))}
          {link && (
            <Link to={link.to} className="mt-1 inline-block text-xs font-semibold text-brand dark:text-lime">
              {link.label}
            </Link>
          )}
        </div>
        <StatusBadge status={status} />
      </Card>
    </li>
  );
}
