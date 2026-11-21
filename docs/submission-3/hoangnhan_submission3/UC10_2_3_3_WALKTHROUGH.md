# Tài liệu Giải thích Code: UC10 (Monitor Mobility Hub Network) & Mục 2.3.3 (Tự động cảnh báo Hub)

**Người phụ trách:** Nguyễn Hoàng Nhân – MSSV: 2412415  
**Sơ đồ thiết kế gốc:** `docs/hoangnhan_submission3/UC10.drawio` (Hình 4.28 – Báo cáo BTL3, trang 46–48)

---

## 1. Sơ đồ Luồng Kiến trúc 4 Tầng (Layered Architecture)

Toàn bộ luồng của **UC10** và **Mục 2.3.3** tuân thủ tuyệt đối kiến trúc 4 tầng trong BTL3:

```
[Frontend: MonitoringPage.tsx]
       │  (Tự động gọi mỗi 3 giây qua useAsync)
       ▼
[Client API: client/src/api/monitoring.ts]
  • monitoringApi.overview()         ──► GET /api/monitoring/overview
  • monitoringApi.hubDetail(hubId)   ──► GET /api/monitoring/hubs/:hubId
       │
       ▼
[Controller: server/src/controllers/MonitoringController.ts]
  • monitoringController.overview()
  • monitoringController.hubDetail()
       │
       ▼
[Service & Scheduler: server/src/services/ & schedulers/]
  • monitoringService.getNetworkOverview()
  • monitoringService.getHubDetail(hubId)
  • hubAlertScheduler.evaluateHubAlerts(now)   ◄── Chạy định kỳ + chạy ngay khi đọc
  • hubService.getReceivableSlotCount(...)
  • hubService.getHubReservations(...)
       │
       ▼
[Repository: server/src/repositories/]
  • alertRepository (findActive, findActiveByHubAndType, upsertActive, clear)
  • hubRepository (listAllocationsOverlapping, queryHubReservations)
       │
       ▼
[SQLite Database: server/data/dev.db]
  • Bảng: hubs, parking_slots, charging_ports, shared_vehicles, alerts,
          vehicle_reservations, parking_allocations, charging_reservations
```

---

## 2. Chi tiết Logic từng File & Đối chiếu BTL1 – BTL2 – BTL3

### 2.1. Tầng Repository

#### A. `server/src/repositories/AlertRepository.ts`
Quản lý bảng `alerts` trong SQLite. Khớp 100% với class `«repository» AlertRepository` trong `UC10.drawio`:

| Method | Tham số & Kiểu trả về | Giải thích & Căn cứ BTL |
| :--- | :--- | :--- |
| `findActive()` | `(): Alert[]` | Lấy toàn bộ cảnh báo đang mở (`active = true`), sắp xếp mới nhất lên đầu để hiển thị trên Dashboard (UC10 bước 4). |
| `findActiveByHubAndType` | `(hubId: string, type: AlertType): Alert \| undefined` | Kiểm tra xem Hub đã có cảnh báo cùng loại đang mở hay chưa (Mục 2.3.3 ý 5: *"Cùng tình trạng chỉ cập nhật cảnh báo hiện có"*). |
| `upsertActive` | `(hubId, type, value, threshold, evaluationWindow?): Alert` | Nếu đã có cảnh báo đang mở của cùng `(hubId, type)` thì chỉ `UPDATE` lại giá trị `value`, `threshold`, `evaluationWindow`, `updatedAt`. Nếu chưa có mới `INSERT` bản ghi mới với `active = true`. |
| `clear` | `(alertId: string): Alert` | Khi Hub không còn vi phạm ngưỡng, chuyển `active = false` để kết thúc cảnh báo (Mục 2.3.3 ý 5: *"Khi điều kiện không còn, cảnh báo được kết thúc"*). |

#### B. `server/src/repositories/HubRepository.ts` (2 hàm cuối của Hoàng Nhân)
* **`listAllocationsOverlapping(hubId: string, timeRange: TimeRange): ParkingAllocation[]`**
  * **Mục đích:** Tìm tất cả lượt giữ tạm (`HELD` còn hạn), đặt chỗ đã xác nhận (`CONFIRMED`) và đang đỗ (`IN_USE`) của các ô đỗ thuộc `hubId` có khoảng thời gian giao với `[timeRange.startTime, timeRange.endTime)`.
  * **Công thức giao nhau 2 khoảng thời gian:** `allocation.startTime < timeRange.endTime && allocation.endTime > timeRange.startTime`.
