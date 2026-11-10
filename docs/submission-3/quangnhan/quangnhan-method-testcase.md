# Subsystem Tài khoản và Đỗ xe – Bùi Quang Nhân

Nội dung để dán vào báo cáo Submission #3, đặt dưới hình class diagram của subsystem.
Hình: `class-tai-khoan-do-xe.drawio` (trang "Tai khoan" và trang "Do xe va tra xe").

## Mô tả method

Chữ ký method theo code sau khi khớp Sequence Submission #2 (Hình 2.26–2.29 UC06, Hình 2.35–2.37 UC05). Các method ghi dữ liệu đều nhận `requestId`: client sinh mã này (`crypto.randomUUID()`) cho mỗi lần bấm xác nhận và gửi lại đúng mã đó khi thử lại, nên yêu cầu gửi lặp chỉ được xử lý một lần.

### ParkingService.holdSlot

| Mục | Nội dung |
| --- | --- |
| **Class** | ParkingService |
| **Method** | `holdSlot(requestId: String, studentId: String, slotId: String, vehicleId: String, timeRange: TimeRange): ParkingAllocation` |
| **Mô tả** | Giữ tạm một vị trí đỗ cho xe của sinh viên trong khung giờ đã chọn, để sinh viên có thời gian xác nhận (UC06 bước 4–6). Service kiểm tra lại điều kiện (recheckReservationConditions), tính hạn giữ (computeHoldDeadline), rồi gọi `ParkingRepository.atomicCheckAndHold`: kiểm tra gửi lặp, vị trí còn trống, sinh viên chưa có lượt giữ khác, vị trí không bị hạn chế do sự cố và tạo bản ghi, tất cả trong một transaction. Vì vậy hai sinh viên chọn cùng vị trí cùng lúc thì chỉ một người giữ được. |
| **Tham số** | `requestId`: mã yêu cầu do client sinh · `studentId`: sinh viên đang đăng nhập (lấy từ phiên) · `slotId`: vị trí đỗ được chọn · `vehicleId`: xe cá nhân của sinh viên · `timeRange`: thời điểm bắt đầu và kết thúc đỗ |
| **Kết quả trả về** | Bản ghi `ParkingAllocation` ở trạng thái HELD; `id` của bản ghi dùng làm `holdToken` cho bước xác nhận |
| **Tiền điều kiện** | Sinh viên đã đăng nhập; xe thuộc sinh viên; Hub tiếp nhận loại xe; vị trí đang IN_SERVICE; `now < startTime < endTime`; sinh viên chưa có lượt giữ tạm nào còn hạn |
| **Hậu điều kiện** | Có bản ghi HELD với `holdExpiresAt = min(now + parkingHoldMinutes, startTime)` (giữ tối đa 30 phút, không quá giờ bắt đầu đỗ, không gia hạn); vị trí không còn hiển thị trống trong khung giờ đó; `requestId` được ghi vào `ProcessedRequest`. Lượt giữ đã quá `holdExpiresAt` không được tính là chồng lấn, kể cả khi `HoldExpiryScheduler` chưa kịp chuyển nó sang EXPIRED |
| **Ngoại lệ** | `requestId` đã xử lý → trả lại lượt giữ cũ, không tạo thêm (Ext 8d) · Vị trí đã được giữ hoặc đặt trong khung giờ chồng lấn → `CONFLICT` kèm danh sách vị trí cập nhật (Ext 5a) · Vị trí vừa bị hạn chế do sự cố → `CONFLICT` kèm danh sách cập nhật · Sinh viên đang có một lượt giữ còn hạn → `CONFLICT` kèm lượt giữ hiện có (Ext 5b) · Xe không thuộc sinh viên → `FORBIDDEN` · Khung giờ sai hoặc đã bắt đầu → `VALIDATION_ERROR` (Ext 5c) · Ghi thất bại → không để lại phân bổ một phần (Ext 5d) |

### ParkingService.confirmReservation

