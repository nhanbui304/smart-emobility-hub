# Subsystem Xe dùng chung – Lê Quốc Linh

## Mô tả method

### ReservationService.confirmReservation

| Mục | Nội dung |
| --- | --- |
| **Class** | ReservationService |
| **Method** | `confirmReservation(requestId: String, studentId: String, hubId: String, vehicleId: String): VehicleReservation` |
| **Mô tả** | Xác nhận đặt xe dùng chung tại Hub đã chọn (UC02). Service kiểm tra yêu cầu đã được xử lý chưa (`findProcessedRequest`), kiểm tra lại xe còn khả dụng và sinh viên có đủ điều kiện đặt xe hay không, sau đó gọi thao tác ghi dữ liệu nguyên tử để tạo lượt đặt và giữ xe. Việc kiểm tra trạng thái và cập nhật được thực hiện trong cùng một transaction để tránh hai sinh viên đặt thành công cùng một xe. |
| **Tham số** | `requestId`: mã của lần bấm xác nhận · `studentId`: sinh viên đang đăng nhập, lấy từ phiên · `hubId`: Hub có xe được chọn · `vehicleId`: xe dùng chung cần đặt |
| **Kết quả trả về** | `VehicleReservation` chứa thông tin lượt đặt xe vừa được tạo hoặc kết quả đã ghi nhận của yêu cầu trước đó. |
| **Tiền điều kiện** | Sinh viên đã đăng nhập, đang xem xe khả dụng tại Hub, xe được chọn còn khả dụng và sinh viên chưa có lượt đặt xe khác còn hiệu lực. |
| **Hậu điều kiện** | Lượt đặt xe được tạo ở trạng thái `RESERVED`, xe được giữ cho sinh viên đến thời hạn nhận xe. `requestId` được ghi nhận để tránh xử lý lặp. |
| **Ngoại lệ** | Gửi lặp cùng `requestId`: trả lại lượt đặt đã ghi nhận, không tạo thêm · Xe vừa được sinh viên khác đặt: thông báo xe không còn khả dụng, không tạo lượt đặt thứ hai · Sinh viên đã có lượt đặt còn hiệu lực: không tạo lượt đặt mới · Lưu thất bại: không để lại lượt đặt hoặc trạng thái xe cập nhật một phần. |

### PickUpService.confirmPickUp

| Mục | Nội dung |
| --- | --- |
| **Class** | PickUpService |
| **Method** | `confirmPickUp(requestId: String, studentId: String, reservationId: String): PickUpResult` |
| **Mô tả** | Xác nhận sinh viên nhận xe theo lượt đặt đã có (UC04). Service kiểm tra yêu cầu gửi lặp, xác minh lượt đặt thuộc sinh viên và còn hiệu lực, sau đó gửi lệnh mở khóa xe thông qua `VehicleSimulator`. Khi mở khóa thành công, hệ thống ghi nhận nhận xe và bắt đầu chuyến đi. |
| **Tham số** | `requestId`: mã của lần bấm xác nhận nhận xe · `studentId`: sinh viên đang đăng nhập, lấy từ phiên · `reservationId`: lượt đặt xe được dùng để nhận xe |
| **Kết quả trả về** | `PickUpResult` thể hiện kết quả nhận xe và thông tin liên quan đến lượt đặt hoặc chuyến đi. |
| **Tiền điều kiện** | Sinh viên đã đăng nhập, lượt đặt tồn tại, thuộc sinh viên và còn hiệu lực, xe có thể thực hiện thao tác mở khóa. |
| **Hậu điều kiện** | Mở khóa thành công: hệ thống ghi nhận sinh viên đã nhận xe, bắt đầu chuyến đi và cập nhật trạng thái lượt đặt, xe. `requestId` được ghi nhận để tránh xử lý lặp. |
| **Ngoại lệ** | Gửi lặp cùng `requestId`: trả lại kết quả đã ghi nhận, không gửi lệnh mở khóa lần nữa · Lượt đặt không tồn tại, không thuộc sinh viên hoặc đã hết hiệu lực: từ chối nhận xe · Simulator báo mở khóa thất bại: không bắt đầu chuyến đi, thông báo lỗi và giữ dữ liệu nhất quán · Không xác định được kết quả mở khóa: ghi nhận chờ xác minh, không xác nhận nhận xe thành công. |

## Test case

Dữ liệu dùng theo dữ liệu mẫu của nhóm: tài khoản `student1`, `student2`, xe `EB-001`, Hub ĐH Bách Khoa và Hub KTX Khu B. Mã dữ liệu cụ thể được thay theo seed chính thức của nhóm nếu có thay đổi.

### TC-UC02-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC02-01 |
| **Test Items** | UC02 – sinh viên đặt thành công một xe dùng chung đang khả dụng |
| **Pre-condition** | student1 đã đăng nhập, chưa có lượt đặt xe còn hiệu lực. Xe EB-001 đang khả dụng tại Hub ĐH Bách Khoa. |
| **Test Data** | student1, Hub ĐH Bách Khoa, xe EB-001 |
| **Test Steps** | 1. student1 mở danh sách xe tại Hub ĐH Bách Khoa<br>2. Chọn xe EB-001 và xem thông tin đặt xe<br>3. Xác nhận đặt xe |
| **Expected results** | student1 đặt xe thành công. Hệ thống tạo lượt đặt ở trạng thái RESERVED và giữ xe EB-001 cho lượt đặt đó. Xe không còn hiển thị là xe khả dụng để sinh viên khác đặt. |
| **Result** | |
| **Comments** | Sub #1 UC02 – luồng chính. |

