// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation, mục 2.3.1
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { systemConfig } from "../config/systemConfig";
import type { ParkingAllocation, ParkingSlot } from "../db/schema";
import { db } from "../lib/db";
import { AppError } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import { hubRepository } from "../repositories/HubRepository";
import { operationalRepository } from "../repositories/OperationalRepository";
import type { ActiveHold, ParkingBooking } from "../types/dto";

export const parkingService = {
  /** UC06 bước 1–3: kiểm tra yêu cầu, quyền dùng xe, Hub tiếp nhận; trả vị trí trống. Chỉ xem, chưa giữ chỗ. */
  async searchAvailableSlots(
    studentId: string,
    hubId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingSlot[]> {
    if (!validateSearchRequest(hubId, vehicleId, timeRange)) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Khung giờ không hợp lệ: phải bắt đầu sau thời điểm hiện tại và dài tối đa ${systemConfig.parkingMaxDurationHours} giờ.`,
      );
    }
    if (!operationalRepository.findVehicleRight(studentId, vehicleId)) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền sử dụng phương tiện này.");
    }
    const acceptance = operationalRepository.queryHubAcceptance(hubId, vehicleId);
    if (!acceptance.hub) throw new AppError("NOT_FOUND", "Không tìm thấy Hub.");
    if (!acceptance.accepting) {
      throw new AppError("CONFLICT", "Hub hiện không tiếp nhận phương tiện. Vui lòng chọn Hub khác.");
    }
    return operationalRepository.queryAvailableSlots(hubId, vehicleId, timeRange, new Date()).slots;
  },

  /**
   * UC06 bước 4–6: giữ tạm vị trí. Hạn giữ = min(now + 30 phút, thời điểm bắt đầu), không gia hạn (mục 2.3.1).
   * Kiểm tra chỗ trống, lượt giữ khác và tạo lượt giữ trong cùng một transaction.
   */
  async holdSlot(
    requestId: string,
    studentId: string,
    slotId: string,
    vehicleId: string,
    timeRange: TimeRange,
  ): Promise<ParkingAllocation> {
    const now = new Date();
    if (operationalRepository.findProcessedRequest(requestId)) {
      // Gửi lặp (Ext 8d): trả lại lượt giữ đã tạo, không kiểm tra lại điều kiện
      return db.transaction(() =>
        operationalRepository.atomicCheckAndHold(requestId, studentId, slotId, timeRange, now, vehicleId),
      );
    }
    if (!recheckReservationConditions(studentId, vehicleId, slotId, timeRange, now)) {
      throw new AppError(
        "CONFLICT",
        "Điều kiện đặt chỗ không còn hợp lệ (khung giờ đã bắt đầu hoặc phương tiện không thuộc bạn).",
      );
    }
    const holdDeadline = computeHoldDeadline(now, timeRange.startTime);
    return db.transaction(() =>
      operationalRepository.atomicCheckAndHold(requestId, studentId, slotId, timeRange, holdDeadline, vehicleId),
    );
  },

  /** UC06 bước 7–9: xác nhận lượt giữ còn hạn thành đặt chỗ (cùng bản ghi). */
  async confirmReservation(requestId: string, studentId: string, holdToken: string): Promise<ParkingBooking> {
    const allocation = db.transaction(() =>
      operationalRepository.atomicConfirmHold(requestId, studentId, holdToken, new Date()),
    );
    if (allocation.status === "EXPIRED") {
      throw new AppError("CONFLICT", "Lượt giữ đã hết hạn. Vui lòng tìm và chọn lại vị trí.");
    }
    if (allocation.status === "CANCELLED") {
      throw new AppError("CONFLICT", "Lượt giữ đã bị hủy hoặc vị trí không còn phục vụ. Vui lòng chọn vị trí khác.");
    }
    if (allocation.status !== "CONFIRMED") {
      throw new AppError("CONFLICT", "Lượt giữ này không còn xác nhận được.");
    }
    return toBooking(allocation);
  },

  /** UC06 Ext 7a: sinh viên bỏ lượt giữ, vị trí được giải phóng ngay. */
  async cancelHold(requestId: string, studentId: string, holdToken: string): Promise<ParkingAllocation> {
    const allocation = db.transaction(() => operationalRepository.atomicReleaseHold(requestId, studentId, holdToken));
    if (allocation.status === "CONFIRMED") {
      throw new AppError("CONFLICT", "Lượt giữ đã được xác nhận thành đặt chỗ. Hãy dùng chức năng Hủy đặt chỗ.");
    }
    return allocation;
  },

  /** UC06 Ext 5b, 7b: lượt giữ còn hạn của sinh viên và số giây còn lại (mở lại ứng dụng không gia hạn). */
  async getActiveHold(studentId: string): Promise<ActiveHold | undefined> {
    const now = new Date();
    const hold = operationalRepository.findActiveHold(studentId, now);
    if (!hold || !hold.holdExpiresAt) return undefined;
    return { hold, remainingSeconds: Math.max(0, Math.ceil((hold.holdExpiresAt.getTime() - now.getTime()) / 1000)) };
  },

  /** Mục 2.3.1: giải phóng lượt giữ quá hạn và đặt chỗ đã hết khung giờ. Trả về số bản ghi đã giải phóng. */
  expireDueHolds(now: Date): number {
    return db.transaction(() => operationalRepository.atomicExpireHolds(now)).length;
  },

  /** Cancel Parking Reservation: hủy đặt chỗ đã xác nhận trước khi tới khung giờ sử dụng. */
  async cancelBooking(studentId: string, bookingId: string): Promise<ParkingAllocation> {
    return db.transaction(() => operationalRepository.atomicCancelBooking(studentId, bookingId, new Date()));
  },
};

// ---------- Bước nội bộ (method private "–" trong class diagram) ----------

/** private (–) trong class diagram. UC06 Ext 2a: khung giờ bắt đầu ở tương lai, không dài quá giới hạn. */
function validateSearchRequest(hubId: string, vehicleId: string, timeRange: TimeRange): boolean {
  const maxMs = systemConfig.parkingMaxDurationHours * 3_600_000;
  return (
    hubId.length > 0 &&
    vehicleId.length > 0 &&
    timeRange.startTime.getTime() > Date.now() &&
    timeRange.endTime > timeRange.startTime &&
    timeRange.endTime.getTime() - timeRange.startTime.getTime() <= maxMs
  );
}

/** private (–) trong class diagram. UC06 Ext 5c: xe vẫn thuộc sinh viên, khung giờ chưa bắt đầu. */
function recheckReservationConditions(
  studentId: string,
  vehicleId: string,
  slotId: string,
  timeRange: TimeRange,
  now: Date,
): boolean {
  return (
    slotId.length > 0 &&
    timeRange.startTime > now &&
    operationalRepository.findVehicleRight(studentId, vehicleId) !== undefined
  );
}

/** private (–) trong class diagram. Mục 2.3.1 ý 2: hạn giữ = thời điểm sớm hơn giữa now + 30 phút và giờ bắt đầu. */
function computeHoldDeadline(now: Date, start: Date): Date {
  const byDuration = new Date(now.getTime() + systemConfig.parkingHoldMinutes * 60_000);
  return byDuration < start ? byDuration : start;
}

// ---------- Hàm hỗ trợ (không có trong sơ đồ) ----------

const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

/** UC06 bước 9: mã đặt chỗ, Hub, vị trí, khung giờ và điều kiện đến sử dụng. */
function toBooking(allocation: ParkingAllocation): ParkingBooking {
  const slot = hubRepository.listSlots().find((s) => s.id === allocation.slotId);
  const hub = slot ? hubRepository.findById(slot.hubId) : undefined;
  const slotCode = slot?.code ?? "";
  return {
    allocation,
    hubId: slot?.hubId ?? "",
    slotCode,
    arrivalConditions:
      `Đến ${hub?.name ?? "Hub"} trong khung ${timeFormat.format(allocation.startTime)} – ` +
      `${timeFormat.format(allocation.endTime)} và đỗ đúng vị trí ${slotCode}. ` +
      "Hết khung giờ thì đặt chỗ tự hết hiệu lực.",
  };
}
