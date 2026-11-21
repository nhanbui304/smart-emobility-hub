# Kịch bản quay Video Demo MVP — Smart E-Mobility Hub (Nhóm 17)

- **Thời lượng mục tiêu:** 6 phút 00 giây – 7 phút 00 giây (bao phủ đủ **14/14 Use Cases + Interactive Onboarding Tour + Dark/Light Mode + Mobile Guard**)
- **Độ phân giải khuyến nghị:** 1920×1080 (Full HD), zoom trình duyệt **100%**
- **Công cụ quay nhanh trên Windows:** `Win + Alt + R` (Xbox Game Bar) hoặc **OBS Studio**

---

## 0. Checklist chuẩn bị TRƯỚC KHI BẤM QUAY (bắt buộc làm đủ)

1. **Chống lỗi thiết bị ngẫu nhiên:** Mở `server/.env`, đảm bảo dòng `SIMULATOR_DEVICE_RESULT=SUCCESS` (để lúc bấm mở khóa/khóa xe ở UC04–UC05 không bị xác suất 10% giả lập lỗi). *(Quay xong đổi lại `RANDOM` nếu muốn thử nhánh lỗi.)*
2. **Làm sạch dữ liệu mẫu:** Chạy `npm run db:reset` để DB về trạng thái chuẩn (**5 Hub ĐHQG-HCM, 50 xe, 100 chỗ đỗ, 20 cổng sạc, 3 tài khoản demo**).
3. **Khởi chạy hệ thống:** Chạy `npm run dev` và mở sẵn trình duyệt tại `http://localhost:5173`.
4. **Mẹo xử lý Onboarding Tour (Hướng dẫn tương tác lần đầu):**
   - Lần đầu mở mỗi trang sẽ tự hiện hộp **Hướng dẫn tương tác (spotlight)**.
   - **Khuyến nghị khi quay:** Ở màn hình đầu tiên (Student Trang chủ hoặc Operator Giám sát), để Tour hiện ra ~3 giây rồi bấm **`Tiếp theo →`** 1 lần để khoe tính năng hướng dẫn tự động, sau đó bấm **`Bỏ qua`** để quay mượt. *(Hoặc mở sẵn qua các trang trước khi quay rồi lúc nào muốn khoe thì bấm nút `? Hướng dẫn ...`.)*
5. **Tài khoản demo (có sẵn nút điền nhanh trên trang Đăng nhập ở chế độ dev):**
   - **Sinh viên 1:** `student1@hub.local` / `student123` *(có sẵn xe cá nhân `59-X1 123.45` + lịch sạc mẫu `cr-demo-01` lúc 10:00–11:30 ngày mai)*
   - **Sinh viên 2:** `student2@hub.local` / `student123` *(đang có sẵn chuyến đi để thử riêng UC05 nếu cần)*
   - **Nhân viên vận hành (Operator):** `operator@hub.local` / `operator123`

---

## Bảng phân bổ thời lượng tổng quan

| Phần | Thời gian | Vai trò | Use Cases bao phủ |
| --- | --- | --- | --- |
| **1. Giới thiệu & Đăng nhập** | 00:00 – 00:35 | Chung | Sign In, Demo quick-fill |
| **2. Khám phá Hub, Tìm kiếm & Đặt/Hủy/Nhận/Trả xe** | 00:35 – 02:30 | Student | View Hub Status, **UC01, UC02, UC03, UC04, UC05** |
| **3. Xe cá nhân: Đỗ xe, Lịch sạc, Sạc ngay & Theme** | 02:30 – 04:00 | Student | **UC06, UC07, UC08, UC09**, View My Reservations, Theme |
| **4. Giám sát mạng lưới & Bản đồ sự cố** | 04:00 – 04:50 | Operator | **UC10**, FR-2.3.3 |
| **5. Lịch sạc thông minh & Xử lý sự cố (2 Tab)** | 04:50 – 05:45 | Operator | **UC13, UC11** |
| **6. Điều chuyển xe & Mô phỏng What-if** | 05:45 – 06:45 | Operator | **UC12, UC14** |
| **7. Kết thúc** | 06:45 – 07:00 | Chung | Tổng kết kiến trúc & 14 UC |