### TC-UC02-02

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC02-02 |
| **Test Items** | UC02 – hai sinh viên xác nhận đặt cùng một xe |
| **Pre-condition** | student1 và student2 đã đăng nhập, đều chưa có lượt đặt xe còn hiệu lực. Xe EB-001 đang khả dụng tại Hub ĐH Bách Khoa. |
| **Test Data** | student1, student2, xe EB-001, Hub ĐH Bách Khoa |
| **Test Steps** | 1. student1 chọn xe EB-001 và xác nhận đặt xe<br>2. Ngay sau đó, student2 cũng xác nhận đặt xe EB-001 |
| **Expected results** | student1 đặt xe thành công, student2 nhận thông báo xe đã được đặt và danh sách xe được cập nhật. Không tồn tại hai lượt đặt còn hiệu lực cho cùng xe. |
| **Result** | |
| **Comments** | Sub #1 UC02 – tình huống hai sinh viên đặt cùng xe trong phạm vi MVP. |

### TC-UC03-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC03-01 |
| **Test Items** | UC03 – sinh viên hủy lượt đặt xe còn hiệu lực |
| **Pre-condition** | student1 đã đăng nhập và có một lượt đặt xe ở trạng thái RESERVED, chưa nhận xe. |
| **Test Data** | student1, mã lượt đặt xe hợp lệ |
| **Test Steps** | 1. student1 mở danh sách lượt đặt của mình<br>2. Chọn lượt đặt xe đang ở trạng thái RESERVED<br>3. Chọn Hủy đặt xe và xác nhận thao tác |
| **Expected results** | Hệ thống hủy lượt đặt xe và cập nhật trạng thái tương ứng. Xe được giải phóng để có thể được đặt bởi sinh viên khác nếu vẫn đáp ứng điều kiện khả dụng. |
| **Result** | |
| **Comments** | Sub #1 UC03 – luồng chính. |

### TC-UC04-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC04-01 |
| **Test Items** | UC04 – sinh viên nhận xe thành công bằng simulator |
| **Pre-condition** | student1 đã đăng nhập và có lượt đặt xe còn hiệu lực ở trạng thái RESERVED. Simulator sẵn sàng phản hồi mở khóa thành công. |
| **Test Data** | student1, mã lượt đặt xe hợp lệ, kết quả simulator = thành công |
| **Test Steps** | 1. student1 mở lượt đặt xe cần nhận<br>2. Chọn Nhận xe và xác nhận thao tác<br>3. Hệ thống gửi lệnh mở khóa đến simulator |
| **Expected results** | Simulator trả kết quả mở khóa thành công. Hệ thống ghi nhận sinh viên đã nhận xe, bắt đầu chuyến đi và cập nhật trạng thái lượt đặt, xe tương ứng. |
| **Result** | |
| **Comments** | Sub #1 UC04 – luồng chính, phạm vi MVP yêu cầu mở khóa bằng simulator. |

### TC-UC12-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-UC12-01 |
| **Test Items** | UC12 – Operator tạo yêu cầu điều chuyển xe giữa hai Hub |
| **Pre-condition** | Operator đã đăng nhập. Hub nguồn, Hub đích và các xe được chọn tồn tại, Hub nguồn khác Hub đích. |
| **Test Data** | Operator, một Hub nguồn, một Hub đích, danh sách xe hợp lệ |
| **Test Steps** | 1. Operator mở chức năng điều chuyển xe<br>2. Chọn Hub nguồn và Hub đích<br>3. Chọn các xe cần điều chuyển và nhập ETA nếu có<br>4. Xác nhận tạo yêu cầu điều chuyển |
| **Expected results** | Hệ thống tạo yêu cầu điều chuyển và các mục điều chuyển tương ứng với danh sách xe đã chọn. Thông tin Hub nguồn, Hub đích và ETA (nếu có) được lưu. |
| **Result** | |
| **Comments** | Sub #1 UC12 – luồng cơ bản theo phạm vi MVP. |

### TC-2.3.2-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-2.3.2-01 |
| **Test Items** | Mục 2.3.2 – xem trạng thái Hub và tài nguyên |
| **Pre-condition** | Người dùng đã đăng nhập. Hệ thống có dữ liệu Hub và trạng thái tài nguyên. |
| **Test Data** | Các Hub và tài nguyên có trong dữ liệu mẫu của nhóm |
| **Test Steps** | 1. Người dùng mở màn hình Home/Hub<br>2. Quan sát danh sách Hub và trạng thái tài nguyên<br>3. Chọn một Hub để xem thông tin chi tiết |
| **Expected results** | Hệ thống hiển thị danh sách Hub và trạng thái tài nguyên tương ứng. Khi chọn một Hub, thông tin chi tiết của Hub đó được hiển thị và khớp với dữ liệu hệ thống. |
| **Result** | |
| **Comments** | Sub #1 mục 2.3.2 – View Hub and Resource Status. |

### TC-MYRES-01

| Mục | Nội dung |
| --- | --- |
| **Test Case ID** | TC-MYRES-01 |
| **Test Items** | View My Reservations – sinh viên xem các lượt đặt của mình |
| **Pre-condition** | student1 đã đăng nhập và có ít nhất một lượt đặt được lưu trong hệ thống. |
| **Test Data** | student1, các lượt đặt thuộc tài khoản student1 |
| **Test Steps** | 1. student1 mở màn hình My Reservations<br>2. Hệ thống tải danh sách lượt đặt thuộc tài khoản đang đăng nhập<br>3. Quan sát thông tin và trạng thái các lượt đặt |
| **Expected results** | Hệ thống chỉ hiển thị các lượt đặt thuộc student1. Thông tin và trạng thái từng lượt đặt khớp với dữ liệu đã lưu, không hiển thị lượt đặt của sinh viên khác. |
| **Result** | |
| **Comments** | Sub #1 mục 2.3.2 – View My Reservations. |