* **`queryHubReservations(hubId: string, now: Date): HubReservations`**
  * **Mục đích (UC10 bước 6):** Khi Operator bấm vào xem chi tiết 1 Hub, trả về các lượt đặt còn hiệu lực tại Hub đó gồm:
    1. `vehicleReservations`: Đặt xe dùng chung đang giữ (`RESERVED` còn hạn nhận xe, `HANDING_OVER`, `PENDING_VERIFICATION`).
    2. `parkingAllocations`: Giữ chỗ / đặt chỗ đỗ còn hiệu lực (`HELD` còn hạn, `CONFIRMED`, `IN_USE`).
    3. `chargingReservations`: Lịch sạc xe cá nhân tại các cổng sạc thuộc Hub (`CONFIRMED`, `CHARGING`, `AWAITING_DISCONNECT`).

---

### 2.2. Tầng Service & Scheduler

#### A. `server/src/services/HubService.ts` (2 hàm cuối của Hoàng Nhân)
* **`getReceivableSlotCount(hubId: string, timeRange: TimeRange, now: Date): number`**
  * **Căn cứ BTL1 (Mục 2.3.3 ý 3, trang 46):**
    > *"Số vị trí có thể tiếp nhận được tính theo khoảng thời gian đánh giá, có xét xe đang đỗ, vị trí không phục vụ, lượt giữ tạm và phân bổ còn hiệu lực. Một vị trí không được tính trùng khi chuyển từ đặt trước sang sử dụng."*
  * **Cách hiện thực chống tính trùng:**
    1. Lọc danh sách các vị trí đỗ của Hub đang `IN_SERVICE` (bỏ qua vị trí `OUT_OF_SERVICE`).
    2. Dùng cấu trúc tập hợp `Set<string>` (`unavailableSlotIds`) lưu `slotId` của:
       * Các xe dùng chung đang đỗ tại ô đó (`v.slotId`).
       * Các phân bổ chỗ đỗ chồng lấn khoảng thời gian đánh giá (`listAllocationsOverlapping`).
    3. Vì `Set` tự động loại bỏ phần tử trùng, nếu một ô đỗ vừa có bản ghi đặt chỗ vừa có xe đang đỗ thì `slotId` đó cũng chỉ tính là **1 vị trí bận**.
    4. Số vị trí có thể tiếp nhận = Tổng số vị trí `IN_SERVICE` không nằm trong `unavailableSlotIds`.

#### B. `server/src/schedulers/HubAlertScheduler.ts`
* **`evaluateHubAlerts(now: Date = new Date()): number`**
  * **Căn cứ BTL1 (Mục 2.3.3, trang 46) & BTL3 (Mô tả method & Test Case `TC-UC10-01`, trang 47–48):**
  * Duyệt qua từng Hub và kiểm tra **4 quy tắc cảnh báo** với ngưỡng lấy từ `server/src/config/systemConfig.ts`:
    1. **`DATA_STALE` (Dữ liệu quá hạn – Mục 2.3.3 ý 6 & UC10 Ext 2b):**
       * Nếu `(now - hub.lastUpdatedAt) > systemConfig.dataStaleSeconds` (30 giây) → Bật cảnh báo `DATA_STALE`. Ngược lại → Tắt cảnh báo.
    2. **`LOW_VEHICLE` (Thiếu xe – Mục 2.3.3 ý 4 & `TC-UC10-01`):**
       * Điều kiện: `hub.availableVehicles < systemConfig.lowVehicleThreshold` (**nhỏ hơn nghiêm ngặt `<`**, ngưỡng mặc định = 2).
       * Nếu chỉ còn 0 hoặc 1 xe khả dụng → Bật `LOW_VEHICLE`. Nếu có từ 2 xe trở lên → Tắt `LOW_VEHICLE`.
    3. **`NEAR_FULL` (Gần hết chỗ – Mục 2.3.3 ý 4 & `TC-UC10-01`):**
       * Khoảng thời gian đánh giá `evaluationWindow`: `[now, now + 60 phút]`.
       * Điều kiện: `receivableSlots <= systemConfig.nearFullThreshold` (**nhỏ hơn hoặc bằng `<=`**, ngưỡng mặc định = 1).
       * Lưu kèm `evaluationWindow` vào cảnh báo để hiển thị khung giờ đánh giá trên Dashboard.
    4. **`RESOURCE_FAULT` (Tài nguyên gặp sự cố – UC10 bước 4):**
       * Đếm tổng số xe `UNDER_MAINTENANCE`, ô đỗ `OUT_OF_SERVICE`, cổng sạc `OUT_OF_SERVICE` tại Hub. Nếu `> 0` → Bật `RESOURCE_FAULT`. Ngược lại → Tắt.

