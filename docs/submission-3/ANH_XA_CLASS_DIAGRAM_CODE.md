# Ánh xạ class diagram Submission #3 → code

Ngày 18/11 khung code đã được sửa để khớp class diagram đã nộp ở Submission #3 (các file `.drawio` trong `docs/`, bỏ qua `class-diagram-template.drawio`). Thân các method vẫn là `notImplemented`; người phụ trách tự viết logic.

## 1. Quy ước khớp sơ đồ

| Sơ đồ | Code |
| --- | --- |
| Class «control» `XxxService` | `server/src/services/XxxService.ts`, đối tượng `xxxService` |
| Method public (`+`) của Service | Method của `xxxService`, `async`, trả `Promise<KiểuTrongSơĐồ>` (trừ `ParkingService.expireDueHolds` chạy đồng bộ cho scheduler) |
| Method private (`–`) của Service | `function` ở cuối file Service (không export) |
| Class «control» `XxxController` | `server/src/controllers/XxxController.ts`; mỗi method là một handler Express cùng tên. Tham số trong sơ đồ được đọc từ đường dẫn, query (GET) hoặc body (POST) |
| Class «repository» | `server/src/repositories/XxxRepository.ts`, method đồng bộ (better-sqlite3) |
| «repository» `OperationalRepository` | Một đối tượng `operationalRepository` (`repositories/OperationalRepository.ts`) gộp từ các file trong `repositories/operational/` |
| «entity» | Bảng trong `server/src/db/schema.ts`, kiểu suy ra từ bảng (`User`, `Trip`...) |
| «datatype» | Interface trong `server/src/types/dto.ts`, bản sao trong `client/src/types.ts` |
| «enumeration» | Mảng + kiểu trong `server/src/constants.ts` (ví dụ `INCIDENT_IMPACTS` / `IncidentImpact`) |
| `DateTime` | `Date` ở server; chuỗi ISO ở client |
| `X [0..1]` | Tham số/thuộc tính tùy chọn (`?`) hoặc `X \| undefined` |
| `requestId` + `ProcessedRequest` | Client sinh `requestId`; server ghi bảng `processed_requests` (enum `RequestOperation` đủ 16 giá trị) |
| Hàm gọi API phía client | `client/src/api/<tên>.ts`, mỗi file ứng với một Controller, tên hàm và tham số giống method của Controller |

## 2. File con của OperationalRepository

| File | Người phụ trách | Method |
| --- | --- | --- |
| `operational/common.ts` | Cả nhóm | `findProcessedRequest` |
| `operational/parkingOps.ts` | Bùi Quang Nhân (UC06, 2.3.1) | `findVehicleRight` (UC08 dùng chung), `queryHubAcceptance`, `queryAvailableSlots`, `atomicCheckAndHold`, `atomicConfirmHold`, `atomicReleaseHold`, `findActiveHold`, `atomicExpireHolds`, `atomicCancelBooking` |
| `operational/returnOps.ts` | Bùi Quang Nhân (UC05) | `findTripForReturn` … `releaseNewReturnAllocation` |
| `operational/chargingRequestOps.ts` | Ngô Minh Triết (UC07) | `findVehicleChargingRight` … `atomicCancelChargingRequest` |
| `operational/chargingReservationOps.ts` | Ngô Minh Triết (UC08) | `queryHubChargingSupport`, `findConflictingRequestsOrSchedules`, `queryAvailableChargingSlots` (UC09 dùng chung), `findSlotOption`, `atomicCreateReservation` |
| `operational/rescheduleOps.ts` | Nguyễn Hoàng Nhân (UC09) | `findReservation`, `atomicReschedule`, `atomicCancelReservation` |
| `operational/chargingScheduleOps.ts` | Nguyễn Hoàng Nhân (UC13) | `queryChargingContext`, `atomicApplyChargingSchedule`, `markNotificationPending` |
| `operational/incidentOps.ts` | Ngô Minh Triết (UC11) | `queryResourceStatusAndOpenIncidents` … `closeIncidentAndRestoreService` |
| `operational/simulationOps.ts` | Nguyễn Hoàng Nhân (UC14) | `readOperationalState` |

Lý do tách: `OperationalRepository` có 51 method của 4 người; để chung một file thì dễ xung đột khi merge.

## 3. Chỗ code khác sơ đồ (có thể ghi vào báo cáo cuối)

