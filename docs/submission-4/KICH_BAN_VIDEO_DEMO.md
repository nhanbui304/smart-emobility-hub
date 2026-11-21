# Kịch bản quay Video Demo MVP — Smart E-Mobility Hub (Nhóm 17)

- **Thời lượng mục tiêu:** 5 phút 30 giây – 6 phút 30 giây
- **Độ phân giải khuyến nghị:** 1920×1080 (Full HD), zoom trình duyệt 100%
- **Công cụ quay nhanh trên Windows:** `Win + Alt + R` (Xbox Game Bar) hoặc OBS Studio
- **Chuẩn bị trước khi bấm quay:**
  1. Chạy `npm run db:reset` để dữ liệu về trạng thái mẫu sạch nhất (5 Hub, 50 xe, 100 chỗ đỗ, 20 cổng sạc).
  2. Chạy `npm run dev` và mở sẵn trình duyệt tại `http://localhost:5173`.
  3. Chuẩn bị 3 tài khoản demo:
     - Sinh viên 1 (đặt xe, đỗ xe, sạc xe): `student1@hub.local` / `student123`
     - Sinh viên 2 (có sẵn chuyến đi đang diễn ra để demo trả xe): `student2@hub.local` / `student123`
     - Nhân viên vận hành (Operator): `operator@hub.local` / `operator123`

---

## Phần 1: Giới thiệu & Đăng nhập (00:00 – 00:35)

- **Màn hình:** Trang Đăng nhập (`/login`)
- **Thao tác:**
  1. Hiện màn hình đăng nhập sạch đẹp.
  2. Nhập `student1@hub.local` / `student123` → bấm **Đăng nhập**.
- **Lời thoại gợi ý:**
  > "Xin chào thầy/cô, em đại diện Nhóm 17 xin trình bày bản demo MVP hệ thống **Smart E-Mobility Hub** hỗ trợ thuê xe điện dùng chung, đặt chỗ đỗ và quản lý sạc thông minh tại Khu đô thị ĐHQG-HCM. Trước tiên, em đăng nhập bằng tài khoản sinh viên Nguyễn Văn An."

---

## Phần 2: Luồng Sinh viên — Tìm Hub, Đặt & Nhận xe (00:35 – 02:15)

### 2.1. Khám phá bản đồ ĐHQG-HCM & Tìm phương án (UC01)
- **Màn hình:** Trang chủ (`/student`)
- **Thao tác:**
  1. Trỏ chuột vào các pin trên bản đồ thật ĐHQG-HCM (*Ga Metro ĐHQG, ĐH Bách Khoa, Thư viện Trung tâm, ĐH KHTN, KTX Khu B*).
  2. Bấm chọn pin **ĐH Bách Khoa** → cho thấy thẻ chi tiết bên phải cập nhật số xe sẵn sàng, chỗ trống, cổng sạc và 3 xe pin cao nhất kèm biển số.
  3. Mở khung **Tìm xe thuê (UC01)**, chọn loại xe / pin tối thiểu → bấm **Tìm phương án** → bấm **Chọn xe**.
- **Lời thoại gợi ý:**
  > "Ngay tại Trang chủ là bản đồ thực tế ĐHQG-HCM hiển thị trực tiếp trạng thái 5 Mobility Hub, tự động đồng bộ mỗi 3 giây. Sinh viên có thể bấm vào từng Hub trên bản đồ để xem xe pin cao nhất kèm biển số, hoặc dùng chức năng Tìm phương án theo loại xe và mức pin tối thiểu."

### 2.2. Đặt xe & Mở khóa nhận xe (UC02, UC03, UC04)
- **Màn hình:** Đặt xe tại Hub (`/student/hubs/:hubId/reserve`) → Chuyến đi (`/student/trips`)
- **Thao tác:**
  1. Chọn 1 xe → xem màn hình xác nhận (biển số, % pin, hạn giữ xe 15 phút) → bấm **Xác nhận đặt xe**.
  2. Chuyển sang **Chuyến đi** (`/student/trips`): cho thấy thẻ xe đã đặt có **biển số xe**, thanh pin và đồng hồ đếm ngược.
  3. Bấm **Nhận xe** → **Mở khóa và nhận xe** → chuyển sang trạng thái **Đang trong chuyến đi**.
- **Lời thoại gợi ý:**
  > "Sau khi xác nhận đặt xe, hệ thống giữ xe trong 15 phút với cơ chế chống đặt trùng giao dịch. Tại trang Chuyến đi, sinh viên đối chiếu đúng biển số trên thân xe, bấm Mở khóa để bắt đầu hành trình."

### 2.3. Trả xe tại Hub đích (UC05)
- **Màn hình:** Chuyến đi (`/student/trips`) *(tiếp tục luôn trên chuyến vừa nhận, hoặc đăng nhập `student2@hub.local` nếu muốn demo tách riêng)*
- **Thao tác:**
  1. Chọn Hub trả xe (vd: **Ga Metro ĐHQG**) → bấm **Chuẩn bị trả xe** (hệ thống tự cấp 1 ô đỗ trống).
  2. Bấm **Xác nhận trả xe & khóa xe** → hiện kết quả trả xe thành công.
- **Lời thoại gợi ý:**
  > "Khi đến Hub đích, sinh viên yêu cầu trả xe. Hệ thống tự phân bổ vị trí đỗ trống, gửi lệnh khóa xe an toàn và kết thúc chuyến đi."

---

## Phần 3: Luồng Sinh viên — Xe cá nhân: Đỗ xe & Sạc xe (02:15 – 03:45)

