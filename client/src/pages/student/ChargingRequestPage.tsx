// Owner: Ngô Minh Triết – UC07 Submit Charging Request, Cancel Charging Request
import { newRequestId } from "../../api/requestId";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { chargingRequestApi } from "../../api/chargingRequest";
import { hubApi } from "../../api/hubs";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { ErrorMessage } from "../../components/ErrorMessage";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import type {
  ChargingProposal,
  ChargingRequest,
  ChargingRequestResult,
  HubStatus,
  PrivateVehicle,
} from "../../types";
import { connectorTypeLabel, friendlyPortLabel } from "../../utils/display";

function formatDateTimeVi(iso?: string | null): string {
  if (!iso) return "—";
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

export function ChargingRequestPage() {
  const [searchParams] = useSearchParams();
  const initialHubFromUrl = searchParams.get("hubId") ?? "";

  const [hubs, setHubs] = useState<HubStatus[]>([]);
  const [vehicles, setVehicles] = useState<PrivateVehicle[]>([]);
  const [requests, setRequests] = useState<ChargingRequest[]>([]);

  const [hubId, setHubId] = useState<string>(initialHubFromUrl);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [currentBattery, setCurrentBattery] = useState<number>(20);
  const [targetBattery, setTargetBattery] = useState<number>(85);

  const [proposal, setProposal] = useState<ChargingProposal | null>(null);
  const [submitResult, setSubmitResult] = useState<ChargingRequestResult | null>(null);
  const [pendingSubmitRequestId, setPendingSubmitRequestId] = useState<string>(newRequestId);

  const [busy, setBusy] = useState<boolean>(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const hubNameById = useMemo(() => new Map(hubs.map((h) => [h.id, h.name])), [hubs]);
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);

  async function refreshContext() {
    const ctx = await chargingRequestApi.getMyContext();
    setVehicles(ctx.vehicles);
    setRequests(ctx.requests);
    setVehicleId((prev) => prev || ctx.vehicles[0]?.id || "");
  }

  useEffect(() => {
    let active = true;
    void Promise.all([hubApi.list(), chargingRequestApi.getMyContext()])
      .then(([hubList, ctx]) => {
        if (!active) return;
        setHubs(hubList);
        setVehicles(ctx.vehicles);
        setRequests(ctx.requests);
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

  async function handlePrepare() {
    if (!hubId || !vehicleId) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    setSubmitResult(null);
    try {
      const res = await chargingRequestApi.prepareChargingRequest(hubId, vehicleId, {
        currentBattery,
        targetBattery,
      });
      setProposal(res);
      setPendingSubmitRequestId(newRequestId());
    } catch (err) {
      setProposal(null);
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!hubId || !vehicleId) return;
    setBusy(true);
    setError(null);
    setInfoMsg(null);
    try {
      const res = await chargingRequestApi.submitChargingRequest(
        pendingSubmitRequestId,
        hubId,
        vehicleId,
        { currentBattery, targetBattery },
      );
      setSubmitResult(res);
      setProposal(null);
      setPendingSubmitRequestId(newRequestId());
      setInfoMsg(res.usageGuide);
      await refreshContext();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(chargingRequestId: string) {
    setCancellingId(chargingRequestId);
    setError(null);
    setInfoMsg(null);
    try {
      await chargingRequestApi.cancelChargingRequest(newRequestId(), chargingRequestId);
      setInfoMsg("Đã hủy yêu cầu sạc và giải phóng cổng sạc (nếu đã phân bổ).");
      await refreshContext();
    } catch (err) {
      setError(err);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/student/my-vehicle" className="text-sm text-neutral-500 hover:underline">
        ← Xe của tôi
      </Link>
      <PageHeader title="Yêu cầu sạc ngay" subtitle="Gửi yêu cầu sạc tại Hub đang đứng hoặc theo dõi hàng đợi" />

      <ErrorMessage error={error} />
      {infoMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {infoMsg}
        </div>
      )}

      <div data-tour="st-uc07-form">
        <Card className="space-y-4 p-4">
          <h2 className="text-base font-bold">Thông tin yêu cầu sạc</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Mobility Hub
            </label>
            <select
              value={hubId}
              onChange={(e) => {
                setHubId(e.target.value);
                setProposal(null);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-neutral-900"
            >
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.freeChargingPorts}/{h.totalChargingPorts} cổng sạc trống)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Phương tiện của bạn
            </label>
            <select
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value);
                setProposal(null);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-neutral-900"
            >
              {vehicles.length === 0 && <option value="">Chưa có phương tiện cá nhân</option>}
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} ({connectorTypeLabel(v.connectorType)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Mức pin hiện tại (%)
            </label>
            <input
              type="number"
              min={0}
              max={99}
              value={currentBattery}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setCurrentBattery(Number.isNaN(v) ? 0 : Math.min(99, Math.max(0, v)));
                setProposal(null);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-neutral-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-300">
              Mức pin mục tiêu (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={targetBattery}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setTargetBattery(Number.isNaN(v) ? 100 : Math.min(100, Math.max(1, v)));
                setProposal(null);
              }}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-neutral-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="dark"
            loading={busy}
            disabled={!hubId || !vehicleId}
            onClick={() => void handlePrepare()}
            className="flex-1 py-2 text-xs"
          >
            Kiểm tra khả năng sạc ngay
          </Button>
          {proposal && (
            <Button
              type="button"
              variant="primary"
              loading={busy}
              onClick={() => void handleSubmit()}
              className="flex-1 py-2 text-xs"
            >
              {proposal.canAllocateNow ? "Xác nhận nhận cổng sạc" : "Xác nhận vào hàng đợi"}
            </Button>
          )}
        </div>

        {proposal && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs dark:border-sky-500/30 dark:bg-sky-500/10">
            {proposal.canAllocateNow ? (
              <div className="space-y-1">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">
                  Có cổng sạc trống sẵn sàng phân bổ ngay
                </p>
                <p>
                  Cổng dự kiến:{" "}
                  <span className="font-semibold">
                    {proposal.proposedPortId ? friendlyPortLabel(proposal.proposedPortId) : "Sẽ phân bổ khi đến Hub"}
                  </span>
                </p>
                {proposal.allocationDeadline && (
                  <p>Hạn bắt đầu cắm sạc: {formatDateTimeVi(proposal.allocationDeadline)}</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <p className="font-bold text-amber-800 dark:text-amber-200">
                  Hiện chưa có cổng sạc phù hợp trống — sẽ xếp vào hàng đợi
                </p>
                <p>Thời gian chờ ước tính: khoảng {proposal.estimatedWaitMinutes} phút.</p>
              </div>
            )}
          </div>
        )}

        {submitResult && (
          <div className="space-y-1 rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs dark:border-emerald-500/40 dark:bg-emerald-500/10">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-emerald-800 dark:text-emerald-300">Yêu cầu sạc đã được ghi nhận</p>
              <StatusBadge status={submitResult.status} />
            </div>
            <p>{submitResult.usageGuide}</p>
          </div>
        )}
      </Card>
      </div>

      <div data-tour="st-uc07-list">
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Yêu cầu sạc của bạn ({requests.length})</h2>
        </div>

        {requests.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Bạn chưa có yêu cầu sạc nào.
          </p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => {
              const canCancel = req.status === "WAITING" || req.status === "ALLOCATED";
              const vehicle = vehicleById.get(req.vehicleId);
              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 p-3 text-xs dark:border-white/10"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{hubNameById.get(req.hubId) ?? req.hubId}</span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="text-neutral-500 dark:text-neutral-400">
                      Xe: {vehicle?.plate ?? "Xe cá nhân"} · Pin: {req.currentBattery}% → {req.targetBattery}%
                      {req.assignedPortId ? ` · ${friendlyPortLabel(req.assignedPortId)}` : ""}
                    </p>
                    {req.allocationDeadline && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        Hạn cắm sạc: {formatDateTimeVi(req.allocationDeadline)}
                      </p>
                    )}
                  </div>
                  {canCancel && (
                    <Button
                      type="button"
                      variant="danger"
                      loading={cancellingId === req.id}
                      onClick={() => void handleCancel(req.id)}
                      className="px-3 py-1.5 text-xs"
                    >
                      Hủy yêu cầu
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
