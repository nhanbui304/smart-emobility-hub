# Tài liệu Giải thích Code: UC13 (Manage Smart Charging Schedule – Quản lý kế hoạch sạc thông minh)

**Người phụ trách:** Nguyễn Hoàng Nhân – MSSV: 2412415  
**Sơ đồ thiết kế gốc:** `docs/hoangnhan_submission3/UC13.drawio` (Hình 4.29 – Báo cáo BTL3, trang 49)

---

## 1. Sơ đồ Luồng Kiến trúc 4 Tầng (Layered Architecture)

```
[Frontend: SmartChargingPanel.tsx (nhúng trong ChargingIncidentPage.tsx)]
       │
       ▼
[Client API: client/src/api/chargingSchedule.ts]
  1. loadChargingContext(hubId, timeRange)             ──► GET  /api/charging-schedules/context
  2. generateProposedSchedule(hubId, timeRange, rule)  ──► POST /api/charging-schedules/proposals
  3. validatePlan(planDraftId, adjustments)            ──► POST /api/charging-schedules/proposals/:id/validate
  4. applyChargingSchedule(requestId, draftId, ver)    ──► POST /api/charging-schedules/apply
       │
       ▼
[Controller: server/src/controllers/ChargingScheduleController.ts]
  • chargingScheduleController (loadChargingContext, generateProposedSchedule, validatePlan, applyChargingSchedule)
       │
       ▼
[Service: server/src/services/SmartChargingService.ts & NotificationService.ts]
  • smartChargingService (4 method public, kiểm tra ràng buộc dùng chung với giao dịch áp dụng)
  • notificationService.notifyAffectedParties(scheduleVersionId, changeSummary)
       │
       ▼
[Repository: server/src/repositories/operational/chargingScheduleOps.ts & common.ts]
  • operationalRepository.queryChargingContext(hubId, timeRange)
  • operationalRepository.atomicApplyChargingSchedule(requestId, planDraftId, baseVersion, operatorId)
  • operationalRepository.markNotificationPending(scheduleVersionId)
  • operationalRepository.findProcessedRequest(requestId)
       │
       ▼
[SQLite Database: server/data/dev.db]
  • Bảng: charging_schedule_versions, processed_requests, charging_requests,
          charging_ports, parking_slots, shared_vehicles, charging_reservations,
          charging_sessions, parking_allocations, incidents
```

---

## 2. Chi tiết Logic từng Bước & Đối chiếu BTL1 – BTL2 – BTL3

### 2.1. Bước 1–2: Tải bối cảnh sạc & Đánh giá độ đầy đủ (`getChargingContext`)
* **Căn cứ:** BTL1 Bảng 2.13 Bước 1–2 & Ext 2a; BTL2 Sequence Hình 2.55 (1/2).
* **Thực hiện:**
  1. Kiểm tra Hub tồn tại và dữ liệu Hub không bị quá hạn (`(now - hub.lastUpdatedAt) <= systemConfig.dataStaleSeconds`). Nếu dữ liệu quá hạn thì ném `AppError("CONFLICT")` theo **Ext 2a** (*"không áp dụng kế hoạch từ dữ liệu thiếu hoặc quá hạn"*).
  2. Gọi `operationalRepository.queryChargingContext(hubId, timeRange)` thu thập:
     * `demands`: Các yêu cầu sạc (`charging_requests` đang `WAITING`/`ALLOCATED`/`CHARGING`) và các xe dùng chung tại Hub cần sạc (`CHARGING` hoặc pin `< 85%`), loại trừ xe đang bảo trì.
     * `batteryLevels`: Mức pin hiện tại của các xe.
     * `activeSessions`: Các phiên sạc đang diễn ra (`ACTIVE`).
     * `confirmedReservations`: Các lịch sạc xe cá nhân đã xác nhận (`CONFIRMED`, `CHARGING`, `AWAITING_DISCONNECT`) giao với khung giờ.
     * `activeHolds`: Các lượt giữ chỗ đỗ còn hạn trên vị trí có cổng sạc.
     * `restrictedResources`: Các cổng sạc, vị trí đỗ đang `OUT_OF_SERVICE`, xe `UNDER_MAINTENANCE`, hoặc tài nguyên đang có sự cố `OPEN`/`IN_PROGRESS` trong bảng `incidents` (UC11 bước 4).
     * `hubPowerCapacityKw`: Giới hạn công suất điện của Hub (85% tổng công suất định mức các cổng đang hoạt động tại Hub).
  3. Gọi hàm private `assessDataCompleteness(context)` kiểm tra tính đầy đủ dữ liệu.

