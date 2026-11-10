# Ánh xạ Sequence Submission #2 → code (UC08, UC09, UC13, UC14)

Ngày 10/11 đã sửa khung code (chữ ký method, schema, route; thân hàm vẫn `notImplemented`) để khớp Sequence Submission #2. Class diagram vẽ theo code. Phần dưới để đưa vào mục **"Thay đổi so với Submission #2"** của báo cáo.

## 1. Đã bổ sung vào code cho khớp sequence

| UC | Sequence | Code |
| --- | --- | --- |
| Chung | `requestId` ở các thao tác ghi, nhánh `duplicateRequest` | Body có `requestId` (client sinh UUID). Bảng mới `processed_requests` (`ProcessedRequest`), ghi trong cùng transaction với thao tác chính |
| UC08 | `findSlotOption(slotOptionId, studentId)` | `ChargingReservationRepository.saveSlotOptions` / `findSlotOption` (lưu tạm trong bộ nhớ, có `expiresAt`) |
| UC08 | `findVehicleRight`, `queryHubChargingSupport`, `findConflictingRequestsOrSchedules` | `findOwnedVehicle`, `hasCompatiblePorts`, `findConflictingReservations` |
| UC08 | `atomicCreateReservation(..., chargingNeed)` | Nhận thêm `need`; `ChargingReservation` có thêm `currentBattery`, `targetBattery` |
| UC08, UC09 | Kết quả có `hubId`, `usageGuide`, `allowedActions` | Datatype `ChargingReservationDetail` |
| UC09 | `findRescheduleOptions(reservationId, hubId, timeRange, chargingNeed)` | Schema và Service nhận `hubId`, `timeRange`, `need` |
| UC09 | `existingCancellation`, `notCancellable(status, reason)` | `CancellationCheck` có `alreadyCancelled`, `status`, `reason` |
| UC13 | Lưu kế hoạch nháp giữa propose → validate → apply | `ChargingPlanRepository.saveDraft` / `findDraft` (bộ nhớ) |
| UC13 | `atomicApplyChargingSchedule(requestId, planDraftId, baseVersion)` | `atomicApplyPlan({ requestId, planDraftId, baseVersion, operatorId, now })` |
| UC13 | `:NotificationService.notifyAffectedParties`, `markNotificationPending` | `NotificationService` mới; `ChargingPlanRepository.markNotificationPending`; cột `notificationPending` |
| UC13 | `proposedPlan(planDraftId, servedRequests, waitingRequests)` | `PlanDraft` có `servedRequests`, `waitingRequests` |
| UC14 | `storeSnapshot` trả `snapshotId` trước khi chạy | Bảng mới `simulation_snapshots` (`SimulationSnapshot`); `storeSnapshot`, `findSnapshot` |
| UC14 | `acceptStaleSnapshot` → `recordStaleDataAcceptance` → `markStaleAccepted` | Route `POST /snapshots/:id/accept-stale`, method cùng tên |
| UC14 | `preview(scenarioDraftId, baseline, scenario, kpis)` | `prepareScenario` trả `ScenarioPreview` |
| UC14 | `markRunCancelled`, `markRunFailed`, `storeRunResult` | Method cùng tên (thay cho `updateStatus` cũ) |
| UC14 | `runCompleted`, `runFailed` từ Engine | `SimulationService.runCompleted` / `runFailed` |
| UC14 | `abort(runId)` | `SimulationEngine.abort` |
| UC14 | `retrySaveRun`, `prepareOperationalHandoff` | Route `POST /runs/:id/retry-save`, `POST /runs/:id/handoff`, method cùng tên |

## 2. Khác cách tổ chức, giữ theo code (ghi chú trong báo cáo)

| Sequence | Code | Lý do |
| --- | --- | --- |
| `:OperationalRepository` | `ChargingReservationRepository`, `ChargingPlanRepository` | Tách repository theo bảng cho dễ chia việc; mỗi repository chỉ truy vấn bảng của nó |
| `findReservation` | `findById` | Đặt tên thống nhất với các repository khác |
| `queryAvailableChargingSlots` | `findFreePorts` | Như trên |
| `queryChargingContext` | `loadChargingContext` | Như trên |
| Message tới Controller (`findChargingSlots`, `runSimulation`, `prepareSimulation`...) | Handler Express ngắn (`search`, `start`, `snapshot`...) | Tên handler gắn với route; tên Service giữ đúng như sequence |
| `readOperationalState` | `SimulationService` đọc qua `hubService` (chỉ đọc) | Dùng lại phần đọc trạng thái Hub đã có |
| Engine nhận `snapshotId` | Engine nhận đối tượng `StateSnapshot` | Engine không truy cập database, bảo đảm cách ly dữ liệu mô phỏng |
| `publishRunFinished` → `runFinished` | UI hỏi định kỳ `getRunResult` | Hệ thống không dùng WebSocket; sequence đã cho phép hỏi định kỳ khi không nhận được sự kiện |

## 3. Việc cần làm sau khi pull

- Schema đổi: chạy `npm run db:reset` (hoặc `npm run db:push --prefix server`).
- Client: các hàm `chargingApi.confirmReservation`, `cancelReservation`, `operationsApi.startSimulation` nhận thêm `requestId`.