---

## Phần 1: Giới thiệu & Đăng nhập (00:00 – 00:35)

- **Màn hình:** `/login`
- **Chỉ chuột & thao tác:**
  1. Dừng 2 giây cho thấy màn hình đăng nhập sạch sẽ.
  2. Bấm nút điền nhanh **Sinh viên** (ở khung *Tài khoản demo*) → bấm **Đăng nhập**.
- **Lời thoại:**
  > "Xin chào thầy/cô, em đại diện Nhóm 17 xin demo hệ thống **Smart E-Mobility Hub** — nền tảng điều phối xe điện dùng chung, chỗ đỗ và trạm sạc cho 5 Mobility Hub tại Khu đô thị ĐHQG-HCM. Hệ thống có 2 vai trò: **Sinh viên** tối ưu cho điện thoại/web và **Nhân viên vận hành** trên máy tính. Trước tiên em đăng nhập tài khoản Sinh viên Nguyễn Văn An."

---

## Phần 2: Luồng Sinh viên — Tìm Hub, Đặt, Hủy, Nhận & Trả xe (00:35 – 02:30)

### 2.1. Bản đồ 5 Hub, Hướng dẫn tương tác & Tìm phương án (`View Hub Status`, `UC01`)
- **Màn hình:** `/student`
- **Chỉ chuột & thao tác:**
  1. *(Nếu Onboarding Tour tự hiện)* Bấm **`Tiếp theo →`** 1 lần để cho thấy khung spotlight chỉ từng tính năng, rồi bấm **`Bỏ qua`**.
  2. Bấm chuyển nhanh 3 nút chế độ trên góc phải: **`Thuê xe`** → **`Đỗ xe`** → **`Sạc xe`** rồi quay về **`Thuê xe`** (cho thấy số liệu trên các pin bản đồ đổi theo).
  3. Bấm trực tiếp vào pin **ĐH Bách Khoa** trên bản đồ → chỉ vào thẻ bên phải hiển thị số xe sẵn sàng, chỗ trống, cổng sạc và **top 3 xe pin cao nhất kèm biển số**.
  4. Cuộn xuống khung **Tìm phương án phù hợp (UC01)**: chọn loại xe + mức pin tối thiểu → bấm **`Tìm phương án`** → bấm **`Chọn xe`** ở một kết quả.
- **Lời thoại:**
  > "Ngay lần đầu truy cập từng màn hình, hệ thống có sẵn **hướng dẫn tương tác từng bước** để người mới biết dùng ngay. Tại Trang chủ là bản đồ thật ĐHQG-HCM gồm 5 Hub tự động đồng bộ mỗi 3 giây. Sinh viên có thể bấm từng pin để xem top 3 xe pin cao nhất kèm biển số, hoặc dùng bộ lọc **UC01** tìm phương án theo loại xe và mức pin."

### 2.2. Đặt xe, Hủy đặt & Mở khóa nhận xe (`UC02`, `UC03`, `UC04`)
- **Màn hình:** `/student/hubs/:hubId/reserve` → `/student/trips`
- **Chỉ chuột & thao tác:**
  1. Trên danh sách xe khả dụng (pin ≥ 30%), bấm **`Chọn xe`** → màn hình xác nhận hiện biển số, % pin và hạn giữ **30 phút** → bấm **`Xác nhận đặt xe`** (**UC02**).
  2. Bấm nút xanh **`Đến trang Chuyến đi để xem xe & mở khóa`**.
  3. Tại `/student/trips`, chỉ vào đồng hồ đếm ngược 30 phút và biển số xe → bấm **`Hủy đặt xe`** → xác nhận hủy (**UC03** — cho thấy xe được giải phóng ngay!).
  4. Quay lại **Khám phá Hub** → chọn nhanh 1 xe và bấm **`Xác nhận đặt xe`** lại → sang **Chuyến đi**.
  5. Bấm **`Mở khóa và nhận xe`** (**UC04**) → trạng thái chuyển sang **Đang trong chuyến đi**.
