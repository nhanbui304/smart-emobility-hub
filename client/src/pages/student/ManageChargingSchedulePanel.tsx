// Owner: Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
// Tương ứng lớp «boundary» ChargingReservationView trong docs/hoangnhan_submission3/UC09.drawio.
// Tách thành panel riêng để nhúng vào MyVehiclePage mà không xung đột với UC06 (Quang Nhân) và UC08 (Minh Triết).
import { useEffect, useMemo, useState } from "react";
import { chargingReservationApi } from "../../api/chargingReservation";
import { ApiError } from "../../api/client";
import { hubApi } from "../../api/hubs";
import { myReservationsApi } from "../../api/myReservations";
import { newRequestId } from "../../api/requestId";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { StatusBadge } from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import type {
  CancellationCheck,
  CancellationResult,
  ChargingNeed,
  ChargingReservation,
  ChargingSlotOption,
  HubStatus,
  RescheduleForm,
  ReservationDetail,
  TimeRange,
  UpdatedReservation,
} from "../../types";

type PanelMode = "VIEW" | "RESCHEDULE_CRITERIA" | "RESCHEDULE_CONFIRM" | "CANCEL_CONFIRM";

function toLocalDateTimeInput(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
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

function defaultTomorrowRange(startHour: number, durationMinutes = 90): { start: string; end: string } {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    start: toLocalDateTimeInput(start),
    end: toLocalDateTimeInput(end),
  };
}

