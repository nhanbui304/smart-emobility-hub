import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { chargingPorts, chargingRequests, chargingReservations, parkingAllocations } from "../db/schema";
import type { ErrorCode } from "../lib/errors";
import { db } from "../lib/db";
import { authService } from "../services/AuthService";
import { resetTestData, seedBasicFixtures } from "./testHelpers";

function expectErrorCode(fn: () => unknown, expectedCode: ErrorCode): void {
  try {
    fn();
    expect.fail(`Expected AppError(${expectedCode}) to be thrown`);
  } catch (err) {
    expect(err).toMatchObject({ code: expectedCode });
  }
}

describe("AuthService (TC-AUTH-01..09)", () => {
  beforeEach(() => {
    resetTestData();
  });

  it("TC-AUTH-01: đăng ký tài khoản STUDENT mới và ẩn passwordHash", async () => {
    const user = await authService.register("  NewStudent@Hub.Local ", "secret123", "Nguyễn Văn A");
    expect(user.email).toBe("newstudent@hub.local");
    expect(user.role).toBe("STUDENT");
    expect(user.themePreference).toBe("SYSTEM");
    expect("passwordHash" in user).toBe(false);
  });

  it("TC-AUTH-02: từ chối đăng ký trùng email (CONFLICT)", async () => {
    await authService.register("dup@hub.local", "secret123", "User 1");
    await expect(authService.register("DUP@hub.local", "secret456", "User 2")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("TC-AUTH-03: đăng nhập thành công với mật khẩu đúng", async () => {
    await authService.register("login@hub.local", "correctPass", "User Login");
    const loggedIn = await authService.login("login@hub.local", "correctPass");
    expect(loggedIn.email).toBe("login@hub.local");
    expect(loggedIn.fullName).toBe("User Login");
  });

  it("TC-AUTH-04: từ chối đăng nhập khi sai mật khẩu (UNAUTHORIZED)", async () => {
    await authService.register("login@hub.local", "correctPass", "User Login");
    await expect(authService.login("login@hub.local", "wrongPass")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("TC-AUTH-05: lưu tùy chọn giao diện sáng/tối (Customize Interface Mode)", async () => {
    const created = await authService.register("theme@hub.local", "secret123", "Theme User");
    const updated = authService.updateTheme(created.id, "DARK");
    expect(updated.themePreference).toBe("DARK");
    expect(authService.getMe(created.id).themePreference).toBe("DARK");
  });

  it("TC-AUTH-06: đăng ký, liệt kê và xóa xe điện cá nhân với biển số chuẩn hóa", async () => {
    const student = await authService.register("pv-owner@hub.local", "secret123", "Chủ xe 1");
    const created = authService.createMyVehicle(student.id, {
      plate: "  59-md2   888.99  ",
      type: "E_MOTORBIKE",
      connectorType: "TYPE_2",
    });
    expect(created.plate).toBe("59-MD2 888.99");
    expect(created.ownerId).toBe(student.id);

    const list = authService.getMyVehicles(student.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(created.id);

    const deleted = authService.deleteMyVehicle(student.id, created.id);
    expect(deleted).toEqual({ deleted: true, id: created.id });
    expect(authService.getMyVehicles(student.id)).toHaveLength(0);
  });

  it("TC-AUTH-07: từ chối đăng ký hoặc cập nhật trùng biển số xe (CONFLICT)", async () => {
    const student1 = await authService.register("pv1@hub.local", "secret123", "Chủ xe 1");
    const student2 = await authService.register("pv2@hub.local", "secret123", "Chủ xe 2");

    authService.createMyVehicle(student1.id, {
      plate: "59-MD1 123.45",
      type: "E_MOTORBIKE",
      connectorType: "TYPE_2",
    });

    expectErrorCode(
      () =>
        authService.createMyVehicle(student2.id, {
          plate: "  59-md1   123.45 ",
          type: "E_BIKE",
          connectorType: "STANDARD_PLUG",
        }),
      "CONFLICT",
    );

    const v2 = authService.createMyVehicle(student2.id, {
      plate: "59-EA1 678.90",
      type: "E_BIKE",
      connectorType: "STANDARD_PLUG",
    });

    expectErrorCode(
      () =>
        authService.updateMyVehicle(student2.id, v2.id, {
          plate: "59-md1 123.45",
          type: "E_BIKE",
          connectorType: "STANDARD_PLUG",
        }),
      "CONFLICT",
    );
  });

  it("TC-AUTH-08: cập nhật xe cá nhân thành công và chặn sinh viên khác thao tác (NOT_FOUND)", async () => {
    const owner = await authService.register("owner@hub.local", "secret123", "Chủ xe");
    const stranger = await authService.register("stranger@hub.local", "secret123", "Người lạ");

    const vehicle = authService.createMyVehicle(owner.id, {
      plate: "59-KA1 111.22",
      type: "E_BIKE",
      connectorType: "STANDARD_PLUG",
    });

    const updated = authService.updateMyVehicle(owner.id, vehicle.id, {
      plate: "59-ka1 111.22",
      type: "E_MOTORBIKE",
      connectorType: "TYPE_2",
    });
    expect(updated.plate).toBe("59-KA1 111.22");
    expect(updated.type).toBe("E_MOTORBIKE");
    expect(updated.connectorType).toBe("TYPE_2");

    expectErrorCode(
      () =>
        authService.updateMyVehicle(stranger.id, vehicle.id, {
          plate: "59-ZZ9 999.99",
          type: "E_BIKE",
          connectorType: "STANDARD_PLUG",
        }),
      "NOT_FOUND",
    );
    expectErrorCode(() => authService.deleteMyVehicle(stranger.id, vehicle.id), "NOT_FOUND");
  });

  it("TC-AUTH-09: chặn đổi chuẩn đầu cắm hoặc xóa xe khi đang có đặt chỗ đỗ / lịch sạc (CONFLICT)", () => {
    const fx = seedBasicFixtures();
    const port = db.select().from(chargingPorts).where(eq(chargingPorts.slotId, fx.chargerSlotId)).get()!;
    const futureStart = new Date(Date.now() + 30 * 60_000);
    const futureEnd = new Date(Date.now() + 90 * 60_000);

    // 1. Có chỗ đỗ đang hiệu lực -> chặn xóa xe
    const parking = db
      .insert(parkingAllocations)
      .values({
        studentId: fx.student1Id,
        slotId: fx.regularSlotId,
        vehicleRef: fx.privateVehicle1Id,
        startTime: futureStart,
        endTime: futureEnd,
        status: "CONFIRMED",
      })
      .returning()
      .get();

    expectErrorCode(() => authService.deleteMyVehicle(fx.student1Id, fx.privateVehicle1Id), "CONFLICT");

    db.update(parkingAllocations)
      .set({ status: "CANCELLED" })
      .where(eq(parkingAllocations.id, parking.id))
      .run();

    // 2. Có yêu cầu sạc WAITING -> chặn đổi connectorType và chặn xóa xe
    const req = db
      .insert(chargingRequests)
      .values({
        studentId: fx.student1Id,
        vehicleId: fx.privateVehicle1Id,
        hubId: fx.hubId,
        currentBattery: 20,
        targetBattery: 80,
        status: "WAITING",
      })
      .returning()
      .get();

    expectErrorCode(
      () =>
        authService.updateMyVehicle(fx.student1Id, fx.privateVehicle1Id, {
          plate: "59-MD1 123.45",
          type: "E_MOTORBIKE",
          connectorType: "STANDARD_PLUG",
        }),
      "CONFLICT",
    );
    expectErrorCode(() => authService.deleteMyVehicle(fx.student1Id, fx.privateVehicle1Id), "CONFLICT");

    db.update(chargingRequests)
      .set({ status: "CANCELLED" })
      .where(eq(chargingRequests.id, req.id))
      .run();

    // 3. Có lịch sạc CONFIRMED còn hiệu lực -> chặn đổi connectorType nhưng vẫn cho sửa biển số, chặn xóa xe
    const reservation = db
      .insert(chargingReservations)
      .values({
        studentId: fx.student1Id,
        privateVehicleId: fx.privateVehicle1Id,
        portId: port.id,
        startTime: futureStart,
        endTime: futureEnd,
        currentBattery: 30,
        targetBattery: 90,
        status: "CONFIRMED",
      })
      .returning()
      .get();

    expectErrorCode(
      () =>
        authService.updateMyVehicle(fx.student1Id, fx.privateVehicle1Id, {
          plate: "59-MD1 123.45",
          type: "E_MOTORBIKE",
          connectorType: "STANDARD_PLUG",
        }),
      "CONFLICT",
    );

    const sameConnectorUpdate = authService.updateMyVehicle(fx.student1Id, fx.privateVehicle1Id, {
      plate: "59-MD1 123.99",
      type: "E_MOTORBIKE",
      connectorType: "TYPE_2",
    });
    expect(sameConnectorUpdate.plate).toBe("59-MD1 123.99");

    expectErrorCode(() => authService.deleteMyVehicle(fx.student1Id, fx.privateVehicle1Id), "CONFLICT");

    // 4. Khi lịch sạc đã hủy (còn lịch sử FK) -> cho phép đổi connectorType nhưng vẫn chặn xóa xe
    db.update(chargingReservations)
      .set({ status: "CANCELLED" })
      .where(eq(chargingReservations.id, reservation.id))
      .run();

    const changedConnector = authService.updateMyVehicle(fx.student1Id, fx.privateVehicle1Id, {
      plate: "59-MD1 123.99",
      type: "E_MOTORBIKE",
      connectorType: "STANDARD_PLUG",
    });
    expect(changedConnector.connectorType).toBe("STANDARD_PLUG");

    expectErrorCode(() => authService.deleteMyVehicle(fx.student1Id, fx.privateVehicle1Id), "CONFLICT");
  });
});
