// Owner: Lê Quốc Linh (UC02–UC04, 2.3.2), Bùi Quang Nhân (UC05) – test
import { describe, it } from "vitest";

describe("UC02 Reserve Shared Vehicle", () => {
  it.todo("hai sinh viên đặt cùng một xe cùng lúc → chỉ một người thành công (tranh chấp tài nguyên)");
  it.todo("gửi lặp cùng requestId → trả lại đặt xe cũ, không tạo thêm");
  it.todo("sinh viên đã có đặt xe còn hiệu lực → không được đặt thêm");
  it.todo("xe pin dưới reservableBatteryThreshold → không hiển thị để đặt");
});

describe("UC03 Cancel Vehicle Reservation", () => {
  it.todo("hủy đặt xe của người khác → FORBIDDEN/NOT_FOUND");
  it.todo("hủy xong xe trở về AVAILABLE");
});

describe("2.3.2 Tự động giải phóng xe khi quá hạn nhận", () => {
  it.todo("quá pickupDeadline → EXPIRED và xe AVAILABLE");
  it.todo("đặt xe đã chuyển HANDING_OVER thì không bị hết hạn");
});

describe("UC04/UC05 Pick Up & Return", () => {
  it.todo("thiết bị trả UNKNOWN khi mở khóa → PENDING_VERIFICATION");
  it.todo("trả xe khi Hub hết chỗ → báo lỗi, chuyến đi vẫn ACTIVE");
});
