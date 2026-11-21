# Software Requirements Specification (SRS)

> **Dự án:** Smart E-Mobility Hub — Hệ thống điều phối xe điện dùng chung, chỗ đỗ và trạm sạc trong Khu đô thị ĐHQG-HCM
> **Tài liệu gốc:** Phần I & Phần II trong [L03_17.pdf](L03_17.pdf)

---

## 1. Bối cảnh & Phạm vi

Smart E-Mobility Hub kết nối **5 Mobility Hub** trong Khu đô thị ĐHQG-HCM (Ga Metro ĐHQG, KTX Khu B, Trường ĐH Bách Khoa, Trường ĐH KHTN, Thư viện Trung tâm), giúp:
- **Sinh viên (Student):** tìm phương tiện/chỗ đỗ/cổng sạc phù hợp, đặt–nhận–trả xe điện dùng chung, đặt chỗ đỗ và đặt/đổi lịch sạc cho xe điện cá nhân.
- **Nhân viên vận hành (Operator):** giám sát trạng thái mạng lưới thời gian thực, xử lý sự cố thiết bị, điều chuyển xe giữa các Hub, tối ưu lịch sạc thông minh và mô phỏng tình huống What-if trên dữ liệu chụp độc lập.

## 2. Tác nhân (Actors)

| Tác nhân | Vai trò hệ thống (`role`) | Quyền chính |
| --- | --- | --- |
| **Student** | `STUDENT` | Đăng ký/đăng nhập, đổi giao diện sáng/tối, thực hiện UC01–UC09, xem trạng thái Hub và danh sách lượt đặt của bản thân. |
| **Operator** | `OPERATOR` | Đăng nhập, đổi giao diện, thực hiện UC10–UC14, nhận cảnh báo theo ngưỡng và điều phối tài nguyên toàn mạng lưới. |
| **System Scheduler / Vehicle Simulator** | Tác vụ nền | Tự động giải phóng lượt giữ/đặt quá hạn (2.3.1, 2.3.2), cập nhật cảnh báo Hub (2.3.3), giả lập thiết bị xe & cảm biến mỗi giây. |

## 3. Yêu cầu chức năng (Functional Requirements)

- **Nhóm Xác thực & Hệ thống:** Register Student Account, Sign In / Sign Out, Customize Interface Mode, View Hub and Resource Status, View My Reservations.
- **Luồng Sinh viên (UC01–UC09):**
  - `UC01` Find Suitable Mobility Option · `UC02` Reserve Shared Vehicle · `UC03` Cancel Vehicle Reservation · `UC04` Pick Up Shared Vehicle · `UC05` Return Shared Vehicle · `UC06` Reserve Parking Space (+ Cancel Parking Reservation) · `UC07` Request Immediate Charging (+ Cancel Charging Request) · `UC08` Reserve Charging Slot · `UC09` View / Reschedule / Cancel Charging Reservation.
- **Luồng Nhân viên vận hành (UC10–UC14):**
  - `UC10` Monitor Hub & Network Status · `UC11` Record & Handle Resource Incident · `UC12` Redistribute Shared Vehicles · `UC13` Manage & Apply Smart Charging Schedule · `UC14` Run What-if Operational Simulation.
- **Tác vụ nền phi tương tác (Mục 2.3):**
  - `FR-2.3.1` Tự động giải phóng lượt giữ chỗ đỗ quá hạn (`HoldExpiryScheduler`).
  - `FR-2.3.2` Tự động giải phóng lượt đặt xe quá hạn nhận (`ReservationExpiryScheduler`).
  - `FR-2.3.3` Tự động đánh giá và kích hoạt/tắt cảnh báo Hub theo ngưỡng (`HubAlertScheduler`).

## 4. Yêu cầu phi chức năng (Non-Functional Requirements)

| Nhóm NFR | Yêu cầu cụ thể | Hiện thực trong codebase |
| --- | --- | --- |
| **Hiệu năng & Đồng bộ** | Làm mới dữ liệu Hub và cảnh báo trên giao diện mỗi **3 giây**. | Client polling qua `useAsync` và simulator cập nhật xe mỗi giây. Scheduler đánh giá cảnh báo mỗi **15 giây**, sau đó client nhận cập nhật ở lượt polling kế tiếp. |
| **Tính toàn vẹn & Đồng thời** | Chống cấp trùng xe/chỗ đỗ/cổng sạc; chống gửi lặp khi mất mạng; tách biệt dữ liệu mô phỏng. | Bọc thao tác ghi trong `db.transaction(...)` (SQLite WAL + `foreign_keys = ON`), bảng `processed_requests` (idempotency `requestId`), optimistic locking `version` (UC09, UC11, UC13), snapshot độc lập (`simulation_snapshots`, UC14). |
| **Bảo mật & Phân quyền** | Mật khẩu băm an toàn; kiểm soát quyền theo vai trò ở backend; không tin `userId` từ client. | `bcryptjs` hash mật khẩu; `express-session` (`httpOnly`, `sameSite: "lax"`); middleware `requireAuth`, `requireRole`; xác thực dữ liệu vào bằng `zod`; kiểm tra quyền sở hữu bản ghi trong Service. |
| **Khả dụng & Giao diện** | Hỗ trợ Mobile (Student) & Desktop (Operator), Sáng/Tối, trạng thái rõ ràng không chỉ dựa vào màu sắc. | Responsive layout (`StudentLayout`, `OperatorLayout`), `ThemeContext`, `<StatusBadge>`, bản đồ thực tế ĐHQG-HCM (`Leaflet + OpenStreetMap`). |

