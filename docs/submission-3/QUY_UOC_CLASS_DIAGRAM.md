# Quy ước vẽ Class Diagram – Submission #3

Mẫu đã vẽ sẵn: `class-diagram-template.drawio` (UC02 – Đặt xe). Mở bằng [app.diagrams.net](https://app.diagrams.net) hoặc extension Draw.io trong VS Code, copy các hộp sang file của mình rồi sửa.

## 1. File và hạn

| Người | File | Subsystem |
| --- | --- | --- |
| Linh | `linh/class-xe-dung-chung.drawio` | UC02, UC03, UC04, UC12, View Hub Status, View My Reservations |
| Quang Nhân | `quangnhan/class-tai-khoan-do-xe.drawio` + `class-tong-the.drawio` | Register, Sign In/Out, Customize Interface, UC05, UC06, Cancel Parking |
| Hoàng Nhân | `hoangnhan/class-van-hanh.drawio` | UC09, UC10, UC13, UC14 |
| Triết | `triet/class-sac-su-co.drawio` | UC01, UC07, Cancel Charging, UC08, UC11 |

- Mỗi người một thư mục riêng trong `docs/submission-3/` (ví dụ `docs/submission-3/linh/`), để cả sơ đồ, ảnh PNG, mô tả method và test case của mình. Xem mẫu ở thư mục `quangnhan/`. Commit theo nhánh `docs/<tên>-class-diagram`.
- Xuất thêm PNG (File → Export as → PNG, scale 200%) để chèn vào báo cáo.
- Bản nháp gửi group ngày **9/11**, bản xong **23:59 ngày 11/11**.

## 2. Các lớp trong mỗi subsystem

Vẽ theo đúng tầng của code: **View → Controller → Service → Repository**, cộng **Entity** và **Enum**.

| Loại | Stereotype | Màu draw.io (fill / viền) | Tên | Lấy từ đâu trong code |
| --- | --- | --- | --- | --- |
| View (màn hình) | `«boundary»` | `#dae8fc` / `#6c8ebf` | `<Tên>View`, ví dụ `ReserveVehicleView` | `client/src/pages/` |
| Controller | `«control»` | `#fff2cc` / `#d6b656` | `<Nhóm>Controller` | `server/src/controllers/` |
| Service | `«control»` | `#ffe6cc` / `#d79b00` | `<Nhóm>Service` | `server/src/services/` |
| Repository | `«repository»` | `#e1d5e7` / `#9673a6` | `<Nhóm>Repository` | `server/src/repositories/` |
| Entity | `«entity»` | `#d5e8d4` / `#82b366` | Danh từ số ít, ví dụ `VehicleReservation` | `server/src/db/schema.ts` |
| Enum | `«enumeration»` | `#f5f5f5` / `#666666` | Như trong code, ví dụ `VehicleStatus` | `server/src/constants.ts` |
| Kiểu dữ liệu (tham số/kết quả gom nhiều trường) | `«datatype»` | `#ffffff` / `#666666` | Như trong code, ví dụ `TimeRange` | `interface` trong service / `lib/schemas.ts` |

View class là **màn hình**, không phải controller (thầy đã trả lời trên forum).

## 3. Cách ghi thuộc tính và method

- Thuộc tính: `- tên: Kiểu` – ví dụ `- batteryLevel: int`
- Method: `+ tên(thamSố: Kiểu, ...): KiểuTrảVề` – ví dụ `+ confirmReservation(studentId: String, hubId: String, vehicleId: String): VehicleReservation`
- Kiểu dữ liệu dùng chung: `String`, `int`, `double`, `boolean`, `DateTime`, `void`, `Kiểu[]` cho danh sách. Không dùng `number`, `Date`, `Promise` của TypeScript.
- Tên method **giữ đúng như trong code** (đã khớp sequence Submission #2). Muốn đổi tên thì báo nhóm để sửa code luôn.
- Controller **không** có tham số `studentId` (lấy từ phiên đăng nhập); Service thì có.
- Giá trị có thể rỗng ghi `[0..1]`, ví dụ `- endedAt: DateTime [0..1]`, `+ findById(id: String): User [0..1]`.
- Chỉ vẽ method có thật trong code (Entity thường không có method). Không vẽ: getter/setter, constructor, `req`/`res`, hàm tiện ích nội bộ.

## 4. Quan hệ

| Quan hệ | Ký hiệu | Dùng cho |
| --- | --- | --- |
| Phụ thuộc | Mũi tên **nét đứt** | View → Controller, Entity → Enum |
| Kết hợp (giữ tham chiếu) | Mũi tên **nét liền** | Controller → Service → Repository |
| Quan hệ giữa Entity | Đường thẳng có số ở 2 đầu (`1`, `0..*`) | `Student 1 — 0..* VehicleReservation` |

Không vẽ mũi tên Repository → Entity cho đỡ rối (ghi chú trong sơ đồ là được).

## 5. Enum dùng chung (không tự đặt tên mới)

Lấy đúng từ `server/src/constants.ts`:

| Enum | Giá trị |
| --- | --- |
| `Role` | STUDENT, OPERATOR |
| `VehicleStatus` | AVAILABLE, RESERVED, HANDING_OVER, IN_USE, PENDING_VERIFICATION, UNDER_MAINTENANCE, CHARGING, IN_TRANSIT |
| `VehicleType` | E_BIKE, E_MOTORBIKE |
| `VehicleReservationStatus` | RESERVED, HANDING_OVER, PENDING_VERIFICATION, USED, CANCELLED, EXPIRED |
| `TripStatus` | ACTIVE, RETURN_IN_PROGRESS, PENDING_RECONCILIATION, ENDED |
| `ParkingAllocationStatus` | HELD, CONFIRMED, IN_USE, USED, CANCELLED, EXPIRED |
| `SlotStatus` | IN_SERVICE, OUT_OF_SERVICE |
| `ChargingPortStatus` | AVAILABLE, IN_USE, OUT_OF_SERVICE |
| `ChargingRequestStatus` | ALLOCATED, WAITING, CHARGING, COMPLETED, CANCELLED |
| `ChargingReservationStatus` | CONFIRMED, CHARGING, AWAITING_DISCONNECT, COMPLETED, CANCELLED, EXPIRED |
| `IncidentStatus` | OPEN, IN_PROGRESS, RESOLVED |
| `RedistributionStatus` | CREATED, IN_PROGRESS, COMPLETED, CANCELLED, PARTIALLY_COMPLETED |
| `SimulationRunStatus` | RUNNING, COMPLETED, FAILED, CANCELLED |
| `AlertType` | LOW_VEHICLE, NEAR_FULL, RESOURCE_FAULT, DATA_STALE |
| `RequestOperation` | CONFIRM_CHARGING_RESERVATION, RESCHEDULE_CHARGING_RESERVATION, CANCEL_CHARGING_RESERVATION, APPLY_CHARGING_PLAN, START_SIMULATION_RUN |

Cần trạng thái mới thì báo Quang Nhân để thêm vào `constants.ts` và bảng này.

## 6. Class dùng chung giữa hai người

- `ChargingReservation`: Triết vẽ phần tạo lịch (UC08), Hoàng Nhân vẽ phần đổi/hủy (UC09). Thuộc tính lấy theo `schema.ts`: `id`, `studentId`, `privateVehicleId`, `portId`, `startTime`, `endTime`, `currentBattery [0..1]`, `targetBattery [0..1]`, `status`, `version`.
- `ProcessedRequest` (chống gửi lặp bằng `requestId`): dùng chung cho UC08, UC09, UC13, UC14; Hoàng Nhân vẽ hộp đầy đủ, Triết chỉ cần ghi chú.
- Các thay đổi so với Sequence Submission #2 xem `ANH_XA_SEQUENCE_CODE.md`. Hai người chốt với nhau trước **8/11**.
- `Hub`, `Student`, `SharedVehicle`: subsystem nào cần thì vẽ lại hộp, chỉ cần thuộc tính liên quan.

## 7. Sơ đồ tổng thể (Quang Nhân)

Chỉ vẽ **Entity + Service + Enum** của cả hệ thống, không có View/Controller/Repository, để thấy toàn bộ dữ liệu và chức năng trên một trang.