| Mục | Nội dung |
| --- | --- |
| **Class** | ParkingService |
| **Method** | `confirmReservation(requestId: String, studentId: String, holdToken: String): ParkingBooking` |
| **Mô tả** | Chuyển lượt giữ tạm thành đặt chỗ đã xác nhận (UC06 bước 7–9) bằng `ParkingRepository.atomicConfirmHold` trên CÙNG bản ghi: kiểm tra gửi lặp, chủ sở hữu, hạn giữ và điều kiện phục vụ của Hub / vị trí trong một transaction |
| **Tham số** | `requestId`: mã yêu cầu · `studentId`: sinh viên đang đăng nhập · `holdToken`: `id` của lượt giữ |
| **Kết quả trả về** | `ParkingBooking` gồm bản ghi đã CONFIRMED, `hubId`, mã vị trí và điều kiện khi đến (`arrivalConditions`) |
| **Tiền điều kiện** | Lượt giữ thuộc sinh viên, đang HELD và `now < holdExpiresAt` |
| **Hậu điều kiện** | Bản ghi chuyển HELD → CONFIRMED, không tạo bản ghi thứ hai; đặt chỗ vẫn giữ nguyên nếu sinh viên mất kết nối sau đó (Ext 9a) |
| **Ngoại lệ** | `requestId` đã xử lý → trả lại đặt chỗ cũ (Ext 8d) · Lượt giữ hết hạn hoặc không thuộc sinh viên → `CONFLICT`; nếu đã quá hạn thì đánh dấu EXPIRED và giải phóng (Ext 8a) · Vị trí / Hub vừa ngừng phục vụ → `CONFLICT`, lượt giữ kết thúc, gợi ý phương án khác (Ext 8b) · Ghi thất bại → không tạo đặt chỗ một phần; lượt giữ còn hạn thì giữ nguyên để thử lại (Ext 8c) |

### ReturnService.prepareReturn

| Mục | Nội dung |
| --- | --- |
| **Class** | ReturnService |
| **Method** | `prepareReturn(requestId: String, studentId: String, tripId: String, hubId: String): ReturnPreparation` |
| **Mô tả** | Kiểm tra chuyến đi và phân bổ chỗ trả xe tại Hub sinh viên chọn (UC05 bước 1–4). Service đọc chuyến đi (`findTripForReturn`), kiểm tra (validateTripForReturn), đọc bối cảnh Hub (`queryHubReturnContext`: Hub có tiếp nhận không, đặt chỗ đã xác nhận phù hợp, chỗ còn trống), chọn chỗ (selectReturnSlot) rồi phân bổ bằng `atomicAllocateReturnSlot` |
| **Tham số** | `requestId`: mã yêu cầu · `studentId`: sinh viên đang đăng nhập · `tripId`: chuyến đi đang ACTIVE · `hubId`: Hub trả xe |
| **Kết quả trả về** | `ReturnPreparation` gồm chuyến đi, bản ghi phân bổ chỗ trả và mã vị trí để hướng dẫn đỗ |
| **Tiền điều kiện** | Chuyến đi thuộc sinh viên và đang ACTIVE; không còn yêu cầu sạc chưa xử lý cho xe |
| **Hậu điều kiện** | Có đúng một chỗ trả được giữ cho chuyến đi (dùng đặt chỗ đã xác nhận nếu có, không dùng lượt giữ tạm chưa xác nhận); chuyến đi RETURN_IN_PROGRESS |
| **Ngoại lệ** | `requestId` đã xử lý → trả lại phân bổ cũ · Chuyến đi không tồn tại hoặc không thuộc sinh viên → `NOT_FOUND` (Ext 2a) · Chuyến đi đã kết thúc → trả kết quả đã ghi (Ext 2b) · Xe không khớp chuyến đi → `CONFLICT` (Ext 2c) · Còn yêu cầu sạc chưa xử lý → `CONFLICT` kèm hướng dẫn (Ext 2d) · Hub không tiếp nhận / hết chỗ → `CONFLICT` kèm Hub thay thế (Ext 3a) · Không xác minh được trạng thái Hub → `CONFLICT` (Ext 3b) · Chỗ đã đặt bị sự cố và không có chỗ thay thế → báo Operator (`notifyOperator`), sinh viên chờ hỗ trợ (Ext 3c) · Chỗ vừa bị phân bổ cho người khác → chọn chỗ khác (Ext 4a) |