- **Màn hình:** Xe của tôi (`/student/my-vehicle`) & Sạc ngay (`/student/charging-request`)
- **Thao tác:**
  1. **UC06 — Đặt chỗ đỗ:** Chọn Hub, xe cá nhân (`59-X1 123.45`), khung giờ → **Tìm vị trí trống** → chọn ô → **Giữ chỗ tạm** (hiện đếm ngược) → **Xác nhận đặt chỗ**.
  2. **UC08 — Đặt lịch sạc:** Chọn Hub, khung giờ, % pin → **Tìm khung giờ sạc phù hợp** → chọn cổng → **Xác nhận đặt lịch**.
  3. **UC09 — Quản lý lịch sạc:** Xem lịch sạc vừa tạo hoặc lịch mẫu → bấm **Đổi khung giờ** (hoặc **Hủy lịch sạc**).
  4. **UC07 — Sạc ngay tại Hub:** Bấm **Sạc ngay →** sang `/student/charging-request` → bấm **Kiểm tra khả năng sạc ngay** → **Xác nhận nhận cổng sạc**.
  5. Bật nhanh **Cài đặt** (`/student/settings`) chuyển **Giao diện Sáng ↔ Tối** (cho thấy bản đồ và toàn bộ giao diện đổi mượt mà).
- **Lời thoại gợi ý:**
  > "Với xe điện cá nhân, sinh viên có thể giữ trước ô đỗ theo cơ chế giữ tạm chống tranh chấp, đặt lịch sạc trước hoặc yêu cầu sạc ngay tại Hub, đồng thời đổi hoặc hủy lịch linh hoạt. Ứng dụng cũng hỗ trợ đầy đủ chế độ Sáng và Tối."

---

## Phần 4: Luồng Nhân viên vận hành — Operator Console (03:45 – 05:45)

- **Thao tác:** Đăng xuất `student1` → đăng nhập `operator@hub.local` / `operator123`.

### 4.1. Giám sát mạng lưới & Cảnh báo theo thời gian thực (UC10)
- **Màn hình:** Giám sát mạng lưới (`/operator/monitoring`)
- **Thao tác:**
  1. Chỉ 4 thẻ KPI tổng quan, **Bản đồ mạng lưới 5 Hub ĐHQG-HCM** (Hub có cảnh báo hiện nổi bật màu vàng), và khu vực **Cảnh báo vận hành**.
  2. Bấm trực tiếp vào 1 Hub trên bản đồ → mở bảng chi tiết phương tiện & đặt chỗ của Hub đó.
- **Lời thoại gợi ý:**
  > "Ở giao diện Nhân viên vận hành, bảng Giám sát mạng lưới cập nhật tự động mỗi 3 giây, trực quan hóa trạng thái 5 Hub trên bản đồ và tự động phát hiện cảnh báo thiếu xe, sắp đầy chỗ hoặc tài nguyên lỗi."

### 4.2. Điều phối lịch sạc thông minh & Xử lý sự cố (UC13 & UC11)
- **Màn hình:** Lịch sạc và sự cố (`/operator/charging-incidents`)
- **Thao tác:**
  1. Bên trái (UC13): cho thấy danh sách yêu cầu sạc / lịch sạc đang chờ và thao tác điều phối cổng sạc.
  2. Bên phải (UC11): chọn 1 tài nguyên → ghi nhận sự cố → xem các đặt chỗ bị ảnh hưởng & phương án xử lý → đóng sự cố.
- **Lời thoại gợi ý:**
  > "Tại trang Lịch sạc và sự cố, nhân viên có thể điều phối cổng sạc thông minh khi quá tải và xử lý sự cố tài nguyên có kiểm soát xung đột phiên bản, tự động bảo vệ các lượt đặt xe đang hiệu lực."

### 4.3. Điều chuyển xe giữa các Hub (UC12)
- **Màn hình:** Điều chuyển xe (`/operator/redistribution`)
- **Thao tác:**
  1. Chọn Hub nguồn (nhiều xe) và Hub đích (thiếu xe) → chọn xe cần chuyển → tạo lệnh điều chuyển → xác nhận xuất phát & tiếp nhận.
- **Lời thoại gợi ý:**
  > "Khi một Hub thiếu xe, nhân viên tạo lệnh điều chuyển xe từ Hub dư sang Hub thiếu. Sức chứa tại Hub đích được giữ trước đồng bộ với luồng trả xe và đặt chỗ đỗ."

### 4.4. Mô phỏng What-if (UC14)
- **Màn hình:** Mô phỏng What-if (`/operator/simulation`)
- **Thao tác:**
  1. Chọn kịch bản (vd: tăng nhu cầu giờ cao điểm + điều chỉnh phân bổ xe/cổng sạc) → bấm **Chạy mô phỏng** → chỉ bảng so sánh KPI Trước / Sau và khuyến nghị.
- **Lời thoại gợi ý:**
  > "Cuối cùng là công cụ Mô phỏng What-if, cho phép nhân viên vận hành giả lập kịch bản tăng nhu cầu hoặc thay đổi tài nguyên trên bản chụp dữ liệu hiện tại để đánh giá trước hiệu quả trước khi áp dụng ngoài thực tế."

---

## Phần 5: Kết thúc (05:45 – 06:00)

- **Lời thoại gợi ý:**
  > "Trên đây là toàn bộ luồng hoạt động MVP của hệ thống Smart E-Mobility Hub với đầy đủ 14 Use Cases theo kiến trúc 4 tầng từ Submission 3. Cảm ơn thầy/cô đã theo dõi!"
