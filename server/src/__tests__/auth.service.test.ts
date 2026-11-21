import { beforeEach, describe, expect, it } from "vitest";
import { authService } from "../services/AuthService";
import { resetTestData } from "./testHelpers";

describe("AuthService (TC-AUTH-01..05)", () => {
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
});