### ReturnService.confirmReturn

| Mục | Nội dung |
| --- | --- |
| **Class** | ReturnService |
| **Method** | `confirmReturn(requestId: String, studentId: String, tripId: String): ReturnResult` |
| **Mô tả** | Hoàn tất việc trả xe dùng chung (UC05 bước 5–9). Service tải bối cảnh bàn giao (`findReturnHandoverContext`), đọc vị trí xe (`VehicleSimulator.readVehiclePosition`) và kiểm tra xe đỗ đúng Hub / chỗ (verifyVehicleHubAndSlot), ghi nhận đang bàn giao (`markHandoverInProgress`), gửi lệnh khóa (`VehicleSimulator.sendLockCommand`, ngoài transaction), rồi cập nhật dữ liệu theo kết quả khóa |
| **Tham số** | `requestId`: mã yêu cầu · `studentId`: sinh viên đang đăng nhập · `tripId`: chuyến đi đang trả xe |
| **Kết quả trả về** | `ReturnResult` gồm kết quả khóa (SUCCESS / FAILED / UNKNOWN), chuyến đi sau khi cập nhật, thời điểm trả, Hub và vị trí; `pendingReconciliation = true` nếu đã bàn giao nhưng ghi nhận thất bại |
| **Tiền điều kiện** | Chuyến đi thuộc sinh viên và đang RETURN_IN_PROGRESS, tức là đã gọi `prepareReturn` và được phân bổ chỗ trả |
| **Hậu điều kiện** | **SUCCESS**: `atomicCompleteReturn` trong một transaction: chuyến đi ENDED, ghi thời điểm trả; xe được gán Hub và vị trí mới; đặt chỗ dùng để trả (nếu có) chuyển USED; trạng thái xe xác định từ `LockResult` (determineVehicleServiceStatus, Sub #1 bước 9a): bình thường → AVAILABLE · pin dưới `reservableBatteryThreshold` hoặc `techStatus = FAULT` → UNDER_MAINTENANCE · chưa rõ tình trạng → PENDING_VERIFICATION. Hai trường hợp sau chuyến đi vẫn kết thúc nhưng xe không được cấp lại · **FAILED** (Ext 7a): `recordLockFailure` ghi nhận lần thất bại; chuyến đi vẫn RETURN_IN_PROGRESS, giữ nguyên chỗ, xe chưa được cấp lại; sinh viên thử lại hoặc liên hệ Operator · **UNKNOWN** (Ext 7b): `markPendingVerification`: chuyến đi PENDING_RECONCILIATION, xe PENDING_VERIFICATION, Operator nhận cảnh báo (`notifyOperator`); không cấp lại xe, không giải phóng chỗ |
| **Ngoại lệ** | `requestId` đã xử lý → trả lại trạng thái cũ, không gửi lệnh khóa lần nữa (Ext 6b) · Chuyến đi không thuộc sinh viên hoặc chưa có chỗ trả → `NOT_FOUND` / `CONFLICT` · Xe đỗ sai Hub / chỗ → `CONFLICT` kèm hướng dẫn, không khóa xe (Ext 6a) · Khóa thành công nhưng ghi nhận thất bại → `saveHandoverForReconciliation` + báo Operator; chuyến đi chờ đối soát, không cấp xe cho người khác (Ext 8a) |

### ReturnService.abandonReturn

| Mục | Nội dung |
| --- | --- |
| **Class** | ReturnService |
| **Method** | `abandonReturn(requestId: String, studentId: String, tripId: String): Trip` |
| **Mô tả** | Sinh viên dừng việc trả xe trước khi bàn giao (UC05 Ext 5a). Service đọc vị trí xe: nếu xe chưa chiếm chỗ thì `releaseNewReturnAllocation` chỉ giải phóng phần phân bổ mới của lần trả này; nếu xe đang chiếm chỗ hoặc chưa rõ vị trí thì giữ nguyên chỗ |
| **Tham số** | `requestId`: mã yêu cầu · `studentId`: sinh viên đang đăng nhập · `tripId`: chuyến đi đang trả xe |
| **Kết quả trả về** | Chuyến đi sau khi cập nhật |
| **Tiền điều kiện** | Chuyến đi thuộc sinh viên, đã có chỗ trả được phân bổ, chưa xác nhận trả xe |
| **Hậu điều kiện** | Chuyến đi chưa kết thúc (về ACTIVE nếu đã giải phóng chỗ); đặt chỗ đã xác nhận trước đó (nếu có) không bị hủy |
| **Ngoại lệ** | Chuyến đi không thuộc sinh viên hoặc chưa có chỗ trả → `NOT_FOUND` / `CONFLICT` · `requestId` đã xử lý → trả lại kết quả cũ |

## Test case

> Quy ước nhóm: hệ thống chưa có trạng thái riêng "cần sạc", nên xe pin thấp sau khi trả được đặt UNDER_MAINTENANCE (tạm ngừng cấp, chờ sạc). Xe chỉ chuyển CHARGING khi thực sự được cắm sạc.

Dữ liệu dùng theo dữ liệu mẫu của hệ thống: tài khoản `student1`, `student2`; Hub ĐH Bách Khoa có vị trí `BKU-01` đến `BKU-20`; dữ liệu mẫu đã đặt xe dùng chung ở `BKU-01`–`BKU-08` và `BKU-17`–`BKU-18`, nên test dùng các vị trí trống `BKU-09` trở đi.

### TC-UC06-00

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC06-00 |
| **Test Items** | UC06 – giữ chỗ và xác nhận đặt chỗ thành công |
| **Pre-condition** | student1 đã đăng nhập, có một xe cá nhân, chưa có lượt giữ chỗ nào; vị trí BKU-09 IN_SERVICE và trống từ 8:00 đến 10:00 ngày mai |
| **Test Data** | student1, Hub ĐH Bách Khoa, BKU-09, 8:00–10:00 ngày mai |
| **Test Steps** | 1. Tìm chỗ đỗ với khung giờ trên, chọn BKU-09, bấm Giữ chỗ<br>2. Bấm Xác nhận trước khi hết hạn giữ |
| **Expected results** | Bước 1: bản ghi HELD, hiển thị thời gian giữ còn lại (30 phút) · Bước 2: cùng bản ghi chuyển CONFIRMED, xuất hiện trong danh sách đặt chỗ của student1; BKU-09 không còn trống trong khung giờ đó |
| **Result** | |
| **Comments** | |

### TC-UC06-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC06-01 |
| **Test Items** | UC06 – hai sinh viên giữ cùng một vị trí trong khung giờ chồng lấn |
| **Pre-condition** | Vị trí BKU-10 đang IN_SERVICE, chưa có ai giữ hoặc đặt từ 8:00 đến 10:00 ngày mai; student1 và student2 đã đăng nhập, mỗi người có một xe cá nhân |
| **Test Data** | student1: 8:00–10:00 · student2: 9:00–11:00 · cùng vị trí BKU-10 |
| **Test Steps** | 1. student1 tìm chỗ đỗ ở ĐH Bách Khoa, khung giờ 8:00–10:00, chọn BKU-10 và bấm Giữ chỗ<br>2. student2 tìm chỗ đỗ cùng Hub, khung giờ 9:00–11:00, chọn BKU-10 và bấm Giữ chỗ |
| **Expected results** | student1 giữ chỗ thành công · student2 nhận thông báo vị trí đã được giữ, không có bản ghi giữ chỗ thứ hai cho BKU-10 trong khung giờ đó |
| **Result** | |
| **Comments** | |

### TC-2.3.1-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-2.3.1-01 |
| **Test Items** | Mục 2.3.1 – giữ chỗ quá hạn tự giải phóng |
| **Pre-condition** | student1 đang giữ tạm vị trí BKU-11 (trạng thái HELD); thời gian giữ chỗ cấu hình là 30 phút |
| **Test Data** | student1, vị trí BKU-11 |
| **Test Steps** | 1. student1 giữ tạm BKU-11 nhưng không bấm Xác nhận<br>2. Chờ quá hạn giữ (chỉnh `parkingHoldMinutes` = 1 để thử nhanh)<br>3. Ngay sau khi quá hạn, student2 tìm chỗ đỗ ở cùng Hub và khung giờ, chọn BKU-11 và bấm Giữ chỗ<br>4. student1 bấm Xác nhận lượt giữ cũ<br>5. Chờ `HoldExpiryScheduler` chạy, kiểm tra lại bản ghi và thông báo của student1 |
| **Expected results** | **Ngay khi quá hạn (scheduler có thể chưa chạy):** BKU-11 hiển thị trống trong kết quả tìm kiếm của student2 và student2 giữ được BKU-11; student1 không xác nhận được lượt giữ cũ · **Sau khi `HoldExpiryScheduler` chạy:** bản ghi của student1 chuyển EXPIRED và student1 nhận thông báo giữ chỗ đã hết hạn |
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

### TC-UC05-02

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-02 |
| **Test Items** | UC05 – trả xe thành công, xe bình thường được cấp lại |
| **Pre-condition** | student1 đang có chuyến đi ACTIVE; Hub ĐH Bách Khoa còn vị trí trống; pin xe từ `reservableBatteryThreshold` trở lên, không có sự cố; bộ giả lập trả SUCCESS cho lệnh khóa |
| **Test Data** | student1, Hub ĐH Bách Khoa |
| **Test Steps** | 1. Mở màn hình Chuyến đi, chọn Trả xe, chọn Hub ĐH Bách Khoa<br>2. Đỗ xe vào vị trí được phân bổ, bấm Xác nhận trả xe |
| **Expected results** | Chuyến đi ENDED, có `endedAt` · Xe AVAILABLE tại vị trí mới · student2 thấy xe trong danh sách có thể đặt ở Hub ĐH Bách Khoa |
| **Result** | |
| **Comments** | |

### TC-UC05-03

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-03 |
| **Test Items** | UC05 – trả xe thành công, xe pin thấp không được cấp lại ngay |
| **Pre-condition** | student1 đang có chuyến đi ACTIVE; Hub ĐH Bách Khoa còn vị trí trống; pin xe dưới ngưỡng `reservableBatteryThreshold` trong cấu hình; bộ giả lập trả SUCCESS cho lệnh khóa |
| **Test Data** | student1, Hub ĐH Bách Khoa |
| **Test Steps** | 1. Mở màn hình Chuyến đi, chọn Trả xe, chọn Hub ĐH Bách Khoa<br>2. Đỗ xe vào vị trí được phân bổ, bấm Xác nhận trả xe |
| **Expected results** | Chuyến đi ENDED, có `endedAt` · Xe gắn với Hub và vị trí mới nhưng ở trạng thái UNDER_MAINTENANCE, không hiện trong danh sách xe có thể đặt |
| **Result** | |
| **Comments** | |

### TC-UC06-02

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC06-02 |
| **Test Items** | UC06 Ext 8d – gửi lặp yêu cầu xác nhận đặt chỗ |
| **Pre-condition** | student1 đang giữ tạm vị trí BKU-12 (HELD, còn hạn) |
| **Test Data** | student1, BKU-12, cùng một `requestId` cho hai lần gửi |
| **Test Steps** | 1. Bấm Xác nhận; giả lập mất kết nối trước khi nhận phản hồi (tắt mạng ở DevTools)<br>2. Bật lại mạng, bấm Thử lại (client gửi lại cùng `requestId`) |
| **Expected results** | Chỉ có một bản ghi cho BKU-12 và bản ghi đó CONFIRMED · Lần gửi thứ hai trả lại đúng đặt chỗ đã xác nhận, không tạo thêm bản ghi và không báo lỗi |
| **Result** | |
| **Comments** | |

### TC-UC06-03

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC06-03 |
| **Test Items** | UC06 Ext 7b – quay lại sau khi mất kết nối, lượt giữ vẫn còn |
| **Pre-condition** | student1 vừa giữ tạm vị trí BKU-13, còn khoảng 25 phút |
| **Test Data** | student1, BKU-13 |
| **Test Steps** | 1. Đóng ứng dụng<br>2. Mở lại ứng dụng, vào màn hình Đặt chỗ đỗ |
| **Expected results** | Hệ thống hiển thị lượt giữ BKU-13 với thời gian còn lại tính theo hạn ban đầu (không được cộng lại 30 phút) · Bấm Xác nhận thì đặt chỗ thành công |
| **Result** | |
| **Comments** | |

### TC-UC05-04

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-04 |
| **Test Items** | UC05 Ext 7a – khóa xe thất bại |
| **Pre-condition** | student1 đã có chỗ trả được phân bổ tại Hub ĐH Bách Khoa (chuyến đi RETURN_IN_PROGRESS); bộ giả lập trả FAILED cho lệnh khóa (để thử: tạm cho `randomResult()` trong `VehicleSimulator.ts` trả `"FAILED"`) |
| **Test Data** | student1, Hub ĐH Bách Khoa |
| **Test Steps** | 1. Đỗ xe vào chỗ được phân bổ, bấm Xác nhận trả xe |
| **Expected results** | Hệ thống báo chưa khóa được xe, cho thử lại hoặc liên hệ Operator · Chuyến đi vẫn RETURN_IN_PROGRESS, chỗ trả vẫn được giữ · Xe không xuất hiện trong danh sách xe có thể đặt |
| **Result** | |
| **Comments** | |

### TC-UC05-05

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-05 |
| **Test Items** | UC05 Ext 7b – không xác định được kết quả khóa |
| **Pre-condition** | Như TC-UC05-04, nhưng bộ giả lập trả UNKNOWN cho lệnh khóa (tạm cho `randomResult()` trả `"UNKNOWN"`) |
| **Test Data** | student1, Hub ĐH Bách Khoa |
| **Test Steps** | 1. Đỗ xe vào chỗ được phân bổ, bấm Xác nhận trả xe<br>2. Đăng nhập operator, xem cảnh báo |
| **Expected results** | Sinh viên thấy thông báo đang chờ xác minh · Chuyến đi PENDING_RECONCILIATION, xe PENDING_VERIFICATION, chỗ trả không được giải phóng · Operator có cảnh báo cần xác minh xe |
| **Result** | |
| **Comments** | |

### TC-UC05-06

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC05-06 |
| **Test Items** | UC05 Ext 5a – sinh viên dừng trả xe trước khi bàn giao |
| **Pre-condition** | student1 đã có chỗ trả được phân bổ tại Hub ĐH Bách Khoa nhưng chưa đỗ xe vào chỗ; trước đó không có đặt chỗ nào |
| **Test Data** | student1, Hub ĐH Bách Khoa |
| **Test Steps** | 1. Ở màn hình hướng dẫn đỗ, bấm Dừng trả xe |
| **Expected results** | Chỗ trả vừa phân bổ được giải phóng và hiển thị trống lại · Chuyến đi về ACTIVE, sinh viên tiếp tục sử dụng xe |
| **Result** | |
| **Comments** | |
