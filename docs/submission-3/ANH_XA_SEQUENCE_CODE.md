# Ánh xạ Sequence Submission #2 → code

Ngày 10/11 đã sửa khung code (chữ ký method, schema, route; thân hàm vẫn `notImplemented`) để khớp Sequence Submission #2 cho cả 10 UC có sequence: UC01, UC02, UC04, UC05, UC06, UC08, UC09, UC11, UC13, UC14. UC03, UC07, UC10, UC12 và các UC phụ không có sequence nên giữ nguyên. Class diagram vẽ theo code. Phần dưới để đưa vào mục **"Thay đổi so với Submission #2"** của báo cáo.

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

## 4. UC01, UC02, UC04, UC05, UC06, UC11 – đã bổ sung vào code

| UC | Sequence | Code |
| --- | --- | --- |
| Chung | `requestId` + `findProcessedRequest` ở UC02, UC04, UC05, UC06, UC11 | Body có `requestId`; dùng chung bảng `processed_requests` (thêm giá trị vào enum `RequestOperation`) |
| Chung | `:NotificationService.notifyOperator` (UC04, UC05), `notifyAffectedUsers`, `requestUserConsent` (UC11) | Thêm vào `NotificationService` cùng datatype `OperatorAlert`, `ConsentRequest` |
| UC01 | `searchMobilityOptions` → `findSuitableOptions` → `queryMobilityContext`; `filterSuitableOptions(criteria, mobilityContext)` là bước nội bộ | Bỏ endpoint `/search/filter`; `SearchRepository.queryMobilityContext`; datatype `MobilityContext` |
| UC01 | `searchResult(options, updatedAt, unverifiedFlags)` | `SearchResult` có `updatedAt`, `unverifiedFlags`; `MobilityOption.isUnverified` |
| UC01 | `confirmOptionSelection` → `validateSelectedOption` → `queryCurrentOptionState`, `recordSessionSelection`; trả `nextActions` hoặc `optionChanged` | `SearchRepository.saveSearchSession` / `findSearchSession` / `queryCurrentOptionState` / `recordSessionSelection`; datatype `OptionSelectionResult` |
| UC02 | `loadReservationContext`, `atomicReserveVehicle(requestId, …)` | Thêm vào `ReservationRepository` |
| UC02 | `getReservationResult(requestId)` (Ext 8a) | `GET /vehicle-reservations/requests/:requestId` |
| UC04 | `loadPickUpContext`, `expireReservation`, `markReservationAffected`, `endHandoverAndResolveHold`, `markReconciliationRequired` | Thêm vào `PickUpRepository` |
| UC04 | `atomicStartTrip` chưa giải phóng chỗ đỗ | Sửa comment cũ (trước ghi "giải phóng vị trí đỗ") |
| UC04 | `getPickUpResult(requestId)` (Ext 9a) | `GET /trips/pickup/requests/:requestId` |
| UC05 | `findTripForReturn`, `queryHubReturnContext`, `selectReturnSlot` → `atomicAllocateReturnSlot(requestId, tripId, hubId, slotPlan)` | Repository nhận `slotPlan` do Service chọn; datatype `HubReturnContext`, `ReturnSlotPlan` |
| UC05 | `findReturnHandoverContext`, `markHandoverInProgress`, `saveHandoverForReconciliation`, `releaseNewReturnAllocation` | Thêm vào `ReturnRepository`; datatype `ReturnHandoverContext` |
| UC05 | `atomicCompleteReturn(requestId, tripId, vehicleId, slotId, returnedAt, bookingId, vehicleServiceStatus)` | Đủ tham số |
| UC05 | `markPendingVerification(tripId, vehicleId, slotId)` | Đổi tên từ `atomicMarkPendingVerification` |
| UC05 | `VehicleSimulator.readVehiclePosition`, `lockResult(status, batteryLevel, techStatus)` | Thêm `readVehiclePosition`; `sendLockCommand` trả `LockResult`; enum `VehicleTechStatus` |
| UC05 | `returnResult(tripId, returnedAt, hubId, slotId)` | `ReturnResult` có `returnedAt`, `hubId`, `slotId`, `pendingReconciliation` |
| UC06 | `findVehicleRight`, `queryHubAcceptance` (Ext 2b, 2c) | Thêm vào `ParkingRepository` |
| UC06 | `getActiveHold` → `findActiveHold` (Ext 7b) | `GET /parking/holds/active`; datatype `ActiveHold` |
| UC06 | `booking(bookingId, hubId, slotId, timeRange, arrivalConditions)` | `confirmReservation` trả `ParkingBooking` |
| UC06 | `HoldExpiryScheduler → ParkingService.expireDueHolds(now) → atomicExpireHolds(now)` | Scheduler gọi `parkingService.expireDueHolds`; thay `findExpiredHolds` bằng `atomicExpireHolds` |
| UC11 | `getIncidentContext` → `queryResourceStatusAndOpenIncidents`; `getIncidentDetails` → `findIncidentWithAffectedServices` | `GET /incidents/context?resourceId=`, `GET /incidents/:id` |
| UC11 | `createIncidentAndRestrictNewAllocations`, `queryAffectedHoldsBookingsTripsAndSchedules`, `markPriorityHandling`; trả `incidentCreated(incidentRecord, affectedContext)` | Thêm vào `IncidentRepository`; datatype `IncidentCreated`, `AffectedContext` |
| UC11 | `loadIncidentAndAffectedContext`, `queryAllocationAvailability`, `saveHandlingPlanAndProgress(…, consentPlan, expectedVersion)`, `markNotificationPending` | Thêm vào `IncidentRepository`; `processHandlingPlan` trả `HandlingResult` |
| UC11 | `saveIncidentProgress`, `queryResourceAndRemainingImpacts`, `closeIncidentAndRestoreService` / `closeIncidentKeepResourceRestricted` | Thêm vào `IncidentRepository` (thay `atomicResolve`) |
| UC11 | Lưu ưu tiên, consent, thông báo chờ gửi | Bảng `incidents` thêm `reportedBy`, `affectedScope`, `priorityHandling`, `consentPlan`, `notificationPending`, `resolutionNote`, `resolvedAt` |

