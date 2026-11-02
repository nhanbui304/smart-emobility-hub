// Owner: Bùi Quang Nhân – test UC06, 2.3.1
import { describe, it } from "vitest";

describe("UC06 Reserve Parking Space", () => {
  it.todo("hai sinh viên giữ cùng vị trí, khung giờ chồng lấn → chỉ một người thành công");
  it.todo("khung giờ không chồng lấn trên cùng vị trí → cả hai thành công");
  it.todo("xác nhận giữ tạm đã hết hạn → báo lỗi");
  it.todo("gửi lặp xác nhận cùng requestId → không tạo thêm bản ghi");
});

describe("2.3.1 Giữ chỗ đỗ tạm thời và tự động giải phóng", () => {
  it.todo("HELD quá holdExpiresAt → EXPIRED, vị trí trống lại");
  it.todo("CONFIRMED không bị scheduler hết hạn");
});
