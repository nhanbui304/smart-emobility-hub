# Subsystem Tài khoản và Đỗ xe – Bùi Quang Nhân

Nội dung để dán vào báo cáo Submission #3, đặt dưới hình class diagram của subsystem.
Hình: `class-tai-khoan-do-xe.drawio` (trang "Tai khoan" và trang "Do xe va tra xe").

Chữ ký method lấy theo sequence Submission #2: UC06 tr. 40–43, UC05 tr. 51–53. Các thao tác ghi dữ liệu nhận `requestId`. Mỗi lần sinh viên bấm xác nhận có một mã, gửi lại thì dùng đúng mã cũ, nên yêu cầu gửi lặp chỉ được xử lý một lần.

## Mô tả method

### ParkingService.holdSlot

| Mục | Nội dung |
| --- | --- |
| **Class** | ParkingService |
| **Method** | `holdSlot(requestId: String, studentId: String, slotId: String, vehicleId: String, timeRange: TimeRange): ParkingAllocation` |
| **Mô tả** | Giữ tạm một vị trí đỗ cho xe của sinh viên trong khoảng thời gian đã chọn, để sinh viên có thời gian xác nhận (UC06 bước 4–6). Service kiểm tra yêu cầu đã xử lý chưa (`findProcessedRequest`), kiểm tra lại điều kiện (`recheckReservationConditions`), tính hạn giữ (`computeHoldDeadline`), rồi gọi `atomicCheckAndHold`. Thao tác này kiểm tra vị trí còn trống, sinh viên chưa có lượt giữ khác và tạo lượt giữ trong cùng một giao dịch, nên hai sinh viên chọn cùng vị trí cùng lúc thì chỉ một người giữ được. |
| **Tham số** | `requestId`: mã của lần bấm giữ chỗ · `studentId`: sinh viên đang đăng nhập, lấy từ phiên · `slotId`: vị trí đỗ được chọn · `vehicleId`: xe cá nhân của sinh viên · `timeRange`: thời điểm bắt đầu và kết thúc đỗ |
| **Kết quả trả về** | `ParkingAllocation` ở trạng thái HELD; `id` của bản ghi dùng làm `holdToken` khi xác nhận |
| **Tiền điều kiện** | Sinh viên đã đăng nhập và đang xem danh sách vị trí phù hợp (UC06 bước 3). Xe thuộc sinh viên, Hub tiếp nhận loại xe, khoảng sử dụng chưa bắt đầu. |
| **Hậu điều kiện** | Có một lượt giữ HELD với hạn giữ = thời điểm sớm hơn giữa 30 phút kể từ lúc giữ và thời điểm bắt đầu sử dụng, không gia hạn (Sub #1 §2.3.1 mục 2). Vị trí không còn hiển thị trống cho khoảng thời gian xung đột. `requestId` được ghi nhận. |
| **Ngoại lệ** | Sub #1 UC06, tr. 22: · Gửi lặp cùng `requestId`: trả lại lượt giữ đã có, không tạo thêm (Ext 8d) · Vị trí vừa được người khác giữ hoặc đặt: không tạo lượt giữ, trả danh sách vị trí cập nhật (Ext 5a) · Sinh viên đang có lượt giữ còn hạn: hiển thị lượt giữ đó, không tạo thêm (Ext 5b) · Điều kiện không còn hợp lệ, kể cả khoảng sử dụng đã bắt đầu: báo lý do (Ext 5c) · Lưu thất bại: không công bố giữ thành công, không để lại phân bổ một phần (Ext 5d) |

### ReturnService.confirmReturn

| Mục | Nội dung |
| --- | --- |
| **Class** | ReturnService |
| **Method** | `confirmReturn(requestId: String, studentId: String, tripId: String): ReturnResult` |
| **Mô tả** | Hoàn tất việc trả xe dùng chung sau khi sinh viên đỗ xe vào chỗ đã được phân bổ (UC05 bước 5–9). Service kiểm tra gửi lặp (`findProcessedRequest`), tải bối cảnh bàn giao (`findReturnHandoverContext`), đọc vị trí xe (`readVehiclePosition`) và kiểm tra xe đỗ đúng Hub, đúng chỗ (`verifyVehicleHubAndSlot`). Sau đó ghi nhận đang bàn giao (`markHandoverInProgress`), gửi lệnh khóa (`sendLockCommand`) và cập nhật dữ liệu theo kết quả khóa. |
| **Tham số** | `requestId`: mã của lần bấm xác nhận trả · `studentId`: sinh viên đang đăng nhập, lấy từ phiên · `tripId`: chuyến đi đang trả xe |
| **Kết quả trả về** | `ReturnResult` gồm kết quả khóa (SUCCESS, FAILED, UNKNOWN), chuyến đi sau khi cập nhật, thời điểm trả, Hub và vị trí |
| **Tiền điều kiện** | Chuyến đi thuộc sinh viên và đã có chỗ trả được phân bổ (UC05 bước 1–4, `prepareReturn`). |
| **Hậu điều kiện** | Khóa thành công: `atomicCompleteReturn` kết thúc chuyến đi, ghi thời điểm trả, cập nhật vị trí xe và chỗ đang sử dụng, đánh dấu đặt chỗ đã dùng nếu có, trong cùng một giao dịch. Trạng thái xe xác định bằng `determineVehicleServiceStatus`: pin thấp, có sự cố hoặc chưa rõ tình trạng thì không chuyển sang sẵn sàng cho mượn (Ext 9a). |
| **Ngoại lệ** | Sub #1 UC05, tr. 19–20: · Gửi lặp cùng `requestId`: trả lại trạng thái đã ghi, không gửi lệnh khóa lần nữa (Ext 6b) · Xe đỗ sai Hub hoặc sai vị trí: hướng dẫn đỗ lại, không khóa xe (Ext 6a) · Khóa thất bại: ghi nhận lần thất bại (`recordLockFailure`), chưa xác nhận bàn giao, chỗ vẫn giữ cho chuyến đi (Ext 7a) · Chưa rõ kết quả khóa: đánh dấu chờ xác minh (`markPendingVerification`), báo Operator, không cấp lại xe và chỗ (Ext 7b) · Đã bàn giao nhưng ghi nhận lỗi: lưu thông tin để đối soát (`saveHandoverForReconciliation`), báo Operator, không cấp xe cho người khác (Ext 8a) |

## Test case

Dữ liệu dùng theo dữ liệu mẫu của nhóm: tài khoản `student1`, `student2`; Hub ĐH Bách Khoa có vị trí `BKU-01` đến `BKU-20`; Hub KTX Khu B.

### TC-UC06-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC06-01 |
| **Test Items** | UC06 – hai sinh viên giữ cùng một vị trí trong khoảng thời gian chồng lấn |
| **Pre-condition** | Vị trí BKU-10 đang phục vụ, chưa có ai giữ hoặc đặt từ 8:00 đến 10:00 ngày mai. student1 và student2 đã đăng nhập, mỗi người có một xe cá nhân. |
| **Test Data** | student1: 8:00–10:00 · student2: 9:00–11:00 · cùng vị trí BKU-10, Hub ĐH Bách Khoa |
| **Test Steps** | 1. student1 tìm chỗ đỗ ở Hub ĐH Bách Khoa, khoảng 8:00–10:00, chọn BKU-10 và bấm Giữ chỗ<br>2. student2 tìm chỗ đỗ cùng Hub, khoảng 9:00–11:00, chọn BKU-10 và bấm Giữ chỗ |
| **Expected results** | student1 giữ chỗ thành công, thấy hạn giữ và thời gian còn lại. student2 nhận thông báo vị trí đã được giữ cùng danh sách vị trí cập nhật. Không có lượt giữ thứ hai cho BKU-10 trong khoảng thời gian đó. |
| **Result** | |
| **Comments** | Sub #1 UC06 Ext 5a, tr. 22; sequence Sub #2 UC06 (2/4), tr. 41 |

### TC-2.3.1-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-2.3.1-01 |
| **Test Items** | Mục 2.3.1 – lượt giữ quá hạn không còn chặn chỗ và được tự giải phóng |
| **Pre-condition** | student1 đang giữ tạm BKU-11 (HELD), chưa xác nhận. Thời hạn giữ được cấu hình ngắn để thử, theo cấu hình kiểm thử ở Sub #1 tr. 47. |
| **Test Data** | student1, student2, vị trí BKU-11, cùng khoảng thời gian |
| **Test Steps** | 1. Chờ quá hạn giữ của student1, không bấm Xác nhận<br>2. Ngay sau khi quá hạn, student2 tìm chỗ đỗ cùng Hub và khoảng thời gian, chọn BKU-11 và bấm Giữ chỗ<br>3. student1 bấm Xác nhận lượt giữ cũ<br>4. Chờ tác vụ định kỳ chạy, xem lại lượt giữ của student1 |
| **Expected results** | Ngay khi quá hạn, dù tác vụ định kỳ chưa chạy: BKU-11 hiển thị trống với student2 và student2 giữ được. student1 không xác nhận được lượt giữ cũ. Sau khi tác vụ định kỳ chạy: lượt giữ của student1 chuyển EXPIRED. |
| **Result** | |
| **Comments** | Sub #1 §2.3.1 mục 5–6, tr. 45; UC06 Ext 7c và 8a, tr. 22 |

### TC-UC05-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-01 |
| **Test Items** | UC05 – trả xe tại Hub không còn chỗ phù hợp |
| **Pre-condition** | student1 đang có chuyến đi với một xe dùng chung. Mọi vị trí đang phục vụ của Hub KTX Khu B đều đang có xe hoặc đã được giữ, đặt. |
| **Test Data** | student1, Hub KTX Khu B |
| **Test Steps** | 1. student1 mở chuyến đi đang thực hiện, chọn Trả xe<br>2. Chọn Hub KTX Khu B làm nơi trả và gửi yêu cầu |
| **Expected results** | Hệ thống báo Hub không còn chỗ phù hợp và gợi ý Hub thay thế. Chuyến đi chưa kết thúc, xe không bị khóa, không có vị trí nào bị phân bổ. |
| **Result** | |
| **Comments** | Sub #1 UC05 Ext 3a, tr. 19; sequence Sub #2 UC05 (1/3), tr. 51 |