## 5. UC01, UC02, UC04, UC05, UC06, UC11 – khác cách tổ chức, giữ theo code

| Sequence | Code | Lý do |
| --- | --- | --- |
| `:OperationalRepository` | `SearchRepository`, `ReservationRepository`, `PickUpRepository`, `ReturnRepository`, `ParkingRepository`, `IncidentRepository` | Tách theo nghiệp vụ như mục 2 |
| `queryReservableVehicles` (UC02), `queryAvailableSlots` (UC06) | `findReservableVehicles`, `findAvailableSlots` | Đặt tên thống nhất với các repository khác |
| `atomicCheckAndHold`, `atomicConfirmHold`, `atomicReleaseHold` nhận `holdToken` | Nhận `holdToken` hoặc `allocationId` | `holdToken` chính là `id` của `ParkingAllocation` |
| Các self-call (`validateCriteria`, `assessDataFreshness`, `validateTripForReturn`, `selectReturnSlot`, `verifyVehicleHubAndSlot`, `determineVehicleServiceStatus`, `recheckReservationConditions`, `computeHoldDeadline`…) | Ghi trong comment của method Service; kiểm tra dữ liệu gửi lên làm bằng zod ở Controller | Bước nội bộ, không phải API giữa các lớp |
| `findProcessedRequest(requestId)` gọi riêng | Kiểm tra trong các method `atomic…` của repository | Kiểm tra và ghi trong cùng transaction để không lọt yêu cầu gửi lặp |

## 6. Việc cần làm sau khi pull

- Schema đổi: chạy `npm run db:reset` (hoặc `npm run db:push --prefix server`).
- Client: các hàm xác nhận trong `vehicleApi`, `parkingApi`, `chargingApi`, `operationsApi` nhận thêm `requestId` (sinh bằng `crypto.randomUUID()` mỗi lần bấm xác nhận).