### 2.2. Bước 3–4: Chọn quy tắc ưu tiên & Đề xuất phân bổ (`generateProposedSchedule`)
* **Căn cứ:** BTL1 Bảng 2.13 Bước 3–4, Ext 3a, Ext 4a, Ext 4b & Mục *Điều kiện pin và ưu tiên sạc* (trang 45).
* **Thực hiện:**
  1. **`validatePriorityRule(ruleId)`:** Kiểm tra quy tắc thuộc 3 quy tắc hợp lệ:
     * `LOW_BATTERY_FIRST`: Xe có mức pin `< lowBatteryChargingPriority` (25%) được đưa lên nhóm ưu tiên đầu tiên, sắp xếp tăng dần theo % pin; trong cùng nhóm, yêu cầu ghi nhận trước được xét trước.
     * `SOONEST_USE_FIRST`: Ưu tiên yêu cầu sạc đã ghi nhận thời điểm trước (FIFO).
     * `MAX_NEED_FIRST`: Ưu tiên xe có độ thiếu hụt năng lượng (`targetBattery - currentBattery`) lớn nhất.
     * Nếu `ruleId` không hợp lệ → Ném `AppError("VALIDATION_ERROR")` (**Ext 3a**).
  2. **`computePriorities(context, ruleId)`:** Trả về danh sách `demandId` đã sắp xếp theo thứ tự ưu tiên.
  3. **`optimizeAllocation(context, priorities)`:**
     * Giữ nguyên phân bổ cho các cổng đã có phiên đang chạy (`activeSessions`) hoặc lịch đã xác nhận (`confirmedReservations`) (**Ràng buộc liên UC / Ext 6b**).
     * Loại trừ hoàn toàn các cổng/vị trí nằm trong `restrictedResources` (bị sự cố UC11) hoặc đang có lượt giữ chỗ (`activeHolds`).
     * Phân bổ các cổng rảnh còn lại cho các `demandId` theo thứ tự ưu tiên, chia tải công suất hợp lý sao cho không vượt `port.maxPowerKw` của từng cổng và tổng công suất không vượt `hubPowerCapacityKw`.
  4. **`markWaitingRequests(draft)`:** Các nhu cầu chưa được cấp cổng do hết cổng hoặc hết công suất được đưa vào `waitingRequests` (**Ext 4a** – hiển thị rõ nhu cầu còn chờ, không tự hủy lịch đã xác nhận).
  5. Nếu không tạo được bất kỳ phân bổ nào dù có nhu cầu → Ném `AppError("CONFLICT")` (**Ext 4b**).

### 2.3. Bước 5–6: Điều chỉnh phương án & Kiểm tra ràng buộc (`validatePlan`)
* **Căn cứ:** BTL1 Bảng 2.13 Bước 5–6, Ext 6a, Ext 6b.
* **Thực hiện:**
  1. **`applyAdjustments(planDraftId, adjustments)`:** Cập nhật các thay đổi công suất (`allocatedPowerKw`) hoặc cổng sạc mà Operator chỉnh tay trên giao diện vào bản nháp.
  2. **`validateScheduleConstraints(adjustedPlan, context)`:**
     * Kiểm tra mỗi phân bổ có `allocatedPowerKw > 0` và `<= port.maxPowerKw` (**Ext 6a**).
     * Kiểm tra tổng công suất toàn bộ phân bổ `<= context.hubPowerCapacityKw` (**Ext 6a**).
     * Kiểm tra không có cổng sạc hay vị trí đỗ nào bị cấp trùng 2 lần hoặc thuộc `restrictedResources` (**Ext 6a**).
     * Kiểm tra không làm mất phân bổ của lịch `CONFIRMED` hoặc phiên `ACTIVE` (**Ext 6b**).
  3. Trả về `ValidatedPlan: { planDraftId, baseVersion }` (trong đó `baseVersion` là số phiên bản kế hoạch hiện hành mới nhất của Hub trong bảng `charging_schedule_versions`).

