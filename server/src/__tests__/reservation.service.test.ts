import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { sharedVehicles } from "../db/schema";
import { db } from "../lib/db";
import { reservationService } from "../services/ReservationService";
import { seedBasicFixtures, type TestFixtures } from "./testHelpers";

describe("ReservationService (UC02 & UC03)", () => {
  let fx: TestFixtures;

  beforeEach(() => {
    fx = seedBasicFixtures();
  });

  it("TC-UC02-01: chỉ liệt kê xe AVAILABLE đủ ngưỡng pin tại Hub", async () => {
    const vehicles = await reservationService.getReservableVehicles(fx.student1Id, fx.hubId);
    expect(vehicles.map((v) => v.id)).toEqual([fx.vehicleReadyId]);
  });

  it("TC-UC02-02: xác nhận đặt xe chuyển trạng thái xe sang RESERVED và chống gửi lặp requestId", async () => {
    const first = await reservationService.confirmReservation(
      "req-uc02-001",
      fx.student1Id,
      fx.hubId,
      fx.vehicleReadyId,
    );
    expect(first.status).toBe("RESERVED");

    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, fx.vehicleReadyId)).get();
    expect(vehicle?.status).toBe("RESERVED");

    // Gửi lặp cùng requestId phải trả về đúng lượt đặt cũ
    const replay = await reservationService.confirmReservation(
      "req-uc02-001",
      fx.student1Id,
      fx.hubId,
      fx.vehicleReadyId,
    );
    expect(replay.id).toBe(first.id);
  });

  it("TC-UC02-03: sinh viên thứ hai không thể đặt cùng xe đã bị RESERVED (CONFLICT)", async () => {
    await reservationService.confirmReservation("req-uc02-a", fx.student1Id, fx.hubId, fx.vehicleReadyId);

    await expect(
      reservationService.confirmReservation("req-uc02-b", fx.student2Id, fx.hubId, fx.vehicleReadyId),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("TC-UC03-01: hủy đặt xe hợp lệ sẽ giải phóng xe về AVAILABLE", async () => {
    const reserved = await reservationService.confirmReservation(
      "req-uc02-c",
      fx.student1Id,
      fx.hubId,
      fx.vehicleReadyId,
    );

    const cancelled = await reservationService.confirmCancellation("req-uc03-c", fx.student1Id, reserved.id);
    expect(cancelled.status).toBe("CANCELLED");

    const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, fx.vehicleReadyId)).get();
    expect(vehicle?.status).toBe("AVAILABLE");
  });

  it("TC-UC03-02: chặn sinh viên khác hủy lượt đặt không thuộc về mình (FORBIDDEN)", async () => {
    const reserved = await reservationService.confirmReservation(
      "req-uc02-d",
      fx.student1Id,
      fx.hubId,
      fx.vehicleReadyId,
    );

    await expect(
      reservationService.confirmCancellation("req-uc03-d", fx.student2Id, reserved.id),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
