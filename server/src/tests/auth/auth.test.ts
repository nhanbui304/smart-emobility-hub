// Owner: Bùi Quang Nhân – test Register / Sign In / phân quyền
import { describe, it } from "vitest";

describe("Auth", () => {
  it.todo("đăng ký email đã tồn tại → CONFLICT");
  it.todo("đăng ký luôn tạo vai trò STUDENT, không nhận role từ body");
  it.todo("mật khẩu lưu dạng hash, không lưu bản rõ");
  it.todo("đăng nhập sai mật khẩu → UNAUTHORIZED, không tiết lộ email có tồn tại");
  it.todo("Student gọi API của Operator → FORBIDDEN");
  it.todo("gọi API khi không có token → UNAUTHORIZED");
});