## 5. Ma trận truy vết yêu cầu (Requirements Traceability Matrix — RTM)

| Mã UC / FR | API Route (`server/src/routes/`) | Controller & Service (`server/src/`) | Trang UI (`client/src/pages/`) | Test Case chính |
| --- | --- | --- | --- | --- |
| **Auth & Theme** | `/api/auth/*` (`authRoutes.ts`) | `AuthController` → `AuthService` | `auth/LoginPage`, `auth/RegisterPage`, `SettingsPage` | `TC-AUTH-01..05` (Vitest) |
| **View Hub Status** | `/api/hubs/*` (`hubRoutes.ts`) | `HubController` → `HubService` | `student/HomePage` | `TC-HUB-01..02` |
| **My Reservations** | `/api/me/*` (`myReservationsRoutes.ts`) | `MyReservationsController` → `MyReservationsService` | `student/MyReservationsPage` | `TC-MYRES-01` |
| **UC01** | `/api/search/*` (`searchRoutes.ts`) | `SearchController` → `SearchService` | `student/HomePage` | `TC-UC01-01..04` |
| **UC02** | `/api/vehicle-reservations/*` (`reservationRoutes.ts`) | `ReservationController` → `ReservationService` | `student/ReserveVehiclePage` | `TC-UC02-01..03` (Vitest), `TC-UC02-04..05` (kiểm thử thủ công) |
| **UC03** | `/api/vehicle-reservations/:reservationId/cancel*` (`reservationRoutes.ts`) | `ReservationController` → `ReservationService` | `student/ActiveTripPage` | `TC-UC03-01..02` (Vitest), `TC-UC03-03..04` (kiểm thử thủ công) |
| **UC04** | `/api/trips/pickup*` (`tripRoutes.ts`) | `PickUpController` → `PickUpService` | `student/ActiveTripPage` | `TC-UC04-01..04` |
| **UC05** | `/api/trips/:tripId/return*` (`tripRoutes.ts`) | `ReturnController` → `ReturnService` | `student/ActiveTripPage` | `TC-UC05-01..05` |
| **UC06 & 2.3.1** | `/api/parking/*` (`parkingRoutes.ts`) | `ParkingController` → `ParkingService` + `HoldExpiryScheduler` | `student/MyVehiclePage` | `TC-UC06-01..04`, `TC-2.3.1-01` (Vitest) |
| **UC07** | `/api/charging-requests/*` (`chargingRequestRoutes.ts`) | `ChargingRequestController` → `ChargingRequestService` | `student/ChargingRequestPage` | `TC-UC07-01..04` |
| **UC08** | `/api/charging-reservations/*` (`chargingReservationRoutes.ts`) | `ChargingReservationController` → `ChargingReservationService` | `student/MyVehiclePage` | `TC-UC08-01..04` |
| **UC09** | `/api/charging-reservations/:reservationId` và các route con (`chargingReservationRoutes.ts`) | `ChargingReservationController` → `ChargingReservationService` | `student/MyVehiclePage` | `TC-UC09-01..04` |
| **UC10 & 2.3.3** | `/api/monitoring/*` (`monitoringRoutes.ts`) | `MonitoringController` → `MonitoringService` + `HubAlertScheduler` | `operator/MonitoringPage` | `TC-UC10-01..04`, `TC-2.3.3-01` |
| **UC11** | `/api/incidents/*` (`incidentRoutes.ts`) | `IncidentController` → `IncidentService` | `operator/ChargingIncidentPage` | `TC-UC11-01..04` |
| **UC12** | `/api/redistribution-orders/*` (`redistributionRoutes.ts`) | `RedistributionController` → `RedistributionService` | `operator/RedistributionPage` | `TC-UC12-01..04` |
| **UC13** | `/api/charging-schedules/*` (`chargingScheduleRoutes.ts`) | `ChargingScheduleController` → `SmartChargingService` | `operator/ChargingIncidentPage` | `TC-UC13-01..04` |
| **UC14** | `/api/simulations/*` (`simulationRoutes.ts`) | `SimulationController` → `SimulationService` + `SimulationEngine` | `operator/SimulationPage` | `TC-UC14-01..04` |
| **FR-2.3.2** | Scheduler nền | `ReservationExpiryScheduler` → `ReservationRepository` | — | `TC-2.3.2-01` |
