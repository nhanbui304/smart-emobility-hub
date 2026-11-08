# Subsystem Tài khoản và Đỗ xe – Bùi Quang Nhân

Nội dung để dán vào báo cáo Submission #3, đặt dưới hình class diagram của subsystem.
Hình: `class-tai-khoan-do-xe.drawio` (trang "Tai khoan" và trang "Do xe va tra xe").

## Mô tả method

### ParkingService.holdSlot

| Mục | Nội dung |
| --- | --- |
| **Class** | ParkingService |
| **Method** | `holdSlot(studentId: String, slotId: String, vehicleId: String, timeRange: TimeRange): ParkingAllocation` |
| **Mô tả** | Giữ tạm một vị trí đỗ cho xe của sinh viên trong khung giờ đã chọn, để sinh viên có thời gian xác nhận (UC06). Việc kiểm tra vị trí còn trống và tạo bản ghi giữ chỗ chạy trong cùng một transaction, nên hai sinh viên chọn cùng vị trí cùng lúc thì chỉ một người giữ được. |
| **Tham số** | `studentId`: sinh viên đang đăng nhập (lấy từ phiên) · `slotId`: vị trí đỗ được chọn · `vehicleId`: xe cá nhân của sinh viên · `timeRange`: thời điểm bắt đầu và kết thúc đỗ |
| **Kết quả trả về** | Bản ghi `ParkingAllocation` ở trạng thái HELD; `id` của bản ghi dùng làm `holdToken` cho bước xác nhận |
| **Tiền điều kiện** | Sinh viên đã đăng nhập; xe thuộc sinh viên; vị trí đang IN_SERVICE; thời điểm kết thúc sau thời điểm bắt đầu |
| **Hậu điều kiện** | Có bản ghi HELD với `holdExpiresAt = now + parkingHoldMinutes` (30 phút); vị trí không còn hiển thị trống trong khung giờ đó |
| **Ngoại lệ** | Vị trí đã được giữ hoặc đặt trong khung giờ chồng lấn → `CONFLICT`, không tạo bản ghi · Vị trí ngừng hoạt động → `CONFLICT` · Xe không thuộc sinh viên → `FORBIDDEN` · Khung giờ sai → `VALIDATION_ERROR` |

### ReturnService.confirmReturn

| Mục | Nội dung |
| --- | --- |
| **Class** | ReturnService |
| **Method** | `confirmReturn(studentId: String, tripId: String): ReturnResult` |
| **Mô tả** | Hoàn tất việc trả xe dùng chung (UC05): gửi lệnh khóa xe tới thiết bị qua `VehicleSimulator.sendLockCommand` (ngoài transaction), rồi cập nhật dữ liệu theo kết quả khóa trong một transaction. |
| **Tham số** | `studentId`: sinh viên đang đăng nhập · `tripId`: chuyến đi đang trả xe |
| **Kết quả trả về** | `ReturnResult` gồm kết quả khóa (SUCCESS / FAILED / UNKNOWN) và chuyến đi sau khi cập nhật |
| **Tiền điều kiện** | Chuyến đi thuộc sinh viên và đang RETURN_IN_PROGRESS, tức là đã gọi `prepareReturn` và được phân bổ vị trí trả xe |
| **Hậu điều kiện** | SUCCESS: chuyến đi ENDED, ghi `endedAt`; xe AVAILABLE tại Hub và vị trí mới · FAILED hoặc UNKNOWN: chuyến đi PENDING_RECONCILIATION, Operator nhận cảnh báo để kiểm tra, vị trí vẫn được giữ |
| **Ngoại lệ** | Chuyến đi không tồn tại hoặc không thuộc sinh viên → `NOT_FOUND` · Chuyến đi không ở trạng thái RETURN_IN_PROGRESS → `CONFLICT` |

## Test case

Dữ liệu dùng theo dữ liệu mẫu của hệ thống: tài khoản `student1`, `student2`; Hub ĐH Bách Khoa có vị trí `BKU-01` đến `BKU-20`.

### TC-UC06-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC06-01 |
| **Test Items** | UC06 – hai sinh viên giữ cùng một vị trí trong khung giờ chồng lấn |
| **Pre-condition** | Vị trí BKU-05 đang IN_SERVICE, chưa có ai giữ hoặc đặt từ 8:00 đến 10:00 ngày mai; student1 và student2 đã đăng nhập, mỗi người có một xe cá nhân |
| **Test Data** | student1: 8:00–10:00 · student2: 9:00–11:00 · cùng vị trí BKU-05 |
| **Test Steps** | 1. student1 tìm chỗ đỗ ở ĐH Bách Khoa, khung giờ 8:00–10:00, chọn BKU-05 và bấm Giữ chỗ<br>2. student2 tìm chỗ đỗ cùng Hub, khung giờ 9:00–11:00, chọn BKU-05 và bấm Giữ chỗ |
| **Expected results** | student1 giữ chỗ thành công, thấy đồng hồ đếm ngược 30 phút · student2 nhận thông báo vị trí đã được giữ, không có bản ghi giữ chỗ thứ hai cho BKU-05 trong khung giờ đó |
| **Result** | |
| **Comments** | |

### TC-2.3.1-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-2.3.1-01 |
| **Test Items** | Mục 2.3.1 – giữ chỗ quá hạn tự giải phóng |
| **Pre-condition** | student1 đang giữ tạm vị trí BKU-06 (trạng thái HELD); thời gian giữ chỗ cấu hình là 30 phút |
| **Test Data** | student1, vị trí BKU-06 |
| **Test Steps** | 1. student1 giữ tạm BKU-06 nhưng không bấm Xác nhận<br>2. Chờ quá 30 phút (hoặc chỉnh `parkingHoldMinutes` = 1 để thử nhanh)<br>3. student2 tìm chỗ đỗ ở cùng Hub và khung giờ |
| **Expected results** | Bản ghi giữ chỗ của student1 chuyển sang EXPIRED · student1 nhận thông báo giữ chỗ đã hết hạn · BKU-06 hiển thị trống trở lại trong kết quả tìm kiếm của student2 |
| **Result** | |
| **Comments** | |

### TC-UC05-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-01 |
| **Test Items** | UC05 – trả xe tại Hub đã hết chỗ |
| **Pre-condition** | student1 đang có chuyến đi ACTIVE với một xe dùng chung; mọi vị trí IN_SERVICE của Hub KTX Khu B đều đang có xe hoặc đã được giữ |
| **Test Data** | student1, Hub KTX Khu B |
| **Test Steps** | 1. student1 mở màn hình Chuyến đi, chọn Trả xe<br>2. Chọn Hub KTX Khu B làm nơi trả |
| **Expected results** | Hệ thống báo Hub đã hết chỗ và gợi ý chọn Hub khác · Chuyến đi vẫn ACTIVE, xe không bị khóa, không có vị trí nào bị phân bổ |
| **Result** | |
| **Comments** | |
