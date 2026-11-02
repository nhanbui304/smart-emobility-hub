/**
 * Chạy các scheduler định kỳ (hết hạn giữ chỗ, hết hạn đặt xe, cảnh báo Hub).
 * Scheduler nào chưa hiện thực (ném NOT_IMPLEMENTED) sẽ chỉ báo một lần rồi bỏ qua,
 * không làm sập server.
 */
import { systemConfig } from "../config/systemConfig";
import { AppError, ErrorCode } from "../lib/errors";
import { holdExpiryScheduler } from "./HoldExpiryScheduler";
import { hubAlertScheduler } from "./HubAlertScheduler";
import { reservationExpiryScheduler } from "./ReservationExpiryScheduler";

interface Job {
  name: string;
  run: (now: Date) => unknown;
}

const jobs: Job[] = [
  { name: "HoldExpiryScheduler.expireDueHolds", run: (now) => holdExpiryScheduler.expireDueHolds(now) },
  {
    name: "ReservationExpiryScheduler.expireDueReservations",
    run: (now) => reservationExpiryScheduler.expireDueReservations(now),
  },
  { name: "HubAlertScheduler.evaluateHubAlerts", run: (now) => hubAlertScheduler.evaluateHubAlerts(now) },
];

const timers: NodeJS.Timeout[] = [];
const reportedNotImplemented = new Set<string>();

async function runJob(job: Job): Promise<void> {
  try {
    await job.run(new Date());
  } catch (err) {
    if (err instanceof AppError && err.code === ErrorCode.NOT_IMPLEMENTED) {
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
    void runJob(job);
    timers.push(setInterval(() => void runJob(job), systemConfig.schedulerIntervalMs));
  }
}

export function stopSchedulers(): void {
  timers.splice(0).forEach(clearInterval);
}
