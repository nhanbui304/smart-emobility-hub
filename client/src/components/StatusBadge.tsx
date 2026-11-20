import { statusLabels } from "../statusLabels";

/**
 * Nhãn trạng thái – LUÔN có chữ, không chỉ dùng màu (yêu cầu phi chức năng).
 * <StatusBadge status={vehicle.status} />
 */
const tone: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  muted: "bg-neutral-200 text-neutral-700 dark:bg-white/10 dark:text-neutral-300",
};

const statusTone: Record<string, keyof typeof tone> = {
  AVAILABLE: "good",
  IN_SERVICE: "good",
  CONFIRMED: "good",
  ALLOCATED: "good",
  COMPLETED: "good",
  CLOSED: "good",
  ARRIVED: "good",
  PENDING: "warn",
  ACTIVE: "info",
  IN_USE: "info",
  RESERVED: "info",
  CHARGING: "info",
  HELD: "info",
  IN_TRANSIT: "info",
  RUNNING: "info",
  HANDING_OVER: "warn",
  WAITING: "warn",
  PENDING_VERIFICATION: "warn",
  PENDING_RECONCILIATION: "warn",
  AWAITING_DISCONNECT: "warn",
  IN_PROGRESS: "warn",
  LOW_VEHICLE: "warn",
  NEAR_FULL: "warn",
  DATA_STALE: "warn",
  UNDER_MAINTENANCE: "bad",
  OUT_OF_SERVICE: "bad",
  FAILED: "bad",
  OPEN: "bad",
  RESOURCE_FAULT: "bad",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const t = tone[statusTone[status] ?? "muted"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${t}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label ?? statusLabels[status] ?? status}
    </span>
  );
}