export function ManageChargingSchedulePanel() {
  const { user } = useAuth();

  // Danh sách Hub để hiển thị tên Hub và chọn Hub mới khi đổi lịch
  const [hubs, setHubs] = useState<HubStatus[]>([]);
  const hubNameById = useMemo(() => new Map(hubs.map((h) => [h.id, h.name])), [hubs]);

  // Bước 1–3: danh sách lịch sạc thuộc tài khoản đang đăng nhập.
  const [myReservations, setMyReservations] = useState<ChargingReservation[]>([]);
  const quickItems = useMemo(() => {
    return myReservations.map((r) => ({
      id: r.id,
      label: `Lịch ${r.id.slice(0, 8)} (${formatDateTimeVi(r.startTime)})`,
    }));
  }, [myReservations]);

  const [reservationIdInput, setReservationIdInput] = useState("");
  const [activeReservationId, setActiveReservationId] = useState<string>("");
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [mode, setMode] = useState<PanelMode>("VIEW");

  // Trạng thái đổi lịch (UC09 bước 4–11)
  const [rescheduleForm, setRescheduleForm] = useState<RescheduleForm | null>(null);
  const [newHubId, setNewHubId] = useState<string>("");
  const defaultRange = useMemo(() => defaultTomorrowRange(15, 90), []);
  const [newStartInput, setNewStartInput] = useState<string>(defaultRange.start);
  const [newEndInput, setNewEndInput] = useState<string>(defaultRange.end);
  const [currentBattery, setCurrentBattery] = useState<number>(35);
  const [targetBattery, setTargetBattery] = useState<number>(90);
  const [options, setOptions] = useState<ChargingSlotOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ChargingSlotOption | null>(null);
  const [pendingRescheduleRequestId, setPendingRescheduleRequestId] = useState<string | null>(null);
  const [updatedResult, setUpdatedResult] = useState<UpdatedReservation | null>(null);

  // Trạng thái hủy lịch (UC09 Ext 4b)
  const [cancellationCheck, setCancellationCheck] = useState<CancellationCheck | null>(null);
  const [pendingCancelRequestId, setPendingCancelRequestId] = useState<string | null>(null);
  const [cancellationResult, setCancellationResult] = useState<CancellationResult | null>(null);

  // Trạng thái loading & thông báo
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    hubApi
      .list()
      .then((list) => {
        setHubs(list);
      })
      .catch(() => undefined);
  }, []);

  // Đồng bộ danh sách lịch sạc của sinh viên từ server.
  useEffect(() => {
    let mounted = true;
    setMyReservations([]);
    setDetail(null);
    setActiveReservationId("");
    setReservationIdInput("");
    myReservationsApi
      .list()
      .then((res) => {
        if (!mounted) return;
        const list = res.chargingReservations ?? [];
        setMyReservations(list);
        const first = list[0];
        if (first) void selectReservation(first.id);
      })
      .catch((err) => {
        if (!mounted) return;
        if (!(err instanceof ApiError && err.code === "NOT_IMPLEMENTED")) {
          setErrorMsg("Không tải được danh sách lịch sạc.");
        }
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** ChargingReservationView.selectReservation(reservationId) – Bước 1–3 */
  async function selectReservation(reservationId: string) {
    const trimmed = reservationId.trim();
    if (!trimmed) {
      setErrorMsg("Vui lòng nhập mã lịch sạc cần xem.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setUpdatedResult(null);
    setCancellationResult(null);
    setMode("VIEW");
    setRescheduleForm(null);
    setOptions([]);
    setSelectedOption(null);
    setCancellationCheck(null);
    setPendingRescheduleRequestId(null);
    setPendingCancelRequestId(null);

    try {
      const data = await chargingReservationApi.getReservationDetail(trimmed);
      setActiveReservationId(trimmed);
      setReservationIdInput(trimmed);
      setDetail(data);
    } catch (err) {
      setDetail(null);
      setActiveReservationId(trimmed);
      setErrorMsg(err instanceof Error ? err.message : "Không truy xuất được thông tin lịch sạc.");
    } finally {
      setBusy(false);
    }
  }

  /** ChargingReservationView.chooseReschedule(reservationId) – Bước 4–5 */
  async function chooseReschedule(reservationId: string) {
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setUpdatedResult(null);
    setCancellationResult(null);
    setOptions([]);
    setSelectedOption(null);
    setPendingRescheduleRequestId(null);

    try {
      const form = await chargingReservationApi.startReschedule(reservationId);
      setRescheduleForm(form);
      setNewHubId(detail?.hubId || hubs[0]?.id || "");
      // Gợi ý khung giờ mới sau khung giờ cũ 2 tiếng để dễ test đổi lịch
      const currentStart = new Date(form.reservation.startTime);
      const currentEnd = new Date(form.reservation.endTime);
      const durationMs = Math.max(60 * 60_000, currentEnd.getTime() - currentStart.getTime());
      const suggestedStart = new Date(currentStart.getTime() + 2 * 60 * 60_000);
      const suggestedEnd = new Date(suggestedStart.getTime() + durationMs);
      setNewStartInput(toLocalDateTimeInput(suggestedStart));
      setNewEndInput(toLocalDateTimeInput(suggestedEnd));
      setCurrentBattery(form.reservation.currentBattery ?? 35);
      setTargetBattery(form.reservation.targetBattery ?? 90);
      setMode("RESCHEDULE_CRITERIA");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Lịch sạc không đủ điều kiện đổi.");
    } finally {
      setBusy(false);
    }
  }

  /** ChargingReservationView.submitNewCriteria(hubId, timeRange, chargingNeed) – Bước 6–7 */
  async function submitNewCriteria(hubId: string, timeRange: TimeRange, chargingNeed: ChargingNeed) {
    if (!activeReservationId) return;
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setSelectedOption(null);
    setPendingRescheduleRequestId(null);

    try {
      const found = await chargingReservationApi.findRescheduleOptions(
        activeReservationId,
        hubId,
        timeRange,
        chargingNeed,
      );
      setOptions(found);
      setMode("RESCHEDULE_CRITERIA");
      setInfoMsg(`Tìm thấy ${found.length} cổng sạc khả dụng. Lịch sạc cũ của bạn vẫn đang được giữ nguyên.`);
    } catch (err) {
      setOptions([]);
      setErrorMsg(err instanceof Error ? err.message : "Không tìm thấy phương án đổi lịch phù hợp.");
    } finally {
      setBusy(false);
    }
  }

  /** ChargingReservationView.selectOption(optionId) – Bước 8 */
  function selectOption(optionId: string) {
    const picked = options.find((o) => o.slotOptionId === optionId) ?? null;
    if (!picked) return;
    setSelectedOption(picked);
    // Sinh requestId MỘT lần cho thao tác xác nhận này; nếu retry gửi lại cùng requestId (Ext 10d)
    setPendingRescheduleRequestId(newRequestId());
    setErrorMsg(null);
    setMode("RESCHEDULE_CONFIRM");
  }

  /** ChargingReservationView.confirmReschedule() – Bước 9–11 */
  async function confirmReschedule() {
    if (!activeReservationId || !selectedOption || !rescheduleForm) return;
    const reqId = pendingRescheduleRequestId ?? newRequestId();
    setPendingRescheduleRequestId(reqId);
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const updated = await chargingReservationApi.confirmReschedule(
        reqId,
        activeReservationId,
        selectedOption.slotOptionId,
        rescheduleForm.reservation.version,
      );
      setUpdatedResult(updated);
      setMode("VIEW");
      setRescheduleForm(null);
      setOptions([]);
      setSelectedOption(null);
      setPendingRescheduleRequestId(null);
      setInfoMsg("Đổi lịch sạc thành công! Tài nguyên cổng sạc mới đã được giữ và tài nguyên cũ đã được giải phóng.");
      // Tải lại chi tiết lịch mới nhất
      const refreshed = await chargingReservationApi.getReservationDetail(activeReservationId);
      setDetail(refreshed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể hoàn tất đổi lịch sạc.";
      setErrorMsg(msg);
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        // Ext 10b: Lịch đã thay đổi → tải lại chi tiết ở bước 3
        await selectReservation(activeReservationId);
        setErrorMsg(msg);
      } else if (err instanceof ApiError && err.code === "CONFLICT") {
        // Ext 10a (TC-UC09-01): Phương án vừa hết chỗ → quay lại danh sách cập nhật
        setMode("RESCHEDULE_CRITERIA");
        setSelectedOption(null);
        setPendingRescheduleRequestId(null);
        if (newHubId && newStartInput && newEndInput) {
          chargingReservationApi
            .findRescheduleOptions(
              activeReservationId,
              newHubId,
              {
                startTime: new Date(newStartInput).toISOString(),
                endTime: new Date(newEndInput).toISOString(),
              },
              { currentBattery, targetBattery },
            )
            .then((refreshedOpts) => setOptions(refreshedOpts))
            .catch(() => setOptions([]));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  /** ChargingReservationView.cancelReschedule() – Ext 9a */
  function cancelReschedule() {
    setMode("VIEW");
    setRescheduleForm(null);
    setOptions([]);
    setSelectedOption(null);
    setPendingRescheduleRequestId(null);
    setErrorMsg(null);
    setInfoMsg("Đã hủy thao tác đổi lịch. Lịch sạc và cổng sạc hiện tại của bạn vẫn giữ nguyên.");
  }

  /** ChargingReservationView.chooseCancel(reservationId) – Ext 4b */
  async function chooseCancel(reservationId: string) {
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setUpdatedResult(null);
    setCancellationResult(null);
    setPendingCancelRequestId(null);

    try {
      const check = await chargingReservationApi.checkCancellation(reservationId);
      setCancellationCheck(check);
      if (!check.canCancel) {
        setErrorMsg(check.reason ?? "Lịch sạc không còn được phép hủy.");
        setMode("VIEW");
        return;
      }
      setPendingCancelRequestId(newRequestId());
      setMode("CANCEL_CONFIRM");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể kiểm tra điều kiện hủy lịch sạc.");
    } finally {
      setBusy(false);
    }
  }

  /** ChargingReservationView.confirmCancel() – Ext 4b.1 */
  async function confirmCancel() {
    if (!activeReservationId || !cancellationCheck) return;
    const reqId = pendingCancelRequestId ?? newRequestId();
    setPendingCancelRequestId(reqId);
    setBusy(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const result = await chargingReservationApi.cancelReservation(
        reqId,
        activeReservationId,
        cancellationCheck.version,
      );
      setCancellationResult(result);
      setMode("VIEW");
      setCancellationCheck(null);
      setPendingCancelRequestId(null);
      setInfoMsg("Đã hủy lịch sạc thành công và giải phóng cổng sạc đã giữ.");
      const refreshed = await chargingReservationApi.getReservationDetail(activeReservationId);
      setDetail(refreshed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể hoàn tất hủy lịch sạc.";
      setErrorMsg(msg);
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        await selectReservation(activeReservationId);
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  /** ChargingReservationView.keepReservation() – Ext 4b.2 */
  function keepReservation() {
    setMode("VIEW");
    setCancellationCheck(null);
    setPendingCancelRequestId(null);
    setErrorMsg(null);
    setInfoMsg("Đã giữ nguyên lịch sạc hiện tại của bạn.");
  }

  const canReschedule = detail?.allowedActions.includes("RESCHEDULE") ?? false;
  const canCancel = detail?.allowedActions.includes("CANCEL") ?? false;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-lime">
            Lịch sạc cá nhân
          </p>
          <h2 className="mt-0.5 text-base font-bold">Xem, đổi hoặc hủy lịch sạc đã đặt</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Quản lý các khung giờ sạc xe điện cá nhân tại Hub.
          </p>
        </div>
        {detail && <StatusBadge status={detail.status} />}
      </div>

      {/* Bước 1: Chọn lịch sạc cần quản lý */}
      <div className="space-y-2 rounded-xl bg-neutral-50 p-3 dark:bg-white/5">
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300">
          Chọn lịch sạc hoặc nhập mã lịch
        </label>
        {quickItems.length === 0 && <p className="text-xs text-neutral-500">Chưa có lịch sạc trong danh sách.</p>}
        <div className="flex flex-wrap gap-2">
          {quickItems.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => void selectReservation(q.id)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                activeReservationId === q.id
                  ? "border-brand bg-brand text-white dark:border-lime dark:bg-lime dark:text-brand-dark"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-white/15 dark:bg-transparent dark:text-neutral-200 dark:hover:bg-white/10"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={reservationIdInput}
            onChange={(e) => setReservationIdInput(e.target.value)}
            placeholder="Nhập mã lịch sạc"
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/15 dark:bg-neutral-900 dark:focus:border-lime"
          />
          <Button
            type="button"
            variant="dark"
            loading={busy && mode === "VIEW"}
            onClick={() => void selectReservation(reservationIdInput)}
            className="px-4 py-2 text-xs"
          >
            Xem lịch
          </Button>
        </div>
      </div>

      {/* Thông báo lỗi / thông tin */}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {infoMsg}
        </div>
      )}

      {/* Bước 3: Chi tiết lịch sạc hiện tại */}
      {detail && (
        <div className="space-y-3 rounded-xl border border-neutral-200 p-3.5 dark:border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2.5 dark:border-white/10">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Mã lịch: <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-100">{activeReservationId}</span>
              </p>
              <p className="text-sm font-bold">
                {hubNameById.get(detail.hubId) ?? detail.hubId}
              </p>
            </div>
            <StatusBadge status={detail.status} />
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-white/5">
              <p className="text-neutral-500 dark:text-neutral-400">Phương tiện cá nhân</p>
              <p className="mt-0.5 font-semibold">
                {detail.vehicle.plate} · {detail.vehicle.type === "E_MOTORBIKE" ? "Xe máy điện" : "Xe đạp điện"}
              </p>
              <p className="text-[11px] text-neutral-500">Đầu sạc: {detail.vehicle.connectorType}</p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-white/5">
              <p className="text-neutral-500 dark:text-neutral-400">Cổng sạc được phân bổ</p>
              <p className="mt-0.5 font-mono font-semibold">{detail.portId.slice(0, 12)}…</p>
              <p className="text-[11px] text-neutral-500">
                Thao tác được phép: {detail.allowedActions.join(", ")}
              </p>
            </div>
            <div className="rounded-lg bg-neutral-50 p-2.5 sm:col-span-2 dark:bg-white/5">
              <p className="text-neutral-500 dark:text-neutral-400">Khung giờ sạc</p>
              <p className="mt-0.5 font-semibold">
                {formatDateTimeVi(detail.timeRange.startTime)} → {formatDateTimeVi(detail.timeRange.endTime)}
              </p>
            </div>
          </div>

          {/* Nút thao tác chính (chỉ hiện khi đang ở chế độ VIEW) */}
          {mode === "VIEW" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                disabled={!canReschedule || busy}
                onClick={() => void chooseReschedule(activeReservationId)}
                className="flex-1 py-2.5 text-xs"
              >
                Đổi lịch sạc
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={!canCancel || busy}
                onClick={() => void chooseCancel(activeReservationId)}
                className="flex-1 py-2.5 text-xs"
              >
                Hủy lịch sạc
              </Button>
            </div>
          )}

          {mode === "VIEW" && !canReschedule && !canCancel && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Lịch sạc này không còn ở trạng thái Đã xác nhận trước giờ bắt đầu nên không thể đổi hoặc hủy.
            </p>
          )}
        </div>
      )}

      {/* Kết quả sau khi đổi lịch thành công (Bước 11) */}
      {updatedResult && (
        <div className="space-y-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <p className="font-bold text-emerald-800 dark:text-emerald-300">
            Lịch sạc đã được cập nhật
          </p>
          <p>
            <strong>Hub mới:</strong> {hubNameById.get(updatedResult.hubId) ?? updatedResult.hubId} ·{" "}
            <strong>Cổng:</strong> <span className="font-mono">{updatedResult.portId.slice(0, 12)}…</span>
          </p>
          <p>
            <strong>Khung giờ mới:</strong> {formatDateTimeVi(updatedResult.timeRange.startTime)} →{" "}
            {formatDateTimeVi(updatedResult.timeRange.endTime)}
          </p>
          <p className="text-emerald-900 dark:text-emerald-200">{updatedResult.usageGuide}</p>
        </div>
      )}

      {/* Kết quả sau khi hủy lịch thành công (Ext 4b.1) */}
      {cancellationResult && (
        <div className="space-y-1 rounded-xl border border-neutral-300 bg-neutral-100 p-3.5 text-xs dark:border-white/15 dark:bg-white/5">
          <p className="font-bold">Đã hủy lịch sạc</p>
          <p>
            Mã lịch <span className="font-mono font-semibold">{cancellationResult.reservationId}</span> đã chuyển sang trạng thái{" "}
            <StatusBadge status={cancellationResult.status} />.
          </p>
        </div>
      )}

      {/* Bước 6–7: Form nhập tiêu chí đổi lịch mới */}
      {mode === "RESCHEDULE_CRITERIA" && rescheduleForm && (
        <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 dark:border-sky-500/30 dark:bg-sky-500/5">
          <h3 className="text-sm font-bold">Chọn Hub, khung giờ &amp; nhu cầu sạc mới</h3>

          <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-medium">Hub sạc mới</label>
              <select
                value={newHubId}
                onChange={(e) => setNewHubId(e.target.value)}
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
              <label className="mb-1 block font-medium">Bắt đầu</label>
              <input
                type="datetime-local"
                value={newStartInput}
                onChange={(e) => setNewStartInput(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium">Kết thúc</label>
              <input
                type="datetime-local"
                value={newEndInput}
                onChange={(e) => setNewEndInput(e.target.value)}
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
                onChange={(e) => setCurrentBattery(Number(e.target.value))}
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
                onChange={(e) => setTargetBattery(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-neutral-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="dark"
              loading={busy}
              onClick={() => {
                if (!newHubId || !newStartInput || !newEndInput) {
                  setErrorMsg("Vui lòng chọn đầy đủ Hub và khung giờ mới.");
                  return;
                }
                void submitNewCriteria(
                  newHubId,
                  {
                    startTime: new Date(newStartInput).toISOString(),
                    endTime: new Date(newEndInput).toISOString(),
                  },
                  { currentBattery, targetBattery },
                );
              }}
              className="flex-1 py-2 text-xs"
            >
              Tìm phương án mới
            </Button>
            <Button type="button" variant="outline" onClick={cancelReschedule} className="py-2 text-xs">
              Hủy đổi lịch
            </Button>
          </div>

          {/* Danh sách cổng sạc khả dụng */}
          {options.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold">Chọn cổng sạc khả dụng:</p>
              <div className="space-y-2">
                {options.map((opt) => (
                  <div
                    key={opt.slotOptionId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-panel-dark"
                  >
                    <div>
                      <p className="font-semibold">
                        {hubNameById.get(opt.hubId) ?? opt.hubId} · Cổng{" "}
                        <span className="font-mono">{opt.portId.slice(0, 10)}…</span>
                      </p>
                      <p className="text-neutral-500">
                        {formatDateTimeVi(opt.startTime)} → {formatDateTimeVi(opt.endTime)} · Công suất tối đa{" "}
                        <strong>{opt.maxPowerKw} kW</strong>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => selectOption(opt.slotOptionId)}
                      className="px-3 py-1.5 text-xs"
                    >
                      Chọn cổng này
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bước 8–9: Đối chiếu lịch cũ vs lịch dự kiến mới và xác nhận đổi */}
      {mode === "RESCHEDULE_CONFIRM" && detail && selectedOption && rescheduleForm && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-3.5 text-xs dark:border-amber-500/40 dark:bg-amber-500/10">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
            Đối chiếu &amp; Xác nhận đổi lịch sạc
          </h3>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-white p-2.5 dark:border-white/10 dark:bg-panel-dark">
              <p className="font-semibold text-neutral-500">Lịch hiện tại (sẽ giải phóng)</p>
              <p className="mt-1 font-bold">{hubNameById.get(detail.hubId) ?? detail.hubId}</p>
              <p className="font-mono text-[11px]">Cổng: {detail.portId.slice(0, 12)}…</p>
              <p className="mt-0.5">
                {formatDateTimeVi(detail.timeRange.startTime)} → {formatDateTimeVi(detail.timeRange.endTime)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/70 p-2.5 dark:border-emerald-500/40 dark:bg-emerald-500/10">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">Lịch dự kiến mới</p>
              <p className="mt-1 font-bold">{hubNameById.get(selectedOption.hubId) ?? selectedOption.hubId}</p>
              <p className="font-mono text-[11px]">
                Cổng: {selectedOption.portId.slice(0, 12)}… ({selectedOption.maxPowerKw} kW)
              </p>
              <p className="mt-0.5">
                {formatDateTimeVi(selectedOption.startTime)} → {formatDateTimeVi(selectedOption.endTime)}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                Pin: {currentBattery}% → {targetBattery}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              loading={busy}
              onClick={() => void confirmReschedule()}
              className="flex-1 py-2 text-xs"
            >
              Xác nhận đổi lịch
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={cancelReschedule}
              className="py-2 text-xs"
            >
              Không đổi (Giữ lịch cũ)
            </Button>
          </div>
        </div>
      )}

      {/* Ext 4b: Hộp thoại xác nhận hủy lịch sạc */}
      {mode === "CANCEL_CONFIRM" && detail && cancellationCheck && (
        <div className="space-y-3 rounded-xl border border-red-300 bg-red-50/70 p-3.5 text-xs dark:border-red-500/40 dark:bg-red-500/10">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
            Xác nhận hủy lịch sạc
          </h3>
          <p className="text-red-900 dark:text-red-200">
            Bạn có chắc muốn hủy lịch sạc tại{" "}
            <strong>{hubNameById.get(detail.hubId) ?? detail.hubId}</strong> (khung giờ{" "}
            {formatDateTimeVi(detail.timeRange.startTime)} → {formatDateTimeVi(detail.timeRange.endTime)}) không?
            Cổng sạc đã giữ sẽ được giải phóng ngay lập tức.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              loading={busy}
              onClick={() => void confirmCancel()}
              className="flex-1 py-2 text-xs"
            >
              Xác nhận hủy lịch
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={keepReservation}
              className="py-2 text-xs"
            >
              Giữ lại lịch sạc
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
