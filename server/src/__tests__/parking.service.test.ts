import { beforeEach, describe, expect, it } from "vitest";
import { parkingService } from "../services/ParkingService";
import { seedBasicFixtures, type TestFixtures } from "./testHelpers";

function futureRange(offsetMinutesStart = 30, durationMinutes = 60) {
  const startTime = new Date(Date.now() + offsetMinutesStart * 60_000);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
  return { startTime, endTime };
}

describe("ParkingService (UC06 & FR-2.3.1)", () => {
  let fx: TestFixtures;

  beforeEach(() => {
    fx = seedBasicFixtures();
  });

  it("TC-UC06-01: tìm chỗ đỗ chỉ trả về slot thường (không lấy slot có cổng sạc)", async () => {
    const slots = await parkingService.searchAvailableSlots(
      fx.student1Id,
      fx.hubId,
      fx.privateVehicle1Id,
      futureRange(),
    );
    expect(slots.map((s) => s.id)).toEqual([fx.regularSlotId]);
  });

  it("TC-UC06-02: từ chối khung giờ ở quá khứ (VALIDATION_ERROR)", async () => {
    const pastStart = new Date(Date.now() - 10 * 60_000);
    const pastEnd = new Date(Date.now() + 50 * 60_000);
    await expect(
      parkingService.searchAvailableSlots(fx.student1Id, fx.hubId, fx.privateVehicle1Id, {
        startTime: pastStart,
        endTime: pastEnd,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("TC-UC06-03: giữ tạm (HELD), chống gửi lặp requestId và xác nhận thành CONFIRMED", async () => {
    const range = futureRange(45, 60);
    const hold = await parkingService.holdSlot(
      "req-hold-001",
      fx.student1Id,
      fx.regularSlotId,
      fx.privateVehicle1Id,
      range,
    );
    expect(hold.status).toBe("HELD");

    // Gửi lặp requestId trả đúng lượt giữ cũ
    const holdReplay = await parkingService.holdSlot(
      "req-hold-001",
      fx.student1Id,
      fx.regularSlotId,
      fx.privateVehicle1Id,
      range,
    );
    expect(holdReplay.id).toBe(hold.id);

    const booking = await parkingService.confirmReservation("req-confirm-001", fx.student1Id, hold.id);
    expect(booking.allocation.status).toBe("CONFIRMED");
    expect(booking.slotCode).toBe("A-02");
  });

  it("TC-UC06-04: hủy đặt chỗ đã xác nhận chuyển sang CANCELLED", async () => {
    const range = futureRange(60, 60);
    const hold = await parkingService.holdSlot(
      "req-hold-002",
      fx.student1Id,
      fx.regularSlotId,
      fx.privateVehicle1Id,
      range,
    );
    const booking = await parkingService.confirmReservation("req-confirm-002", fx.student1Id, hold.id);

    const cancelled = await parkingService.cancelBooking(fx.student1Id, booking.allocation.id);
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("TC-2.3.1-01: tự động giải phóng lượt giữ quá hạn (expireDueHolds)", async () => {
    const range = futureRange(45, 60);
    const hold = await parkingService.holdSlot(
      "req-hold-003",
      fx.student1Id,
      fx.regularSlotId,
      fx.privateVehicle1Id,
      range,
    );
    expect(hold.holdExpiresAt).toBeTruthy();

    const afterExpiry = new Date(hold.holdExpiresAt!.getTime() + 60_000);
    const releasedCount = parkingService.expireDueHolds(afterExpiry);
    expect(releasedCount).toBe(1);

    const active = await parkingService.getActiveHold(fx.student1Id);
    expect(active).toBeUndefined();
  });
});
