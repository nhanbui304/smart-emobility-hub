/**
 * Chạy các tác vụ định kỳ (mục 2.3): hết hạn giữ chỗ, hết hạn đặt xe, cảnh báo Hub.
 * Tác vụ nào chưa hiện thực (ném NOT_IMPLEMENTED) chỉ báo một lần rồi bỏ qua, không làm sập server.
 */
import { systemConfig } from "../config/systemConfig";
import { AppError } from "../lib/errors";
import { holdExpiryScheduler } from "./HoldExpiryScheduler";
import { hubAlertScheduler } from "./HubAlertScheduler";
import { reservationExpiryScheduler } from "./ReservationExpiryScheduler";

const jobs = [
  { name: "HoldExpiryScheduler.expireDueHolds", run: (now: Date) => holdExpiryScheduler.expireDueHolds(now) },
  {
    name: "ReservationExpiryScheduler.expireDueReservations",
    run: (now: Date) => reservationExpiryScheduler.expireDueReservations(now),
  },
  { name: "HubAlertScheduler.evaluateHubAlerts", run: (now: Date) => hubAlertScheduler.evaluateHubAlerts(now) },
];

const reportedNotImplemented = new Set<string>();

function runJob(job: (typeof jobs)[number]): void {
  try {
    job.run(new Date());
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_IMPLEMENTED") {
      if (!reportedNotImplemented.has(job.name)) {
        reportedNotImplemented.add(job.name);
        console.log(`[scheduler] ${job.name}: chưa hiện thực – bỏ qua.`);
      }
      return;
    }
    console.error(`[scheduler] ${job.name} lỗi:`, err);
  }
}

export function startSchedulers(): void {
  for (const job of jobs) {
    runJob(job);
    setInterval(() => runJob(job), systemConfig.schedulerIntervalMs);
  }
}
