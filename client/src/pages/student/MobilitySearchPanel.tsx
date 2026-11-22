// Owner: Ngô Minh Triết – UC01 Find Suitable Hub and Mobility Option
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { newRequestId } from "../../api/requestId";
import { searchApi } from "../../api/search";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import type { MapMetric } from "../../components/CampusHubMap";
import { ErrorMessage } from "../../components/ErrorMessage";
import type { HubStatus, SearchResult, VehicleType } from "../../types";
import { sharedVehiclePlate, vehicleTypeLabel } from "../../utils/display";

const labels: Record<MapMetric, { search: string; select: string }> = {
  RENT_VEHICLE: { search: "Tìm xe thuê", select: "Chọn xe" },
  PARK: { search: "Tìm chỗ đỗ", select: "Đặt chỗ" },
  CHARGE: { search: "Tìm cổng sạc", select: "Yêu cầu sạc" },
};

const pageSize = 3;

export function MobilitySearchPanel({ purpose, origin, hubs }: {
  purpose: MapMetric;
  origin: HubStatus;
  hubs: HubStatus[];
}) {
  const navigate = useNavigate();
  const searchId = useRef<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("E_BIKE");
  const [minBattery, setMinBattery] = useState(30);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [limit, setLimit] = useState(pageSize);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<unknown>(null);
  const isRental = purpose === "RENT_VEHICLE";

  useEffect(() => () => { searchId.current = null; }, []);

  function clearResult() {
    searchId.current = null;
    setResult(null);
    setNotice("");
    setError(null);
  }

  async function findOptions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching || confirming) return;
    clearResult();
    const id = newRequestId();
    searchId.current = id;
    setSearching(true);
    setLimit(pageSize);
    try {
      const found = await searchApi.searchMobilityOptions({
        purpose, originHubId: origin.id, vehicleType, minBattery: isRental ? minBattery : 0,
      }, id);
      if (id === searchId.current) setResult(found);
    } catch (err) {
      if (id === searchId.current) setError(err);
    } finally {
      if (id === searchId.current) setSearching(false);
    }
  }

  async function chooseOption(optionId: string) {
    const id = searchId.current;
    if (!id || confirming) return;
    setConfirming(optionId);
    setError(null);
    setNotice("");
    try {
      const selection = await searchApi.confirmOptionSelection(id, optionId);
      if (id !== searchId.current) return;
      const path = selection.nextActions[0];
      if (!selection.optionChanged && path) {
        navigate(path);
        return;
      }
      setResult(selection.updatedResult);
      setNotice("Phương án vừa thay đổi. Vui lòng chọn lại từ danh sách đã cập nhật.");
    } catch (err) {
      if (id === searchId.current) setError(err);
    } finally {
      if (id === searchId.current) setConfirming(null);
    }
  }

  return (
    <Card className="space-y-4 p-4 md:p-5">
      <form onSubmit={findOptions}>
        <fieldset disabled={searching || !!confirming} className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[10rem] flex-1">
            <h2 className="text-base font-bold">{labels[purpose].search}</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">Điểm xuất phát: {origin.name}</p>
          </div>
          {isRental && (
            <>
              <label className="text-sm font-medium">
                Loại xe
                <select className="input mt-1" value={vehicleType} onChange={(e) => {
                  setVehicleType(e.target.value as VehicleType);
                  clearResult();
                }}>
                  <option value="E_BIKE">Xe đạp điện</option>
                  <option value="E_MOTORBIKE">Xe máy điện</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Pin tối thiểu (%)
                <input className="input mt-1" type="number" min={0} max={100} required value={minBattery}
                  onChange={(e) => { setMinBattery(Number(e.target.value)); clearResult(); }} />
              </label>
            </>
          )}
          <Button type="submit" variant="dark" loading={searching}>{isRental ? "Tìm" : "Tìm phương án"}</Button>
        </fieldset>
      </form>
      <ErrorMessage error={error} />
      {notice && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{notice}</p>}
      {result?.unverifiedFlags.includes("DATA_STALE") && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">Dữ liệu Hub đã cũ. Hệ thống sẽ kiểm tra lại khi bạn chọn.</p>
      )}
      {result && (result.options.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {result.options.slice(0, limit).map((option) => (
            <li key={option.optionId} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 dark:border-white/10">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{hubs.find((hub) => hub.id === option.hubId)?.name ?? "Mobility Hub"}</p>
                {isRental && <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  {sharedVehiclePlate(option.vehicle.code)} · {vehicleTypeLabel(option.vehicle.type)} · Pin {option.vehicle.batteryLevel}%
                </p>}
              </div>
              <Button type="button" variant="outline" className="min-h-11 px-3 py-2"
                disabled={!!confirming} loading={confirming === option.optionId} onClick={() => void chooseOption(option.optionId)}>
                {labels[purpose].select}
              </Button>
            </li>
          ))}
        </ul>
      ) : <p role="status" className="text-sm text-neutral-600 dark:text-neutral-300">
        {isRental ? "Chưa có xe phù hợp. Thử giảm mức pin tối thiểu hoặc chọn loại xe khác." : "Chưa có tài nguyên phù hợp. Thử tìm lại sau hoặc chọn mục đích khác."}
      </p>)}
      {result && limit < result.options.length && (
        <Button type="button" variant="ghost" onClick={() => setLimit((count) => count + pageSize)}>Xem thêm</Button>
      )}
    </Card>
  );
}