- **Lời thoại:**
  > "Khi đặt xe ở **UC02**, hệ thống giữ xe trong **30 phút** với cơ chế transaction và chống gửi lặp `requestId`. Tại trang Chuyến đi, sinh viên có thể **hủy đặt xe (UC03)** để giải phóng xe ngay lập tức nếu đổi ý, hoặc đối chiếu biển số và bấm **Mở khóa nhận xe (UC04)** để bắt đầu hành trình."

### 2.3. Trả xe tại Hub đích (`UC05`)
- **Màn hình:** `/student/trips` *(trên chính chuyến đi vừa mở khóa)*
- **Chỉ chuột & thao tác:**
  1. Ở khối **Trả xe**, chọn Hub đích (vd: **Ga Metro ĐHQG**) → bấm **`Chuẩn bị trả xe`** (hệ thống tự cấp 1 ô đỗ thường trống, không lấy ô sạc).
  2. Bấm **`Xác nhận trả xe & khóa xe`** → hiện thông báo trả xe thành công.
- **Lời thoại:**
  > "Khi tới Hub đích, sinh viên thực hiện **UC05 — Trả xe**. Hệ thống kiểm tra và cấp riêng một vị trí đỗ trống, gửi lệnh khóa xe an toàn và kết thúc chuyến đi."

---

## Phần 3: Luồng Sinh viên — Xe cá nhân: Đỗ xe, Sạc xe & Giao diện (02:30 – 04:00)

- **Màn hình:** `/student/my-vehicle` → `/student/charging-request` → `/student/settings`
- **Chỉ chuột & thao tác:**
  1. Bấm tab **`Xe của tôi`** trên thanh menu.
  2. **UC06 — Đặt chỗ đỗ:** Chọn xe `59-X1 123.45`, Hub (vd **ĐH Bách Khoa**), khung giờ → bấm **`Tìm vị trí trống`** → chọn 1 ô → bấm **`Giữ chỗ tạm`** (chỉ vào đếm ngược giữ tạm) → bấm **`Xác nhận đặt chỗ`**.
  3. **UC08 — Đặt lịch sạc trước:** Cuộn xuống mục *Đặt lịch sạc*, chọn Hub và khung giờ *(chọn cách hiện tại > 2 giờ và **tránh khung 10:00–11:30 ngày mai** để không đụng lịch mẫu và UC07)*, nhập % pin → bấm **`Tìm khung giờ phù hợp`** → chọn cổng → bấm **`Xác nhận đặt lịch`**.
  4. **UC09 — Đổi / Hủy lịch sạc:** Cuộn xuống *Quản lý lịch sạc*, chỉ lịch vừa tạo và lịch mẫu → bấm **`Đổi lịch`** (hoặc **`Hủy lịch`**) để chứng minh cơ chế kiểm tra phiên bản (`version`).
  5. **UC07 — Sạc ngay tại Hub:** Bấm thẻ **`Sạc ngay →`** ở cuối trang sang `/student/charging-request` → bấm **`Kiểm tra khả năng sạc ngay`** → bấm **`Xác nhận nhận cổng sạc`** *(hoặc Xác nhận vào hàng đợi)*.
  6. Bấm tab **`Cài đặt`** (`/student/settings`) → bấm chuyển **`Tối`** (cho thấy toàn app chuyển Dark Mode mượt mà) → bấm lại **`Sáng`** → bấm **`Đăng xuất`**.
- **Lời thoại:**
  > "Với xe điện cá nhân tại trang **Xe của tôi**, sinh viên có thể giữ tạm và đặt chỗ đỗ (**UC06**), đặt lịch sạc trước theo đúng chuẩn đầu cắm (**UC08**), đổi hoặc hủy lịch có kiểm soát xung đột phiên bản (**UC09**), hoặc gửi yêu cầu **Sạc ngay (UC07)** để nhận cổng trống hoặc xếp hàng đợi ưu tiên pin thấp. Ngoài ra sinh viên có thể đổi giao diện **Sáng/Tối** lưu trực tiếp lên tài khoản."

