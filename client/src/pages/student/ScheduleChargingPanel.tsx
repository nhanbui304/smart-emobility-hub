// Owner: Ngô Minh Triết – UC08 Schedule Charging Session
// Tách thành panel riêng để nhúng vào MyVehiclePage mà không xung đột với UC06 (Quang Nhân) và UC09 (Hoàng Nhân).
import { newRequestId } from "../../api/requestId";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { chargingRequestApi } from "../../api/chargingRequest";
import { chargingReservationApi } from "../../api/chargingReservation";
import { hubApi } from "../../api/hubs";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { StatusBadge } from "../../components/StatusBadge";
import type {
  ChargingSlotOption,
  CreateResult,
  HubStatus,
  PrivateVehicle,
} from "../../types";
import { connectorTypeLabel, friendlyPortLabel } from "../../utils/display";

function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeVi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function defaultTomorrowRange(): { start: string; end: string } {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 90 * 60_000);
  return {
    start: toLocalDateTimeInput(start),
    end: toLocalDateTimeInput(end),
  };
}

export function ScheduleChargingPanel({ onCreated }: { onCreated?: (reservationId: string) => void }) {
  const [searchParams] = useSearchParams();
  const initialHubFromUrl = searchParams.get("hubId") ?? "";

  const [hubs, setHubs] = useState<HubStatus[]>([]);
  const [vehicles, setVehicles] = useState<PrivateVehicle[]>([]);

  const [hubId, setHubId] = useState<string>(initialHubFromUrl);
  const [vehicleId, setVehicleId] = useState<string>("");
  const defaultRange = useMemo(defaultTomorrowRange, []);
  const [startInput, setStartInput] = useState<string>(defaultRange.start);
  const [endInput, setEndInput] = useState<string>(defaultRange.end);
  const [currentBattery, setCurrentBattery] = useState<number>(30);
  const [targetBattery, setTargetBattery] = useState<number>(90);

  const [options, setOptions] = useState<ChargingSlotOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ChargingSlotOption | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string>(newRequestId);
  const [created, setCreated] = useState<CreateResult | null>(null);

  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<unknown>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const hubNameById = useMemo(() => new Map(hubs.map((h) => [h.id, h.name])), [hubs]);

  useEffect(() => {
    let active = true;
    void Promise.all([hubApi.list(), chargingRequestApi.getMyContext()])
      .then(([hubList, ctx]) => {
        if (!active) return;
        setHubs(hubList);
        setVehicles(ctx.vehicles);
        setHubId((prev) => prev || hubList[0]?.id || "");
        setVehicleId((prev) => prev || ctx.vehicles[0]?.id || "");
      })
      .catch((err) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleFindSlots() {
    if (!hubId || !vehicleId || !startInput || !endInput) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    setSelectedOption(null);
    setCreated(null);
    try {
      const startIso = new Date(startInput).toISOString();
      const endIso = new Date(endInput).toISOString();
      const res = await chargingReservationApi.findChargingSlots(
        vehicleId,
        hubId,
        startIso,
        { startTime: startIso, endTime: endIso },
        { currentBattery, targetBattery },
      );
      setOptions(res.options);
      setInfoMsg(`Tìm thấy ${res.options.length} cổng sạc khả dụng phù hợp với xe của bạn.`);
    } catch (err) {
      setOptions([]);
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleSelectOption(opt: ChargingSlotOption) {
    setSelectedOption(opt);
    setPendingRequestId(newRequestId());
    setError(null);
  }

  async function handleConfirm() {
    if (!selectedOption) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      const res = await chargingReservationApi.confirmChargingReservation(
        pendingRequestId,
        selectedOption.slotOptionId,
      );
      setCreated(res);
      onCreated?.(res.reservationId);
      setSelectedOption(null);
      setOptions([]);
      setPendingRequestId(newRequestId());
      setInfoMsg("Đặt lịch sạc thành công!");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-lime">
          Đặt lịch sạc trước
        </p>
        <h2 className="mt-0.5 text-base font-bold">Đặt khung giờ sạc cho xe cá nhân</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Chọn Hub, khung giờ tương lai và nhu cầu pin để giữ cổng sạc tương thích.
        </p>
      </div>

      <ErrorMessage error={error} />
      {infoMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {infoMsg}
        </div>
      )}

      <div className="grid gap-2.5 text-xs sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-medium">Hub sạc</label>
          <select
            value={hubId}
            onChange={(e) => {
              setHubId(e.target.value);
              setOptions([]);
              setSelectedOption(null);
            }}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
          >
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.freeChargingPorts}/{h.totalChargingPorts} cổng sạc trống)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block font-medium">Xe cá nhân</label>
          <select
            value={vehicleId}
            onChange={(e) => {
              setVehicleId(e.target.value);
              setOptions([]);
              setSelectedOption(null);
            }}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
          >
            {vehicles.length === 0 && <option value="">Chưa có xe cá nhân</option>}
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} ({connectorTypeLabel(v.connectorType)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block font-medium">Bắt đầu</label>
          <input
            type="datetime-local"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Kết thúc</label>
          <input
            type="datetime-local"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Pin hiện tại (%)</label>
          <input
            type="number"
            min={0}
            max={99}
            value={currentBattery}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              setCurrentBattery(Number.isNaN(v) ? 0 : Math.min(99, Math.max(0, v)));
            }}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
          />
        </div>

        <div>
          <label className="mb-1 block font-medium">Pin mục tiêu (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={targetBattery}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              setTargetBattery(Number.isNaN(v) ? 100 : Math.min(100, Math.max(1, v)));
            }}
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="dark"
        fullWidth
        loading={busy && !selectedOption}
        disabled={!hubId || !vehicleId}
        onClick={() => void handleFindSlots()}
        className="py-2 text-xs"
      >
        Tìm khung giờ sạc phù hợp
      </Button>

      {options.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold">Cổng sạc khả dụng:</p>
          {options.map((opt, idx) => {
            const isPicked = selectedOption?.slotOptionId === opt.slotOptionId;
            return (
              <div
                key={opt.slotOptionId}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
                  isPicked
                    ? "border-brand bg-brand/5 dark:border-lime dark:bg-lime/10"
                    : "border-neutral-200 dark:border-white/10"
                }`}
              >
                <div>
                  <p className="font-semibold">
                    {hubNameById.get(opt.hubId) ?? "Mobility Hub"} · {friendlyPortLabel(opt.portId, idx)}
                  </p>
                  <p className="text-neutral-500">
                    {formatDateTimeVi(opt.startTime)} → {formatDateTimeVi(opt.endTime)} · Tối đa {opt.maxPowerKw} kW
                  </p>
                </div>
                <Button
                  type="button"
                  variant={isPicked ? "dark" : "primary"}
                  onClick={() => handleSelectOption(opt)}
                  className="px-3 py-1.5 text-xs"
                >
                  {isPicked ? "Đang chọn" : "Chọn cổng"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {selectedOption && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="font-bold text-amber-900 dark:text-amber-200">Xác nhận đặt lịch sạc</p>
          <p>
            Hub: <strong>{hubNameById.get(selectedOption.hubId) ?? selectedOption.hubId}</strong> · Khung giờ:{" "}
            {formatDateTimeVi(selectedOption.startTime)} → {formatDateTimeVi(selectedOption.endTime)} · Pin:{" "}
            {currentBattery}% → {targetBattery}%
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              loading={busy}
              onClick={() => void handleConfirm()}
              className="flex-1 py-2 text-xs"
            >
              Xác nhận đặt lịch
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setSelectedOption(null)}
              className="py-2 text-xs"
            >
              Hủy chọn
            </Button>
          </div>
        </div>
      )}

      {created && (
        <div className="space-y-1 rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-emerald-800 dark:text-emerald-300">Lịch sạc đã được tạo</p>
            <StatusBadge status={created.status} />
          </div>
          <p>{created.usageGuide}</p>
        </div>
      )}
    </Card>
  );
}
