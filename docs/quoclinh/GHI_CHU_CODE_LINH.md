# Ghi chú code phần Lê Quốc Linh

## 1. Đã làm (UC02, UC03, UC04, UC12, 2.3.2, View My Reservations)
| Chức năng | Backend | Giao diện |
| --- | --- | --- |
| UC02 Đặt xe | `ReservationService` + `ReservationRepository` | `ReserveVehiclePage` |
| UC03 Hủy đặt xe | `ReservationService` + `ReservationRepository` | `VehicleReservationPanel` (trong tab Chuyến đi) |
| UC04 Nhận xe | `PickUpService` + `PickUpRepository` (gọi `vehicleSimulator.requestUnlock`) | `VehicleReservationPanel` |
| UC12 Điều chuyển | `RedistributionService` + `RedistributionRepository` | `RedistributionPage` (Operator) |
| 2.3.2 Hết hạn nhận xe | `ReservationExpiryScheduler` (+ kiểm tra hạn ngay lúc nhận xe) | đếm ngược hạn nhận xe |
| View My Reservations | `MyReservationsService` + `MyReservationsRepository` | `MyReservationsPage` |

## 2. Chỗ khác sơ đồ Sub #3 (cần ghi vào báo cáo cuối / báo nhóm)
1. `RequestOperation` thêm 6 giá trị (`constants.ts`): `CANCEL_VEHICLE_RESERVATION`, `CREATE_REDISTRIBUTION_ORDER`, `CONFIRM_REDISTRIBUTION_DEPARTURE`, `CONFIRM_REDISTRIBUTION_ARRIVAL`, `CANCEL_REDISTRIBUTION_ITEMS`, `CLOSE_REDISTRIBUTION_ORDER` (UC03, UC12 cần chống gửi lặp nhưng enum cũ chưa có).
2. `PickUpRepository` thêm `findTripByReservation(reservationId): Trip [0..1]` để trả lại chuyến đi khi gửi lặp / mất kết nối (UC04 9a).
3. `RedistributionRepository`/`RedistributionService` trả `RedistributionOrder` kèm `items` (kiểu con) để giao diện hiện tiến độ từng xe.
4. `markReservationAffected` (UC04 4b): đặt xe chuyển CANCELLED do hệ thống; xe về AVAILABLE nếu còn RESERVED.
5. Sau khi nhận xe: `shared_vehicles.hubId = null`, `slotId = null` (xe rời Hub, giải phóng chỗ). Khi điều chuyển: xe IN_TRANSIT cũng `hubId = slotId = null`, tới nơi gán Hub đích + vị trí trống. **Quang Nhân (UC05) cần gán lại hubId/slotId khi trả xe.**
6. `ReservationExpiryScheduler` truy vấn trực tiếp danh sách đặt xe quá hạn (sơ đồ không có repo cho việc này). Thông báo sinh viên hiện chỉ ghi log vì `NotificationService` (Hoàng Nhân) chưa có method gửi cho sinh viên.
7. Cảnh báo Operator (UC04 4b/7b/8a) gọi `notificationService.notifyOperator` kiểu best-effort: Hoàng Nhân chưa làm thì bỏ qua, không làm lỗi UC04.
8. Bản ghi `processed_requests` của UC12 (depart/arrive/cancel/close) lưu `actorId` = người tạo lệnh.
9. Giao diện UC12 lưu danh sách lệnh trong `sessionStorage` (chưa có API liệt kê lệnh); đóng tab thì mất danh sách.

## 3. File dùng chung đã sửa (chỉ thêm dòng)
`server/src/constants.ts` (mục 1) · `client/src/statusLabels.ts` (`PENDING`, `ARRIVED`) · `client/src/components/StatusBadge.tsx` (màu `PENDING`, `ARRIVED`) · `client/src/pages/student/ActiveTripPage.tsx` (Linh làm phần đặt xe/nhận xe, Quang Nhân thêm UC05 vào chỗ có StubNotice). File mới: `client/src/utils/requestId.ts`, `client/src/utils/activeTrip.ts`, `client/src/pages/student/VehicleReservationPanel.tsx`.

## 4. Cách thử nhanh (sau `npm install` và `npm run db:reset`, `npm run dev`)
Tài khoản: `student1@hub.local` / `student123`, `student2@hub.local` / `student123`, `operator@hub.local` / `operator123`.
- **UC02**: student1 → Trang chủ → "Đặt xe" ở một Hub → Chọn xe → Xác nhận. Mở student2 ở cửa sổ ẩn danh, chọn đúng xe đó rồi xác nhận sau → báo xe vừa được đặt.
- **UC03**: tab Chuyến đi → "Hủy đặt xe" → xác nhận; xe lại xuất hiện trong danh sách đặt xe.
- **UC04**: tab Chuyến đi → "Nhận xe" → "Mở khóa và nhận xe". Simulator thành công 90%: thử vài lần để gặp FAILED / UNKNOWN.
- **2.3.2**: đổi `pickupDeadlineMinutes` trong `server/src/config/systemConfig.ts` thành `1`, đặt xe, chờ hết 1 phút: nút Nhận xe bị khóa/từ chối, tối đa 15 giây sau đặt xe biến mất và xe AVAILABLE lại (nhớ trả về 30).
- **View My Reservations**: Trang chủ → "Đặt chỗ của tôi".
- **UC12**: Operator → Điều chuyển xe → chọn 2 Hub, xem phương án, chọn xe, xác nhận → "Đã rời Hub nguồn" → "Đã tới Hub đích" → "Đóng lệnh". Thử "Hủy các xe chưa xuất phát".