---

## Phần 4: Operator — Giám sát mạng lưới & Bản đồ sự cố (04:00 – 04:50)

- **Màn hình:** `/login` → `/operator/monitoring`
- **Chỉ chuột & thao tác:**
  1. Ở `/login`, bấm nút điền nhanh **`Vận hành`** → bấm **`Đăng nhập`**.
  2. Chỉ nhanh thanh **4 thẻ KPI** trên cùng + huy hiệu **`● Live · 3s`**.
  3. **Điểm nhấn ăn điểm — Bản đồ sự cố tương tác:** Trỏ chuột vào bản đồ 5 Hub, bấm trực tiếp vào **1 pin Hub màu vàng có cảnh báo** (hoặc 1 Hub bất kỳ) → chỉ sang **khung Xem nhanh bên phải** vừa hiện ra ngay lập tức: 3 ô số liệu, cảnh báo đang mở, sự cố/xe bảo trì, và 2 nút **`Xử lý sự cố`** / **`Điều chuyển xe`**.
  4. Cuộn nhẹ xuống chỉ **Bảng tổng quan 5 Hub** (bấm vào 1 dòng để mở nhanh danh sách xe & đặt chỗ).
- **Lời thoại:**
  > "Chuyển sang vai trò **Nhân viên vận hành (Operator)** dành riêng cho màn hình máy tính. Tại **Giám sát mạng lưới (UC10)**, 4 chỉ số KPI và bản đồ 5 Hub tự làm mới mỗi 3 giây. Các Hub có cảnh báo theo ngưỡng từ tác vụ nền **2.3.3** hiển thị nổi bật màu vàng — chỉ cần **bấm trực tiếp vào pin trên bản đồ**, khung bên phải sẽ hiện ngay chi tiết cảnh báo, sự cố và nút đi thẳng sang xử lý."

---

## Phần 5: Operator — Lịch sạc thông minh & Xử lý sự cố (04:50 – 05:45)

- **Màn hình:** `/operator/charging-incidents` (gồm **2 Tab lớn** ở góc trên bên phải)
- **Chỉ chuột & thao tác:**
  1. **Tab 1 — `Lịch sạc thông minh` (UC13):**
     - Chỉ vào **Stepper 3 bước** ở đầu trang.
     - Cột trái: chọn Hub (**ĐH Bách Khoa**), bấm chip **`2 giờ tới`**, chọn quy tắc **`Pin thấp trước (< 25%)`** → bấm **`Tạo đề xuất lịch sạc`**.
     - Cột phải: chỉ **thanh tải điện kW** so với giới hạn Hub và bảng phân bổ cổng sạc → bấm **`Kiểm tra hợp lệ`** → bấm **`Áp dụng lịch sạc`**.
  2. **Tab 2 — `Xử lý sự cố` (UC11):**
     - Bấm chuyển sang tab **`Xử lý sự cố`** ở góc trên phải.
     - Cột trái: bấm **`+ Ghi nhận sự cố mới`** → chọn 1 tài nguyên (vd cổng sạc/xe), chọn mức độ **Cao**, nhập mô tả ngắn *"Mất nguồn đầu ra"* → bấm **`Ghi nhận & Hạn chế tài nguyên`**.
     - Cột phải (sự cố vừa tạo tự được mở):
       - **Bước 1:** Chọn phương án xử lý → bấm **`Lưu phương án xử lý`**.
       - **Bước 2:** Nhập minh chứng *"Đã thay CB nguồn, đo ổn định 220V"*, giữ tích *Đã khắc phục xong* → bấm **`Đóng sự cố & Khôi phục`**.
