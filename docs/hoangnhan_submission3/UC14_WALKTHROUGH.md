# Tài liệu Giải thích Code: UC14 (Run What-if Simulation – Mô phỏng kịch bản giả định)

**Người phụ trách:** Nguyễn Hoàng Nhân – MSSV: 2412415  
**Sơ đồ thiết kế gốc:** `docs/hoangnhan_submission3/UC14.drawio` (Hình 4.30 – Báo cáo BTL3, trang 50–51)

---

## 1. Sơ đồ Luồng Kiến trúc 4 Tầng (Layered Architecture)

```
[Frontend: SimulationPage.tsx]
       │
       ▼
[Client API: client/src/api/simulation.ts]
  1. prepareSimulation(hubIds, timeRange)                  ──► POST /api/simulations/snapshots
  2. acceptStaleSnapshot(snapshotId)                       ──► POST /api/simulations/snapshots/:id/accept-stale
  3. submitScenario(snapshotId, scenarioType, assumptions) ──► POST /api/simulations/scenarios
  4. runSimulation(requestId, scenarioDraftId)             ──► POST /api/simulations/runs
  5. stopRun(runId)                                        ──► POST /api/simulations/runs/:id/stop
  6. getRunResult(runId)                                   ──► GET  /api/simulations/runs/:id
  7. retrySaveRun(runId)                                   ──► POST /api/simulations/runs/:id/retry-save
  8. prepareOperationalHandoff(recommendationId)           ──► POST /api/simulations/handoffs
       │
       ▼
[Controller: server/src/controllers/SimulationController.ts]
       │
       ▼
[Service & Engine: server/src/services/SimulationService.ts & simulator/SimulationEngine.ts]
  • simulationService (+9 method public & -6 hàm private ở cuối file khớp 100% UC14.drawio)
  • simulationEngine (runBaselineAndScenario chạy nền bất đồng bộ trên Snapshot, abort)
       │
       ▼
[Repository: server/src/repositories/SimulationRunRepository.ts & operational/simulationOps.ts]
  • operationalRepository.readOperationalState(hubIds, timeRange)  ◄── Chỉ đọc (Read-only)
  • simulationRunRepository (storeSnapshot, markStaleAccepted, createRun,
                             markRunCancelled, markRunFailed, storeRunResult)
       │
       ▼
[SQLite Database: server/data/dev.db]
  • Chỉ ghi vào bảng mô phỏng: simulation_snapshots, simulation_runs, processed_requests
  • Tuyệt đối KHÔNG ghi/sửa các bảng vận hành (hubs, shared_vehicles, charging_ports, parking_slots)
```

---

## 2. Chi tiết Logic từng Bước & Đối chiếu BTL1 – BTL2 – BTL3

### 2.1. Bước 1–2: Chọn phạm vi & Tạo bản chụp dữ liệu (`captureStateSnapshot`)
* **Căn cứ:** BTL1 Bảng 2.14 Bước 1–2, Ext 2a, Ext 2b; BTL2 Sequence Hình 2.61 (1/2).
* **Thực hiện:**
  1. Gọi `operationalRepository.readOperationalState(hubIds, timeRange)`: **Chỉ đọc (Read-only)** trạng thái các Hub đã chọn (`HubStatus[]`).
  2. Gọi `assessSnapshotData(operationalState)`:
     * Kiểm tra dữ liệu bắt buộc (`hubIds`, `hubs`). Nếu thiếu Hub hoặc danh sách rỗng → Ném `AppError("CONFLICT")` (**Ext 2a**).
     * Kiểm tra xem có Hub nào trong bản chụp có `lastUpdatedAt` cũ hơn `dataStaleSeconds` (30 giây) không (`isStale`).
  3. Gọi `simulationRunRepository.storeSnapshot(...)` lưu bản chụp vào bảng `simulation_snapshots`.
  4. **Xử lý dữ liệu đã cũ (`Ext 2b`):** Nếu `isStale = true`, hệ thống cảnh báo trên giao diện và chỉ cho phép cấu hình kịch bản sau khi Operator bấm **"Chấp nhận giới hạn & Tiếp tục"** (`recordStaleDataAcceptance` → `markStaleAccepted`), đồng thời ghi rõ giới hạn dữ liệu (`dataLimitation`) vào kết quả mô phỏng.

### 2.2. Bước 3–5: Cấu hình kịch bản & Xem trước (`prepareScenario`)
* **Căn cứ:** BTL1 Bảng 2.14 Bước 3–5, Ext 4a, Ext 4b.
* **Thực hiện:**
  1. **`validateScenarioParameters(scenarioType, assumptions)` (`Ext 4a`):**
     * `DEMAND_SURGE`: `demandMultiplier` phải `> 1.0`.
     * `HUB_CLOSURE`: Phải chọn `hubId` bị đóng.
     * `ADD_CHARGERS`: `additionalChargers` phải là số nguyên `> 0`.
     * `ADD_VEHICLES`: `additionalVehicles` phải là số nguyên `> 0`.
  2. **`checkModelSupport(scenarioType, assumptions)` (`Ext 4b`):**
     * Kiểm tra tham số không vượt quá giới hạn mô hình (`demandMultiplier <= 5.0`, `additionalChargers <= 20`, `additionalVehicles <= 50`).
  3. **`buildBaselineAndScenarioPreview(snapshotId, scenario)` (Bước 5):**
     * Tính chỉ số Phương án cơ sở (`baseline: SimulationMetrics`) và trả về `SimulationPreview` kèm danh sách 3 chỉ số KPI so sánh (`unavailableVehicles`, `waitingTimeMinutes`, `overloadedHubCount`).

