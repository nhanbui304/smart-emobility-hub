// Owner: Nguyễn Hoàng Nhân (2.3.3, UC13, UC14), Ngô Minh Triết (UC11), Lê Quốc Linh (UC12) – test
import { describe, it } from "vitest";

describe("2.3.3 Cảnh báo Hub", () => {
  it.todo("số xe khả dụng <= lowVehicleThreshold → tạo cảnh báo LOW_VEHICLE, không tạo trùng");
  it.todo("hết vượt ngưỡng → cảnh báo được đóng");
});

describe("UC11 Handle Operational Incident", () => {
  it.todo("báo sự cố cổng sạc → cổng OUT_OF_SERVICE, lịch bị ảnh hưởng được liệt kê");
});

describe("UC12 Coordinate Vehicle Redistribution", () => {
  it.todo("xe không còn AVAILABLE tại Hub nguồn → không tạo được lệnh");
});

describe("UC13 Manage Smart Charging Schedule", () => {
  it.todo("áp dụng lịch với baseVersion cũ → VERSION_CONFLICT");
});

describe("UC14 Run What-if Simulation", () => {
  it.todo("chạy mô phỏng không làm thay đổi bất kỳ bảng vận hành nào");
});