- **Lời thoại:**
  > "Trang **Lịch sạc & Sự cố** tách gọn thành 2 tab rõ ràng. Ở **UC13 — Lịch sạc thông minh**, nhân viên đi qua đúng 3 bước: chọn Hub & khung giờ, chọn quy tắc ưu tiên xe pin thấp, rồi kiểm tra tải điện kW và áp dụng phiên bản lịch sạc mới. Sang tab **UC11 — Xử lý sự cố**, nhân viên ghi nhận lỗi để tự động khóa đặt mới tài nguyên hỏng, lưu phương án xử lý, và xác minh minh chứng kỹ thuật để đóng sự cố, khôi phục dịch vụ."

---

## Phần 6: Operator — Điều chuyển xe & Mô phỏng What-if (05:45 – 06:45)

### 6.1. Điều chuyển xe giữa các Hub (`UC12`)
- **Màn hình:** `/operator/redistribution`
- **Chỉ chuột & thao tác:**
  1. Chọn **Hub nguồn** (Hub nhiều xe), **Hub đích** (Hub khác) và giờ dự kiến → bấm **`Xem phương án`** (chỉ dòng báo sức chứa tiếp nhận của Hub đích).
  2. Tích chọn 1–2 xe → bấm **`Xác nhận điều chuyển`**.
  3. Cuộn xuống mục *Lệnh điều chuyển*: bấm **`Đã rời Hub nguồn`** → bấm **`Đã tới Hub đích`** → bấm **`Đóng lệnh`**.
- **Lời thoại:**
  > "Ở **UC12 — Điều chuyển xe**, khi cần cân bằng đội xe giữa các Hub, nhân viên chọn Hub nguồn và Hub đích, hệ thống kiểm tra và giữ trước sức chứa tiếp nhận tại Hub đích, rồi theo dõi xuyên suốt từ lúc xe xuất phát đến khi tiếp nhận hoàn tất."

### 6.2. Mô phỏng tình huống What-if (`UC14`)
- **Màn hình:** `/operator/simulation`
- **Chỉ chuột & thao tác:**
  1. Chỉ vào huy hiệu **`● Tách biệt dữ liệu thật`** và **Stepper 3 bước** ở đầu trang.
  2. Cột trái: bấm chọn thẻ kịch bản **`Tăng nhu cầu`**, chọn Hub (**ĐH Bách Khoa**), kéo **thanh trượt** lên **`2.4x`** (hoặc `3.0x`) → bấm **`Chạy mô phỏng ngay`**.
  3. Cột phải: chỉ vào **3 thẻ So sánh Trước vs Sau** (*Xe thiếu hụt, Chờ trung bình, Hub quá tải* kèm thanh bar song song) và **thẻ Đề xuất hành động** ở dưới → chỉ (hoặc bấm) nút **`Áp dụng →`** chuyển thẳng sang Điều chuyển xe / Lịch sạc.
- **Lời thoại:**
  > "Cuối cùng là **UC14 — Mô phỏng What-if**. Hệ thống chụp một bản sao trạng thái hoàn toàn tách biệt nên không ảnh hưởng dữ liệu vận hành thật. Nhân viên chọn kịch bản tăng nhu cầu giờ cao điểm, kéo thanh tham số và bấm chạy ngay để so sánh trực quan 3 chỉ số KPI Trước và Sau, đồng thời nhận đề xuất hành động chuyển thẳng sang điều chuyển xe hoặc tối ưu lịch sạc."

---

## Phần 7: Kết thúc (06:45 – 07:00)

- **Màn hình:** Giữ ở trang Giám sát mạng lưới hoặc Mô phỏng What-if (bấm nhanh nút **`? Hướng dẫn ...`** ở góc dưới sidebar để nhắc lại tính năng hỗ trợ người mới).
- **Lời thoại:**
  > "Như vậy nhóm đã demo trọn vẹn **14/14 Use Cases** cùng các tác vụ nền tự động của hệ thống **Smart E-Mobility Hub**, bám sát kiến trúc 4 tầng và Class Diagram ở Submission #3, kèm hướng dẫn tương tác trực tiếp trên từng màn hình. Cảm ơn thầy/cô đã theo dõi!"