> **Lưu ý quan trọng khi đi vấn đáp (Test Case `TC-UC10-01` trang 48 BTL3):**
> Giảng viên có thể hỏi: *"Tại sao khi số xe = ngưỡng và số chỗ trống = ngưỡng thì chỉ phát cảnh báo NEAR_FULL mà không phát LOW_VEHICLE?"*
> **Trả lời:** Theo đặc tả BTL1 mục 2.3.3 ý 4 (trang 46): Thiếu xe dùng phép so sánh **thấp hơn ngưỡng (`<`)**, còn Gần hết chỗ dùng phép so sánh **bằng hoặc thấp hơn ngưỡng (`<=`)**. Code trong `HubAlertScheduler.ts` đã cài đặt chính xác `<` cho `LOW_VEHICLE` và `<=` cho `NEAR_FULL`.

#### C. `server/src/services/MonitoringService.ts`
* **`getNetworkOverview(): Promise<NetworkOverview>`**
  * Gọi `hubAlertScheduler.evaluateHubAlerts(now)` ngay đầu hàm để mọi biến động trạng thái trong DB được phản ánh tức thì trong vòng 3 giây (đạt NFR 3.1).
  * Trả về `{ hubs, activeAlerts, generatedAt: now }`.
* **`getHubDetail(hubId: string): Promise<OperatorHubDetail>`**
  * Trả về thông tin Hub + danh sách từng xe (`vehicles`) + cảnh báo của Hub (`activeAlerts`) + cờ `isDataStale` + các đặt chỗ còn hiệu lực (`reservations`).

---

### 2.3. Tầng Frontend (`client/src/pages/operator/MonitoringPage.tsx`)

Đã gỡ bỏ `<StubNotice>` và hoàn thiện đầy đủ các tính năng theo Mockup BTL2 và luồng sự kiện BTL1:
1. **Tự động cập nhật mỗi 3 giây (`refreshEveryMs: 3000`)** + nút **"Làm mới ngay"** (`MonitoringView.refresh()`).
2. **Xử lý ngoại lệ làm mới lỗi (UC10 Ext 7a):** Nếu mất kết nối tạm thời khi đang mở trang, vẫn giữ nguyên bảng số liệu gần nhất kèm thời điểm cập nhật và thanh cảnh báo cho phép bấm "Thử lại".
3. **4 thẻ KPI tổng quan:** Xe sẵn sàng, Chỗ đỗ trống, Cổng sạc rảnh, Số cảnh báo đang mở.
4. **Khu vực Cảnh báo vận hành (UC10 bước 4–5):**
   * Bộ lọc tab theo loại cảnh báo (`Tất cả`, `Thiếu xe`, `Sắp đầy`, `Tài nguyên lỗi`, `Dữ liệu cũ`).
   * Mỗi thẻ cảnh báo hiển thị rõ nhãn chữ (`StatusBadge`), tên Hub, số lượng thực tế so với ngưỡng, khung giờ đánh giá `evaluationWindow` (với `NEAR_FULL`), nút **"Xem chi tiết Hub"** và nút chuyển nhanh sang **Điều chuyển xe (UC12)** hoặc **Xử lý sự cố (UC11)**.
5. **Bảng trạng thái 5 Mobility Hub & Bộ lọc:**
   * Tìm kiếm theo tên/vị trí Hub, checkbox *"Chỉ hiện Hub có cảnh báo"*.
   * Hiển thị `<EmptyState>` nếu không có Hub khớp bộ lọc (UC10 Ext 5a).
6. **Panel Chi tiết Hub (UC10 bước 6):**
   * Khi bấm **"Xem chi tiết"** ở bất kỳ Hub nào: Hiển thị danh sách từng xe tại Hub (mã xe, loại xe, % pin, trạng thái, bộ lọc trạng thái xe) và 3 hộp thống kê các lượt đặt xe, giữ/đặt chỗ đỗ, lịch sạc cá nhân đang có hiệu lực tại Hub.

---

## 3. Cách Chạy & Kiểm Thử Thực Tế

1. Chạy dự án:
   ```powershell
   npm run dev
   ```
2. Mở trình duyệt vào `http://localhost:5173/login`.
3. Bấm nút điền nhanh tài khoản **Operator** (`operator@hub.local` / `operator123`) rồi đăng nhập.
4. Hệ thống tự chuyển vào trang **Giám sát mạng lưới** (`/operator/monitoring`):
   * Quan sát các thẻ cảnh báo tự động phát hiện các Hub có xe đang bảo trì (`RESOURCE_FAULT`).
   * Thử bấm các nút lọc cảnh báo: `Tất cả`, `Thiếu xe`, `Sắp đầy`, `Tài nguyên lỗi`.
   * Thử bấm nút **"Xem chi tiết"** ở một Hub bất kỳ để xem danh sách 10 xe của Hub đó và lọc xe theo trạng thái (`Sẵn sàng`, `Đang sạc`, `Đang bảo trì`).
   * Quan sát mức pin của các xe tự động thay đổi mỗi 3 giây theo bộ giả lập `VehicleSimulator`.