### 2.4. Bước 7–9: Áp dụng kế hoạch nguyên tử & Thông báo (`applyChargingSchedule`)
* **Căn cứ:** BTL1 Bảng 2.13 Bước 7–9, Ext 8a, Ext 8b, Ext 8c, Ext 9a.
* **Thực hiện:**
  1. `operationalRepository.atomicApplyChargingSchedule(requestId, planDraftId, baseVersion, operatorId)` mở giao dịch SQLite. Controller lấy `operatorId` từ phiên đăng nhập.
     * **Chống gửi lặp (`Ext 8c`):** Kiểm tra `findProcessedRequest(requestId)`. Nếu đã xử lý, trả lại ngay kết quả phiên bản cũ (`appliedNow = false`), không tạo phiên bản trùng.
     * **Kiểm tra xung đột phiên bản và tài nguyên (`Ext 8a`):** Kiểm tra lại nhu cầu, cổng, vị trí, công suất và các cam kết trong giao dịch. Nếu lệch `baseVersion`, giao diện yêu cầu lập lại kế hoạch.
     * **Lưu phiên bản mới (`Bước 8`):** Insert bản ghi mới vào `charging_schedule_versions` với `version = baseVersion + 1`, danh sách `allocations` (JSON), `appliedAt = now`. Ghi dòng `processed_requests` (`operation = "APPLY_CHARGING_PLAN"`).
     * **Không tự bắt đầu phiên sạc (`Bước 9`):** Chỉ cập nhật kế hoạch phân bổ, không tự tạo `charging_session`.
     * **Giả định MVP cho UC07/UC13:** Khi một yêu cầu `WAITING` được cấp cổng, hạn nhận mặc định là 15 phút tính từ thời điểm bắt đầu khung cấp hoặc thời điểm áp dụng nếu muộn hơn. Hạn nhận không vượt thời điểm kết thúc khung cấp. Giá trị nằm ở `systemConfig.chargingAllocationClaimMinutes`.
  2. Gọi `notificationService.notifyAffectedParties(scheduleVersionId, changeSummary)`:
     * Nếu thông báo thất bại (`!sent` hoặc lỗi ngoại lệ), gọi `operationalRepository.markNotificationPending(scheduleVersionId)` (**Ext 9a**: giữ nguyên kế hoạch đã áp dụng, đánh dấu thông báo chưa gửi để thử lại).

---

## 3. Cách Test Trực Tiếp Trên Trình Duyệt (`http://localhost:5173`)

1. Đăng nhập tài khoản **Operator** (`operator@hub.local` / `operator123`).
2. Ở menu bên trái, bấm vào mục **"Lịch sạc và sự cố"** (`/operator/charging-incidents`).
3. Ở khung **"Lịch sạc thông minh (UC13)"** bên trái:
   * **Bước 1:** Chọn một Hub (ví dụ *Ga Metro ĐHQG*) → Bấm **"1. Tải bối cảnh sạc tại Hub"** → Xem giới hạn công suất (`22.1 kW`), danh sách các xe cần sạc và % pin.
   * **Bước 2:** Chọn quy tắc ưu tiên (ví dụ *"Ưu tiên xe pin thấp (< 25% xét trước)"*) → Bấm **"2. Sinh kế hoạch sạc đề xuất"** → Bảng phân bổ hiện ra kèm các nhu cầu được đáp ứng và nhu cầu còn chờ (Ext 4a).
   * **Bước 3 (Test cả hợp lệ & lỗi vượt công suất Ext 6a):**
     * Thử gõ sửa ô công suất (kW) của 1 cổng lên `99` kW rồi bấm **"3. Kiểm tra ràng buộc kế hoạch (Bước 6)"** → Hệ thống báo lỗi đỏ ngay lập tức因為 vượt công suất cổng/trạm (**Ext 6a**).
     * Sửa lại công suất về mức hợp lệ (ví dụ `3.6` hoặc `5.0` kW) rồi bấm **"3. Kiểm tra ràng buộc kế hoạch (Bước 6)"** → Hiện thông báo xanh *"✓ Kế hoạch hợp lệ"* và hiện nút số 4.
   * **Bước 4:** Bấm **"4. Xác nhận Áp dụng (baseVersion: v0)"** → Hệ thống lưu vào bảng `charging_schedule_versions` và hiện hộp xanh lá xác nhận thành công kèm mã phiên bản!