| Sơ đồ | Code | Lý do |
| --- | --- | --- |
| `OperationalRepository` là một class | Một đối tượng gộp từ 9 file con | Mỗi người sửa file của mình |
| `HubDetail` có thuộc tính `hub: HubStatus` (sơ đồ Xe dùng chung) | `HubDetail extends HubStatus` (như sơ đồ UC10) | Hai sơ đồ vẽ khác nhau; giữ cách đã chạy ở trang Hub |
| `OperatorHubDetail` | `extends HubDetail` | Như sơ đồ UC10 |
| `RedistributionController.getRedistributionOptions(sourceHubId, targetHubId, eta)` gọi Service có thêm `vehicleIds` | Controller truyền `[]` (xét mọi xe ở Hub nguồn) | Sơ đồ Controller không có `vehicleIds` |
| `ReservationController.getMyReservations()` | Gọi `myReservationsService.getMyReservations` rồi lấy `vehicleReservations` | `ReservationService` không có method này |
| `SimulationController.prepareOperationalHandoff(recommendationId)` | Controller gọi `SimulationService.prepareOperationalHandoff` | Tuân thủ luồng Controller → Service → Repository |
| `applyChargingSchedule`, `atomicApplyChargingSchedule` | Nhận thêm `operatorId` từ phiên đăng nhập. `PlanAllocation.demandId` có ở dòng phân bổ cho nhu cầu sạc. | Kiểm tra và ghi nhận gửi lặp theo Operator, ghép đúng nhu cầu với cổng khi bản nháp có cả cam kết hiện có |
| `SimulationController.publishRunFinished(runId)` | Method không có route | Không dùng WebSocket; giao diện gọi lại `getRunResult` mỗi 3 giây |
| `VehicleSimulator` có `requestUnlock`, `readVehiclePosition`, `sendLockCommand` | Thêm `start`, `tick` | Phần chạy nền của bộ giả lập, không thuộc nghiệp vụ |
| Entity `SimulationSnapshot.snapshotId`, `SimulationRun.runId`, `ChargingScheduleVersion.scheduleVersionId` | Cột `id` | Mọi bảng dùng khóa `id` |
| Entity có `createdAt` ở vài lớp | Mọi bảng có `createdAt`, `updatedAt` | Cột kỹ thuật |

## 4. Phần thêm ngoài sơ đồ (cần cho giao diện)

| Thêm | Người thêm | Lý do |
| --- | --- | --- |
| `GET /api/auth/me/vehicles` (`AuthController.myVehicles` → `AuthService.getMyVehicles` → `UserRepository.findPrivateVehicles`) | Quang Nhân | Giao diện cần danh sách xe cá nhân để sinh viên chọn khi đặt chỗ đỗ (UC06). UC08 dùng lại được (`authApi.myVehicles()`) |
| `GET /api/trips/current` (`ReturnController.getCurrentTrip` → `ReturnService.getCurrentTrip`, kiểu `CurrentTripInfo`) | Quang Nhân | Trang Chuyến đi cần biết chuyến đi đang diễn ra sau khi tải lại trang. UC04 dùng lại được (`returnApi.getCurrentTrip()`) |
| `client/src/api/requestId.ts` – `newRequestId()` | Quang Nhân | `crypto.randomUUID()` không có khi mở app bằng IP máy tính trên điện thoại (http). Mọi người dùng `newRequestId()` để sinh `requestId` |

Ghi chú hiện thực UC05, UC06:

- `atomicCheckAndHold` trong sơ đồ có 5 tham số bắt buộc; code nhận thêm tham số tùy chọn cuối `vehicleId?: string` để lưu đúng xe đã chọn khi sinh viên có nhiều hơn một xe cá nhân.
- Vị trí có cổng sạc dành cho UC07, UC08 nên không được dùng để đặt chỗ đỗ (UC06) hay phân bổ khi trả xe (UC05).
- Phân bổ chỗ cho lượt trả xe có trạng thái `IN_USE` (không hết hạn theo giờ); trả xong chuyển `USED`, dừng trả xe chuyển `CANCELLED`.
- Hàm hỗ trợ dùng chung trong `repositories/operational/common.ts`: `previousResultId`, `recordProcessedRequest` (chống gửi lặp trong transaction).

## 5. Thay đổi so với khung code cũ (trước 18/11)

- Đổi tên repository: `SearchRepository` → `MobilityRepository`; `ParkingRepository`, `ReturnRepository`, `ChargingRequestRepository`, `ChargingReservationRepository`, `ChargingPlanRepository`, `IncidentRepository` → gộp vào `OperationalRepository`.
- Đổi tên method Controller theo sơ đồ (ví dụ `hold` → `holdSlot`, `start` → `runSimulation`) và thêm method còn thiếu (`getActiveHold`, `closeOrder`, `prepareChargingRequest`, cụm hủy đặt xe UC03...).
- Mọi thao tác ghi nhận thêm `requestId`.
- Enum: `IncidentStatus` dùng `CLOSED` (thay `RESOLVED`); `ImpactLevel` → `IncidentImpact`; `ChargingRequestStatus` thêm `EXPIRED`; thêm `ScenarioType`, `VehicleTechStatus`, `DeviceCommandResult`; `RequestOperation` đủ 16 giá trị.
- Bảng: `charging_requests` (`vehicleId`, `assignedPortId`, `currentBattery`, `allocationDeadline`), `incidents` (thêm `affectedScope`, `reportedBy`, `priorityHandling`, `consentPlan`, `notificationPending`, `resolutionNote`, `resolvedAt`), `alerts` (thêm `evaluationWindow`), `charging_plans` → `charging_schedule_versions`, `simulation_snapshots` (`timeRange`, `operationalState`), `simulation_runs` (bỏ `operatorId`, `dataLimitation`).
- Client: `vehicleApi`, `parkingApi`, `chargingApi`, `operationsApi` được thay bằng một file API cho mỗi Controller (`reservationApi`, `parkingApi`, `simulationApi`...).

**Sau khi pull:** chạy `npm run db:reset` vì schema đã đổi.
