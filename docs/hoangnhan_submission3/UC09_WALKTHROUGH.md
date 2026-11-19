# Tài liệu Walkthrough – UC09: Manage Scheduled Charging Session (Xem, đổi hoặc hủy lịch sạc xe điện cá nhân)

- **Người phụ trách:** Nguyễn Hoàng Nhân – MSSV: 2412415 (Nhóm 17 – CO3001)
- **Tài liệu đối chiếu:**
  - `BTL1.pdf` – Bảng 2.9: Use-case description *Manage Scheduled Charging Session* (tr. 28–30)
  - `BTL2.pdf` – Mockup Hình 1.4 (tr. 2), Sequence Diagram UC09 1/4–4/4 & Activity Diagram UC09 1/4–4/4 (tr. 67–75)
  - `BTL3.pdf` – Hình 4.27 (tr. 43), Mô tả `ChargingReservationService.confirmReschedule` (tr. 44), Test Case chuẩn `TC-UC09-01` (tr. 45)
  - Sơ đồ lớp chi tiết: `docs/hoangnhan_submission3/UC09.drawio`

---

## 1. Các tệp đã cài đặt (End-to-End, không đụng code đồng đội)

| Tầng | Tệp mã nguồn | Nội dung hiện thực |
| --- | --- | --- |
| **Repository** | `server/src/repositories/operational/rescheduleOps.ts` | 3 method của `OperationalRepository`: `findReservation`, `atomicReschedule`, `atomicCancelReservation` + các helper nội bộ cho tìm cổng sạc khả dụng (bỏ qua chính lịch đang sửa, loại trừ tài nguyên bị sự cố UC11). |
| **Service** | `server/src/services/ChargingReservationService.ts` | 6 method public UC09 (`getReservationDetail`, `startReschedule`, `findRescheduleOptions`, `confirmReschedule`, `checkCancellation`, `cancelReservation`) và 4 hàm private (`determineAllowedActions`, `checkModifiable`, `validateNewCriteria`, `checkCancellable`). Giữ nguyên 100% phần UC08 của Ngô Minh Triết. |
| **Controller & Routes** | `server/src/controllers/ChargingReservationController.ts`, `server/src/routes/chargingReservationRoutes.ts` | Đã nối sẵn 6 REST API cho vai trò `STUDENT` (`GET /:id`, `POST /:id/reschedule/start`, `POST /:id/reschedule/options`, `POST /:id/reschedule/confirm`, `GET /:id/cancellation-check`, `POST /:id/cancel`). |
| **Frontend View** | `client/src/pages/student/ManageChargingSchedulePanel.tsx` | Component `ChargingReservationView` với đủ 9 thao tác theo `UC09.drawio` (`selectReservation`, `chooseReschedule`, `submitNewCriteria`, `selectOption`, `confirmReschedule`, `cancelReschedule`, `chooseCancel`, `confirmCancel`, `keepReservation`). |
| **Tích hợp trang** | `client/src/pages/student/MyVehiclePage.tsx` | Nhúng `<ManageChargingSchedulePanel />` vào trang *Xe của tôi*, giữ nguyên các thẻ & `StubNotice` của UC06 (Quang Nhân) và UC08 (Minh Triết). |

---

## 2. Cơ chế nghiệp vụ & Xử lý ngoại lệ đã cài đặt

1. **Bảo vệ dữ liệu theo chủ sở hữu (Ext 2a – NFR Security):**
   - `studentId` luôn lấy từ phiên đăng nhập (`currentUser(req)`), không nhận từ client.
   - Mọi thao tác xem, đổi, hủy đều kiểm tra `reservation.studentId === studentId`; nếu sinh viên khác cố nhập mã lịch sạc của người khác → trả lỗi `403 FORBIDDEN`.
2. **Điều kiện sửa / hủy & Chế độ chỉ xem (Bước 3, 5, Ext 5a, Ext 4b.3):**
   - Chỉ khi `status === "CONFIRMED"`, `startTime > now`, và không có phiên sạc `ACTIVE` mới trả `allowedActions = ["VIEW", "RESCHEDULE", "CANCEL"]`.
   - Ngược lại, chỉ trả `["VIEW"]` và từ chối mọi yêu cầu đổi/hủy.
3. **Không tính trùng tài nguyên của chính lịch đang sửa (Bước 7):**
   - Khi tìm phương án mới (`findRescheduleOptions`), hệ thống bỏ qua chính `reservationId` đang sửa (`excludeReservationId`), đồng thời kiểm tra tương thích đầu sạc (`connectorType`), giới hạn công suất Hub, lượt giữ tạm còn hạn (§2.3.1), các lịch sạc khác và **loại trừ tài nguyên đang có sự cố `OPEN`/`IN_PROGRESS` (UC11)**.
   - Lịch cũ vẫn được giữ nguyên trong suốt quá trình tìm kiếm (Ext 7a, 7b, 9a).
