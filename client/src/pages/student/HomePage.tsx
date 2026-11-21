// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
// Danh sách Hub (View Hub and Resource Status) do Lê Quốc Linh làm – đã chạy thật, tự tải lại mỗi 3 giây.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hubApi } from "../../api/hubs";
import { newRequestId } from "../../api/requestId";
import { searchApi } from "../../api/search";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { Spinner } from "../../components/Spinner";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useAsync } from "../../hooks/useAsync";
import type {
  HubStatus,
  MobilityOption,
  OptionSelectionResult,
  SearchCriteria,
  SearchFormConfig,
  SearchResult,
  VehicleType,
} from "../../types";

const PURPOSES = [
  { value: "RENT_VEHICLE", label: "Thuê xe" },
  { value: "PARK", label: "Đỗ xe" },
  { value: "CHARGE", label: "Sạc xe" },
] as const;

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  E_BIKE: "Xe đạp điện",
  E_MOTORBIKE: "Xe máy điện",
};

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sessionIdRef = useRef<string | null>(null);
  const { data: hubs, loading, error, reload } = useAsync(() => hubApi.list(), [], { refreshEveryMs: 3000 });

  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]["value"]>("RENT_VEHICLE");
  const [formConfig, setFormConfig] = useState<SearchFormConfig | null>(null);
  const [originHubId, setOriginHubId] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("E_BIKE");
  const [minBattery, setMinBattery] = useState<number>(30);

  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectionResult, setSelectionResult] = useState<OptionSelectionResult | null>(null);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void searchApi
      .loadSearchForm()
      .then((cfg) => {
        if (!active) return;
        setFormConfig(cfg);
        setOriginHubId((prev) => prev || cfg.defaultHubId);
        if (cfg.availableVehicleTypes.length > 0) {
          setVehicleType(cfg.availableVehicleTypes[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!originHubId && hubs && hubs.length > 0) {
      setOriginHubId(hubs[0].id);
    }
  }, [hubs, originHubId]);

  const hubNameMap = useMemo(() => {
    const map = new Map<string, string>();
    hubs?.forEach((h) => map.set(h.id, h.name));
    return map;
  }, [hubs]);

  async function submitSearch(criteria: SearchCriteria) {
    const sessionId = newRequestId();
    sessionIdRef.current = sessionId;
    setSearchResult(null);
    setSearchError(null);
    setSelectionResult(null);
    setSelectedOptionId(null);
    setConfirmingOptionId(null);
    setSearching(true);
    try {
      const res = await searchApi.searchMobilityOptions(criteria, sessionId);
      if (sessionIdRef.current === sessionId) setSearchResult(res);
    } catch (err) {
      if (sessionIdRef.current === sessionId) setSearchError(err);
    } finally {
      if (sessionIdRef.current === sessionId) setSearching(false);
    }
  }

  async function onSearch() {
    await submitSearch({
      purpose,
      originHubId,
      vehicleType,
      minBattery,
    });
  }

  function reviseCriteria() {
    sessionIdRef.current = null;
    setSearching(false);
    setConfirmingOptionId(null);
    setSearchResult(null);
    setSelectionResult(null);
    setSelectedOptionId(null);
    setSearchError(null);
  }

  async function selectMobilityOption(option: MobilityOption) {
    const sessionId = sessionIdRef.current;
    if (!sessionId || searching || confirmingOptionId) return;
    setSearchError(null);
    setSelectionResult(null);
    setSelectedOptionId(null);
    setConfirmingOptionId(option.optionId);
    try {
      const res = await searchApi.confirmOptionSelection(sessionId, option.optionId);
      if (sessionIdRef.current !== sessionId) return;
      setSelectionResult(res);
      setSearchResult(res.updatedResult);
      if (!res.optionChanged) {
        setSelectedOptionId(option.optionId);
      } else {
        setSelectedOptionId(null);
      }
    } catch (err) {
      if (sessionIdRef.current === sessionId) setSearchError(err);
    } finally {
      if (sessionIdRef.current === sessionId) setConfirmingOptionId(null);
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="uc01-origin-hub" className="block text-xs text-white/80">
              Hub xuất phát
            </label>
            <select
              id="uc01-origin-hub"
              value={originHubId}
              onChange={(e) => setOriginHubId(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-lime"
            >
              <option value="" className="text-neutral-900">
                -- Chọn Hub --
              </option>
              {hubs?.map((h) => (
                <option key={h.id} value={h.id} className="text-neutral-900">
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="uc01-vehicle-type" className="block text-xs text-white/80">
              Loại phương tiện
            </label>
            <select
              id="uc01-vehicle-type"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as VehicleType)}
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-lime"
            >
              {(formConfig?.availableVehicleTypes ?? ["E_BIKE", "E_MOTORBIKE"]).map((vt) => (
                <option key={vt} value={vt} className="text-neutral-900">
                  {VEHICLE_TYPE_LABELS[vt]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="uc01-min-battery" className="block text-xs text-white/80">
              Pin tối thiểu (%)
            </label>
            <input
              id="uc01-min-battery"
              type="number"
              min={0}
              max={100}
              value={minBattery}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                setMinBattery(Number.isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed)));
              }}
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-lime"
            />
          </div>
        </div>

        <Button className="mt-4" fullWidth loading={searching} onClick={onSearch}>
          Tìm Hub phù hợp
        </Button>
      </Card>
      <ErrorMessage error={searchError} />

      {searchResult && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Phương án phù hợp ({searchResult.options.length})</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Cập nhật lúc: {new Date(searchResult.updatedAt).toLocaleTimeString("vi-VN")} • Lưu ý: tài nguyên chưa được giữ chỗ.
              </p>
            </div>
            <button
              type="button"
              onClick={reviseCriteria}
              className="text-xs font-semibold text-brand underline dark:text-lime"
            >
              Sửa tiêu chí
            </button>
          </div>

          {searchResult.unverifiedFlags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <StatusBadge status="DATA_STALE" />
              <span>Một số dữ liệu Hub/xe chưa được xác minh mới nhất.</span>
            </div>
          )}

          {selectionResult?.optionChanged && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Phương án vừa chọn đã thay đổi trạng thái hoặc không còn đáp ứng tiêu chí. Danh sách bên dưới đã được cập nhật, vui lòng chọn lại.
            </div>
          )}

          {searchResult.options.length === 0 ? (
            <div className="mt-4 rounded-xl bg-surface p-4 text-sm dark:bg-white/5">
              <p className="font-semibold">Không tìm thấy phương án phù hợp.</p>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Gợi ý: thử giảm mức pin tối thiểu, đổi loại phương tiện hoặc chọn Hub xuất phát khác.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {searchResult.options.map((opt) => {
                const isSelected = selectedOptionId === opt.optionId;
                return (
                  <li
                    key={opt.optionId}
                    className={`rounded-xl border p-4 transition ${
                      isSelected
                        ? "border-brand bg-brand/5 dark:border-lime dark:bg-lime/10"
                        : "border-neutral-200 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {opt.vehicle.code} • {VEHICLE_TYPE_LABELS[opt.vehicle.type]}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {hubNameMap.get(opt.hubId) ?? opt.hubId} • Cách khoảng {opt.estimatedDistance} km
                        </p>
                      </div>
                      <StatusBadge status={opt.vehicle.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-medium">
                        {opt.optionId.startsWith("park:")
                          ? "Vị trí đỗ sẵn sàng"
                          : opt.optionId.startsWith("charge:")
                            ? "Cổng sạc sẵn sàng"
                            : `Pin hiện tại: ${opt.vehicle.batteryLevel}%`}
                      </span>
                      <Button
                        className="px-3 py-1.5 text-xs"
                        loading={confirmingOptionId === opt.optionId}
                        disabled={confirmingOptionId !== null}
                        onClick={() => void selectMobilityOption(opt)}
                      >
                        {isSelected ? "Đã chọn" : "Chọn phương án"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {selectionResult && !selectionResult.optionChanged && selectedOptionId && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
              <span>Đã ghi nhận lựa chọn trong phiên làm việc (tài nguyên chưa bị khóa).</span>
              <div className="flex flex-wrap gap-2">
                {selectionResult.nextActions.map((actionPath) => (
                  <Button key={actionPath} className="px-3 py-1.5 text-xs" onClick={() => navigate(actionPath)}>
                    Tiếp tục đặt dịch vụ
                  </Button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

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
