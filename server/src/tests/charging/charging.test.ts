// Owner: Ngô Minh Triết (UC07, UC08), Nguyễn Hoàng Nhân (UC09) – test
import { describe, it } from "vitest";

describe("UC07 Submit Charging Request", () => {
  it.todo("còn cổng trống → ALLOCATED");
  it.todo("hết cổng → WAITING, pin thấp được ưu tiên trong hàng đợi");
});

describe("UC08 Schedule Charging Session", () => {
  it.todo("hai lịch cùng cổng, khung giờ chồng lấn → chỉ một lịch được tạo");
});

describe("UC09 Manage Scheduled Charging Session", () => {
  it.todo("đổi lịch với expectedVersion cũ → VERSION_CONFLICT");
  it.todo("hủy lịch của người khác → FORBIDDEN/NOT_FOUND");
  it.todo("đổi lịch sang khung giờ chồng lấn với chính lịch cũ vẫn hợp lệ");
});