4. **Đổi lịch & Hủy lịch nguyên tử với `expectedVersion` và `requestId` (Bước 10, Ext 10a–10d, Ext 4b.1):**
   - Toàn bộ quá trình kiểm tra lại và cập nhật chạy trong `db.transaction` đồng bộ của SQLite (`better-sqlite3`), tuân thủ đúng thứ tự BTL2 trang 71:
     1. **Chống gửi lặp (`Ext 10d`):** Kiểm tra `processed_requests` theo `requestId`. Nếu đã xử lý → trả lại kết quả cũ, không cập nhật trùng hay tăng version lần 2.
     2. **Kiểm tra khả dụng phương án mới (`Ext 10a` / `TC-UC09-01`):** Kiểm tra lại cổng mới không vừa bị sinh viên khác đặt mất và không vừa phát sinh sự cố UC11. Nếu hết chỗ → ném `CONFLICT` kèm `updatedOptions`, giữ nguyên lịch cũ và `version` cũ.
     3. **Kiểm tra phiên bản (`Ext 10b`):** So sánh `reservation.version === expectedVersion`. Nếu lệch → ném `VERSION_CONFLICT` yêu cầu tải lại lịch.
     4. **Cập nhật nguyên tử:** Đổi cổng/khung giờ/nhu cầu (hoặc chuyển `CONFIRMED → CANCELLED`), tăng `version + 1` và ghi `processed_requests` trong cùng 1 transaction.

---

## 3. Kết quả kiểm thử

### 3.1. Kiểm thử TypeScript
- Lệnh: `npm run typecheck` (`server` + `client`)
- Kết quả: **PASS (0 lỗi)**.

### 3.2. Kiểm thử tự động Service / Repository (7/7 PASS)
- **Test 1:** Xem chi tiết lịch sạc (`cr-demo-01`) & chặn `student2` xem lịch của `student1` (`Ext 2a`) → **PASS**.
- **Test 2:** Đổi lịch sang khung giờ chồng lấn 30 phút trên cùng Hub (bỏ qua chính lịch đang sửa), cập nhật thành công `v1 → v2` → **PASS**.
- **Test 3:** Gửi lặp cùng `requestId` (`Ext 10d`) → trả kết quả cũ, `version` giữ nguyên `2` → **PASS**.
- **Test 4 (`TC-UC09-01` – BTL3 tr. 45):** `S01` có `CR-01` tại `P01` (`14:00–15:00`, `version = 3`), chọn `P02` (`15:00–16:00`), nhưng `S02` đặt mất `P02` trước lúc `S01` xác nhận → Hệ thống báo `CONFLICT` (`NEW_OPTION_UNAVAILABLE`), `CR-01` giữ nguyên `P01`, `14:00–15:00`, `version = 3`, còn `P02` thuộc `S02` → **PASS**.
- **Test 5:** Cổng mới phát sinh sự cố `OPEN` (UC11) trước lúc xác nhận → chặn đổi lịch, giữ nguyên lịch cũ → **PASS**.
- **Test 6:** Gửi sai `expectedVersion` (`Ext 10b`) → báo `VERSION_CONFLICT` → **PASS**.
- **Test 7:** Hủy lịch sạc (`Ext 4b`, `4b.1`), chống gửi lặp hủy (`Ext 10d`), kiểm tra lại sau hủy (`Ext 4b.3`) và khóa sang chế độ chỉ xem `["VIEW"]` (`Ext 5a`) → **PASS**.

### 3.3. Kiểm thử HTTP End-to-End qua Express (6/6 PASS)
- Đã kiểm chứng toàn bộ 6 endpoint `/api/charging-reservations/*` với phiên đăng nhập cookie thật (`student1@hub.local`) → **6/6 PASS**.

---

## 4. Hướng dẫn demo nhanh trên trình duyệt

1. Khởi chạy ứng dụng (`npm run dev`), mở trình duyệt tại `http://localhost:5173`.
2. Đăng nhập bằng tài khoản sinh viên: **`student1@hub.local`** / **`student123`**.
3. Vào tab **"Xe của tôi"** (menu dưới cùng) → Kéo xuống thẻ **"UC09 · Quản lý lịch sạc cá nhân"**.
4. Hệ thống tự nạp sẵn lịch sạc mẫu **`cr-demo-01`** (xe `59-X1 123.45`, đầu cắm `STANDARD_PLUG`, trạng thái `Đã xác nhận`).
5. **Thử luồng Đổi lịch:** Bấm **"Đổi lịch sạc"** → chọn Hub mới (vd: *ĐH Bách Khoa*) & khung giờ mới → bấm **"Tìm phương án mới"** → chọn 1 cổng sạc → xem **bảng đối chiếu Lịch cũ vs Lịch dự kiến mới** → bấm **"Xác nhận đổi lịch"** → thấy hướng dẫn mới (`v2`) và chi tiết lịch tự động cập nhật.
6. **Thử luồng Hủy lịch:** Bấm **"Hủy lịch sạc"** → xác nhận hủy → trạng thái chuyển sang **`Đã hủy`** và các nút Đổi/Hủy tự khóa (chế độ chỉ xem).
7. **Thử kiểm soát quyền sở hữu (`Ext 2a`):** Nhập mã **`cr-demo-s2`** (lịch của `student2`) và bấm **"Xem lịch"** → hệ thống từ chối truy cập ngay lập tức.