### 2.3. Bước 6–7: Chạy mô phỏng tách biệt & Bất đồng bộ (`startRun` & `SimulationEngine`)
* **Căn cứ:** BTL1 Bảng 2.14 Bước 6–7, Ext 6a, Ext 7a, Ext 7b, Ext 7c; NFR 3.1 (*"Không chặn thao tác giám sát"*, *"Cách ly dữ liệu mô phỏng"*).
* **Thực hiện:**
  1. `simulationRunRepository.createRun(requestId, snapshotId, scenario)` chạy trong `db.transaction`:
     * Chống gửi lặp bằng `requestId` (`START_SIMULATION_RUN`).
     * Tạo bản ghi `simulation_runs` với trạng thái `RUNNING`.
  2. `simulationEngine.runBaselineAndScenario(runId, snapshotId, scenario)` chạy nền bất đồng bộ:
     * Đọc duy nhất cột `operationalState` từ bảng `simulation_snapshots` (nếu dữ liệu vận hành thực tế thay đổi trong lúc chạy thì vẫn dùng bản chụp ban đầu theo **Ext 7c**).
     * Operator có thể bấm **"Dừng mô phỏng"** (`stopRun` → `simulationEngine.abort` → `markRunCancelled`) bất cứ lúc nào (**Ext 7b**).
     * Nếu xảy ra lỗi (`runFailed` → `markRunFailed`), đánh dấu `FAILED` và **không trình bày kết quả dở dang như kết quả hoàn chỉnh** (**Ext 7a**).

### 2.4. Bước 8–9: So sánh kết quả, Sinh khuyến nghị & Lưu đối chiếu (`runCompleted`)
* **Căn cứ:** BTL1 Bảng 2.14 Bước 8–9, Ext 8a, Ext 8b, Ext 9a, Ext 9b; BTL3 Test Case `TC-UC14-01` (trang 51).
* **Thực hiện:**
  1. `compareWithBaseline(rawResults)`: Đặt 3 chỉ số của `baseline` và `scenario` cạnh nhau trên cùng điều kiện so sánh.
  2. `generateRecommendations(comparison)`:
     * Sinh khuyến nghị chuyển sang **UC12 (Điều chuyển xe)** nếu kịch bản gây thiếu xe hoặc quá tải Hub.
     * Sinh khuyến nghị chuyển sang **UC13 (Lập kế hoạch sạc thông minh)** nếu thời gian chờ sạc thay đổi hoặc cần tối ưu công suất sạc.
  3. `storeRunResult(...)`: Lưu kết quả cùng giả định, giới hạn dữ liệu (`constraints`) và trạng thái lưu (`saveStatus`) vào `simulation_runs`. Nếu lưu lỗi, giữ tạm trong bộ nhớ để Operator bấm **"Thử lưu lại"** (`retrySaveRun` – **Ext 9a**).
  4. **Chuyển sang nghiệp vụ điều phối (`prepareOperationalHandoff` – Ext 9b):** Khi Operator bấm *"Áp dụng phương án vào vận hành"*, hệ thống trả về `TargetWorkflow` và điều hướng sang màn hình **UC12** hoặc **UC13** để kiểm tra dữ liệu thực tế trước khi áp dụng.

---

## 3. Cách Test Trực Tiếp Trên Trình Duyệt (`http://localhost:5173`)

1. Ở menu cột bên trái của giao diện Operator, bấm vào tab số 3: **"Mô phỏng What-if"** (`/operator/simulation`).
2. **Bước 1:** Bấm nút **"1. Tạo bản chụp dữ liệu đầu vào (Snapshot)"** → Hệ thống chụp bản sao 5 Hub (Độ đầy đủ 100%).
3. **Bước 2:** Ở cột bên trái, chọn 1 trong 4 kịch bản (ví dụ chọn **"Bổ sung cổng sạc tại Hub (ADD_CHARGERS)"** với `+2 cổng` đúng theo Test Case `TC-UC14-01` trong BTL3, hoặc chọn **"Sinh viên tăng đột biến (DEMAND_SURGE)"** với hệ số `1.8`) → Bấm **"2. Kiểm tra tham số & Xem trước phương án"**.
4. **Bước 3:** Ở cột bên phải, bấm nút **"3. Chạy mô phỏng What-if"**.
5. **Bước 4:** Xem 3 thẻ biểu đồ so sánh trực quan (**Xe thiếu hụt**, **Chờ trung bình (phút)**, **Hub quá tải**), danh sách **Khuyến nghị điều phối** và bấm thử nút **"Áp dụng phương án vào vận hành"**!
