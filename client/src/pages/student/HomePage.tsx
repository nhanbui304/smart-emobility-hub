// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Danh sách Hub (View Hub and Resource Status) do Lê Quốc Linh làm – đã chạy thật, tự tải lại mỗi 3 giây.
import { useState } from "react";
import { Link } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { searchApi } from "../../api/search";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import type { HubStatus } from "../../types";

const PURPOSES = [
  { value: "RENT_VEHICLE", label: "Thuê xe" },
  { value: "PARK", label: "Đỗ xe" },
  { value: "CHARGE", label: "Sạc xe" },
] as const;

export function HomePage() {
  const { user } = useAuth();
  const { data: hubs, loading, error, reload } = useAsync(() => hubApi.list(), [], { refreshEveryMs: 3000 });

  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]["value"]>("RENT_VEHICLE");
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);

  async function onSearch() {
    setSearchError(null);
    setSearching(true);
    try {
      // TODO (Triết – UC01): lấy Hub xuất phát, loại xe, mức pin tối thiểu từ form (đang tạm điền);
      // hiển thị danh sách phương án trả về và cho chọn (searchApi.confirmOptionSelection).
      await searchApi.searchMobilityOptions({ purpose, originHubId: hubs?.[0]?.id ?? "", vehicleType: "E_BIKE", minBattery: 0 });
    } catch (err) {
      setSearchError(err);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card tone="highlight" className="p-6">
        <p className="text-sm text-white/70">Xin chào,</p>
        <h1 className="text-2xl font-bold">{user?.fullName}</h1>
        <p className="mt-4 text-sm text-white/80">Bạn cần làm gì hôm nay?</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mục đích">
          {PURPOSES.map((p) => (
            <button
              key={p.value}
              role="radio"
              aria-checked={purpose === p.value}
              onClick={() => setPurpose(p.value)}
              className={`rounded-xl px-2 py-2.5 text-sm font-semibold transition ${
                purpose === p.value ? "bg-lime text-brand-dark" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button className="mt-4" fullWidth loading={searching} onClick={onSearch}>
          Tìm Hub phù hợp
        </Button>
      </Card>
      <ErrorMessage error={searchError} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Các Hub gần bạn</h2>
          <Link to="/student/reservations" className="text-sm font-semibold text-brand dark:text-lime">
            Đặt chỗ của tôi
          </Link>
        </div>
        {loading && !hubs && <Spinner />}
        <ErrorMessage error={error} onRetry={() => void reload()} />
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {hubs?.map((hub) => (
            <HubRow key={hub.id} hub={hub} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function HubRow({ hub }: { hub: HubStatus }) {
  return (
    <li>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{hub.name}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{hub.location}</p>
          </div>
          <Link
            to={`/student/hubs/${hub.id}/reserve`}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white dark:bg-lime dark:text-brand-dark"
          >
            Đặt xe
          </Link>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Xe sẵn sàng" value={`${hub.availableVehicles}/${hub.totalVehicles}`} />
          <Stat label="Chỗ trống" value={`${hub.freeSlots}/${hub.totalSlots}`} />
          <Stat label="Cổng sạc rảnh" value={`${hub.freeChargingPorts}/${hub.totalChargingPorts}`} />
        </dl>
      </Card>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface py-2 dark:bg-white/5">
      <dd className="text-base font-bold">{value}</dd>
      <dt className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</dt>
    </div>
  );
}
