# User’s Manual — Hướng dẫn sử dụng & Phân tích Use Cases

Tài liệu hướng dẫn cài đặt, khởi chạy, thao tác từng màn hình kèm **phân tích ánh xạ trực tiếp sang 14 Use Cases (UC01–UC14) và 3 tác vụ nền (2.3.1–2.3.3)** của hệ thống **Smart E-Mobility Hub** (CO3001 – HK261 – Nhóm 17).

---

## 1. Cài đặt, Khởi chạy & Hướng dẫn nhanh lần đầu

### 1.1 Yêu cầu môi trường
- **Node.js 24 LTS** (tối thiểu Node 22.13+) và kết nối npm registry để tải thư viện.
- Không cần cài đặt cơ sở dữ liệu ngoài: hệ thống dùng SQLite cục bộ (`better-sqlite3` có sẵn bản biên dịch Node-API cho Windows, macOS và Linux).

### 1.2 Các bước chạy Local
```bash
npm ci             # Cài theo ba lockfile, tự tạo server/.env nếu thiếu
npm run db:reset   # Khởi tạo schema SQLite và nạp dữ liệu mẫu (5 Hub ĐHQG-HCM)
npm run dev        # Khởi chạy Backend (cổng 3000) và Frontend (cổng 5173)
```
Mở **<http://localhost:5173>** (hoặc địa chỉ Local Vite in ra nếu cổng 5173 bận; cổng 3000 phải trống). Lệnh `db:reset` xóa và tạo lại bộ dữ liệu mẫu cố định gồm **5 Hub, 100 chỗ đỗ, 20 cổng sạc, 50 xe dùng chung và 3 tài khoản demo**.

### 1.3 Mở thử trên điện thoại (cùng mạng Wi-Fi / LAN)
1. Kết nối máy tính và điện thoại vào cùng mạng Wi-Fi.
2. Chạy `npm run dev` và xem địa chỉ `Network:` do Vite in ra (ví dụ `http://192.168.1.5:5173`).
3. Mở địa chỉ đó trên trình duyệt điện thoại (nếu Windows Firewall hỏi, chọn **Allow**). Giao diện Student tự động chuyển sang bố cục ứng dụng di động (thanh tab dưới đáy).

### 1.4 Tài khoản demo mặc định (Auth: Sign In / Register)

| Vai trò | Email | Mật khẩu | Trạng thái dữ liệu mẫu sẵn có |
| --- | --- | --- | --- |
| **Operator** | `operator@hub.local` | `operator123` | Quản trị toàn mạng lưới 5 Hub ĐHQG-HCM |
| **Student 1** | `student1@hub.local` | `student123` | Có xe cá nhân `59-X1 123.45` + 1 lịch sạc mẫu `cr-demo-01` (dùng thử UC01–UC04, UC06–UC09) |
| **Student 2** | `student2@hub.local` | `student123` | Có sẵn 1 chuyến đi `ACTIVE` (dùng thử ngay UC05 Trả xe) |

> Trang đăng nhập ở chế độ dev có sẵn nút điền nhanh tài khoản demo. Sinh viên mới cũng có thể tự đăng ký tại `/register` (**Register Student Account**).

![Màn hình đăng nhập](submission-4/screenshots/01_login.png)

### 1.5 Hướng dẫn tương tác lần đầu theo từng màn hình (Interactive Tour kiểu Intro.js)
- Ngay lần đầu mở **bất kỳ màn hình hoặc tab chức năng nào** ở cả vai trò **Student** (Khám phá Hub, Đặt xe, Chuyến đi, Xe của tôi, Sạc ngay, Đặt chỗ của tôi, Cài đặt) lẫn **Operator** (Giám sát mạng lưới, Lịch sạc thông minh, Xử lý sự cố, Điều chuyển xe, Mô phỏng What-if), ứng dụng tự động bật **Onboarding Tour riêng của đúng trang đó** với khung spotlight chỉ thẳng vào từng vùng thao tác và gắn nhãn mã Use Case tương ứng.
- Trạng thái đã xem được lưu riêng theo từng trang trong `localStorage` để không lặp lại ở các lần truy cập sau.
- Bất cứ lúc nào muốn xem lại hướng dẫn của trang hiện tại, bấm nút **`? Hướng dẫn <tên trang>`** trên thanh menu (Student desktop), nút tròn **`?`** góc dưới phải (Student mobile), hoặc nút **`? Hướng dẫn ...`** ở góc dưới sidebar (Operator); hỗ trợ phím tắt `→` / `←` / `Esc`.

---

## 2. Bảng tổng hợp ánh xạ: Màn hình ↔ Use Case trong bài

| Vai trò | Màn hình / Đường dẫn | Mã Use Case | Chức năng dùng để làm gì? |
| --- | --- | --- | --- |
| **Chung** | `/login`, `/register`, `/student/settings` | Auth & Customize Theme | Đăng ký sinh viên, đăng nhập/đăng xuất, đổi giao diện Sáng / Tối / Theo hệ thống. |
| **Student** | `/student` (Khám phá Hub) | **View Hub Status**, **UC01** | Xem trạng thái 5 Hub trực tiếp trên bản đồ ĐHQG-HCM (3s/lần); chuyển đổi rõ giữa **Xe dùng chung (Thuê xe)** và **Xe cá nhân (Đỗ xe · Sạc xe)** để lọc phương án phù hợp. |
| **Student** | `/student/hubs/:hubId/reserve` | **UC02** | Chọn xe dùng chung khả dụng tại Hub và giữ xe trước trong 30 phút (chống đặt trùng). |
| **Student** | `/student/trips` (Chuyến đi) | **UC03, UC04, UC05** | Hủy lượt đặt còn hạn (UC03), mở khóa nhận xe bắt đầu chuyến đi (UC04), và trả xe về Hub đích có chỗ trống (UC05). |
| **Student** | `/student/reservations` | **View My Reservations** | Xem tập trung toàn bộ lượt đặt xe, đặt chỗ đỗ và lịch sạc hiện có của sinh viên. |
| **Student** | `/student/my-vehicle` (Xe của tôi) | **Private Vehicles**, **UC06, UC08, UC09** | Quản lý hồ sơ xe điện cá nhân (thêm/cập nhật/xóa xe an toàn); giữ tạm & xác nhận chỗ đỗ (UC06), đặt lịch sạc trước (UC08), đổi giờ hoặc hủy lịch sạc (UC09). |
| **Student** | `/student/charging-request` | **UC07** | Gửi yêu cầu sạc tức thời tại Hub (nhận cổng ngay hoặc vào hàng đợi có thời gian chờ dự kiến). |
| **Operator** | `/operator/monitoring` | **UC10** | Giám sát KPI mạng lưới 5 Hub thời gian thực, bấm trực tiếp pin vàng trên bản đồ để xem ngay cảnh báo/sự cố và chuyển nhanh sang xử lý. |
| **Operator** | `/operator/charging-incidents` (Tab 1) | **UC13** | Điều phối lịch sạc thông minh theo 3 bước (Hub/Khung giờ → Quy tắc ưu tiên → Kiểm tra tải điện kW & Áp dụng). |
| **Operator** | `/operator/charging-incidents?tab=incidents` (Tab 2) | **UC11** | Ghi nhận sự cố tài nguyên, hạn chế phân bổ mới, lập phương án xử lý và xác minh khắc phục để mở lại dịch vụ. |
| **Operator** | `/operator/redistribution` | **UC12** | Tạo lệnh điều chuyển xe từ Hub dư sang Hub thiếu, giữ trước sức chứa Hub đích và xác nhận xuất phát/tiếp nhận. |
| **Operator** | `/operator/simulation` | **UC14** | Mô phỏng tình huống What-if (tăng nhu cầu, đóng Hub, thêm cổng sạc/xe) trên bản chụp độc lập, so sánh KPI Trước/Sau và chuyển sang hành động. |
| **Hệ thống** | Schedulers chạy nền | **2.3.1, 2.3.2, 2.3.3** | Tự động giải phóng giữ chỗ quá hạn, hủy đặt xe quá hạn nhận, và đánh giá cảnh báo Hub định kỳ mỗi 15 giây. |

---

## 3. Hướng dẫn sử dụng chi tiết — Vai trò Sinh viên (Student)

### 3.1 Khám phá bản đồ Hub & Tìm phương án phù hợp (`View Hub Status` + `UC01`)
- **Đường dẫn:** `/student`
- **Thuộc Use Case nào:** **View Hub and Resource Status** (xem trạng thái trực tiếp 5 Hub) và **UC01 — Find Suitable Mobility Option** (tìm phương án di chuyển/đỗ/sạc phù hợp tiêu chí cho từng nhóm sinh viên).
- **Cách sử dụng (tách rõ 2 phân nhóm Sinh viên ngay trên thanh chế độ góc trên phải):**
  1. **Nhóm `Xe dùng chung (Thuê xe)` (mặc định):**
     - Trên bản đồ ĐHQG-HCM (tự cập nhật mỗi 3 giây), bấm vào bất kỳ pin Hub nào (*Ga Metro ĐHQG, ĐH Bách Khoa, Thư viện Trung tâm, ĐH KHTN, KTX Khu B*) để xem ngay số xe rảnh, chỗ trống, cổng sạc và **top 3 xe pin cao sẵn sàng nhận ngay** — có thể **bấm trực tiếp từng xe** để mở thẳng bước xác nhận đặt xe, hoặc bấm **`Xem tất cả xe →`** để xem toàn bộ danh sách xe của Hub.
     - Ở khung **Tìm phương án (UC01)** bên dưới, lọc theo loại xe và mức pin tối thiểu → bấm **`Tìm`** → bấm **`Chọn xe`** để mở thẳng bước xác nhận của đúng Hub và xe đó.
  2. **Nhóm `Xe cá nhân (Đỗ xe · Sạc xe)`:**
     - Khi chuyển sang **`Đỗ xe`** hoặc **`Sạc xe`**, thẻ xem nhanh Hub bên phải tự ẩn danh sách xe thuê dùng chung và chuyển sang khối **`Tiện ích cho xe điện cá nhân`**: hiển thị biển số, loại xe, chuẩn đầu cắm của xe cá nhân kèm lối tắt **`Quản lý xe →`** (hoặc lời nhắc **`+ Đăng ký xe cá nhân →`** nếu sinh viên chưa có xe), số chỗ đỗ thường đang trống và số cổng sạc đang rảnh tại Hub đang chọn, cùng nút hành động chính (**`Đặt chỗ đỗ tại Hub này →`** / **`Đặt lịch sạc trước →`**) và nút nhanh **`Yêu cầu sạc ngay (UC07) →`**.
     - Kết quả tìm kiếm UC01 bên dưới cũng hiển thị phụ đề số chỗ đỗ trống và số cổng sạc rảnh dưới tên mỗi Hub để sinh viên đi xe cá nhân so sánh nhanh giữa các Hub.

![Trang chủ bản đồ Student](submission-4/screenshots/02_student_home_map.png)
![Tìm phương án phù hợp UC01](submission-4/screenshots/03_student_uc01_search.png)

---

### 3.2 Đặt xe dùng chung (`UC02`)
- **Đường dẫn:** `/student/hubs/:hubId/reserve` (hoặc kèm `?vehicleId=...` khi chọn trực tiếp 1 xe)
- **Thuộc Use Case nào:** **UC02 — Reserve Shared Vehicle** (giữ trước một xe điện dùng chung còn khả dụng và đủ ngưỡng pin tối thiểu ≥ 30%).
- **Cách sử dụng:**
  1. Khi bấm chọn một xe cụ thể từ Trang chủ hoặc kết quả tìm kiếm, hệ thống mở thẳng **bước Xác nhận đặt xe** (hiển thị Hub nhận xe, biển số, mã xe, mức pin và hạn nhận xe 30 phút); nếu đi từ **`Xem tất cả xe →`**, chọn 1 xe trong danh sách rồi vào bước xác nhận.
  2. Lượt đặt chỉ được tạo khi sinh viên bấm **`Xác nhận đặt xe`** (bọc trong `db.transaction` kèm `requestId` chống cấp trùng). Nếu xe vừa hết khả dụng, hệ thống báo rõ và để sinh viên chọn lại xe khác (không tự thay xe).

![Đặt xe dùng chung UC02](submission-4/screenshots/04_student_uc02_reserve.png)

---

### 3.3 Hủy đặt, Mở khóa nhận xe & Trả xe dùng chung (`UC03`, `UC04`, `UC05`)
- **Đường dẫn:** `/student/trips`
- **Thuộc Use Case nào:**
  - **UC03 — Cancel Vehicle Reservation:** Hủy lượt đặt còn hạn, giải phóng xe ngay về `AVAILABLE`.
  - **UC04 — Pick Up Shared Vehicle:** Gửi lệnh mở khóa qua `VehicleSimulator`, chuyển xe sang `IN_USE` và mở chuyến đi `ACTIVE` (xử lý cả nhánh thiết bị `FAILED` / `UNKNOWN`).
  - **UC05 — Return Shared Vehicle:** Chọn Hub đích → cấp chỗ đỗ trống (không lấy ô có cổng sạc) → gửi lệnh khóa xe và kết thúc chuyến đi.
- **Cách sử dụng:**
  1. Khi chưa có lượt nào: màn hình hiển thị 1 trạng thái trống duy nhất kèm nút về Trang chủ.
  2. Khi đang giữ xe chưa nhận: hiển thị thẻ **Xe đã đặt** (biển số, đồng hồ đếm ngược 30 phút) cùng nút **`Hủy đặt xe` (UC03)** và **`Nhận xe → Mở khóa và nhận xe` (UC04)** *(trong bước xác nhận nhận xe có thêm tiện ích tùy chọn **`Quét QR thân xe`** giúp đối chiếu nhanh mã xe ngoài bãi hoặc thử nghiệm chặn nhận nhầm xe trước khi gửi lệnh mở khóa)*.
  3. Khi đang thuê xe: ưu tiên hiển thị thẻ **Xe đang thuê** và form **Trả xe** (ẩn thông báo trống về đặt xe) → chọn Hub đích → **`Nhận vị trí đỗ`** → **`Đã đỗ xe – Khóa và trả xe` (UC05)**.

![Màn hình Chuyến đi UC03-UC05](submission-4/screenshots/05_student_uc04_booked_vehicle.png)
![Đã mở khóa và bắt đầu chuyến đi UC04](submission-4/screenshots/12_student_uc04_pickup_success.png)
![Đã trả xe và kết thúc chuyến đi UC05](submission-4/screenshots/13_student_uc05_return_success.png)

---

### 3.4 Xe cá nhân — Quản lý xe, Đặt chỗ đỗ & Đặt/Đổi lịch sạc (`Manage Private Vehicles`, `UC06`, `UC08`, `UC09`)
- **Đường dẫn:** `/student/my-vehicle` (hỗ trợ `?manageVehicles=1` để mở sẵn khung quản lý xe)
- **Thuộc Use Case nào:** Gồm bảng **`Quản lý xe cá nhân`**, lối tắt nổi bật **`Sạc ngay →`** (UC07) ở đầu trang và **3 Tab nghiệp vụ** (**`Đặt chỗ đỗ`** · **`Đặt lịch sạc`** · **`Quản lý lịch sạc`**):
  - **Quản lý xe cá nhân (`/api/auth/me/vehicles`):** Bấm nút **`Quản lý xe cá nhân (N xe)`** cạnh tiêu đề trang (tự động mở sẵn nếu tài khoản chưa có xe nào) để:
    - **`+ Thêm xe mới`:** Nhập biển số (hệ thống tự chuẩn hóa chữ hoa và kiểm tra chống trùng biển số toàn hệ thống), chọn loại xe (*Xe đạp điện* / *Xe máy điện*) và chuẩn đầu cắm (*Ổ cắm tiêu chuẩn (AC)* / *Type 2*).
    - **`Cập nhật`:** Chỉnh sửa biển số, loại xe hoặc chuẩn đầu cắm ngay trên dòng xe (hệ thống tự động chặn đổi chuẩn đầu cắm nếu xe đang có lịch sạc hoặc yêu cầu sạc còn hiệu lực).
    - **`Xóa` (có xác nhận an toàn):** Chỉ cho phép xóa khi xe không vướng lượt đặt chỗ đỗ, yêu cầu sạc hoặc lịch sạc hiệu lực (và chưa phát sinh lịch sử đặt sạc ràng buộc đối soát). Mọi thao tác thêm/sửa/xóa tự động làm mới ngay danh sách chọn xe ở cả 3 tab bên dưới mà không cần tải lại trang.
  - **UC06 — Đặt chỗ đỗ (+ Hủy đặt chỗ):** Tìm ô đỗ thường (tách biệt ô sạc), giữ chỗ tạm (`HELD` trong 30 phút) rồi xác nhận (`CONFIRMED`), hoặc hủy đặt chỗ.
  - **UC08 — Đặt lịch sạc:** Chọn xe cá nhân, Hub, khung giờ, pin hiện tại/mục tiêu → tìm cổng tương thích đầu cắm → xác nhận đặt lịch sạc trước.
  - **UC09 — Quản lý lịch sạc:** Xem danh sách lịch sạc đã tạo, đổi khung giờ mới hoặc hủy lịch có kiểm tra xung đột `version` (optimistic locking).

![Trang Xe của tôi UC06-UC08-UC09](submission-4/screenshots/06_student_uc06_uc08_uc09_my_vehicle.png)

---

### 3.5 Yêu cầu sạc ngay tại Hub (`UC07`)
- **Đường dẫn:** `/student/charging-request`
- **Thuộc Use Case nào:** **UC07 — Request Immediate Charging (+ Cancel Charging Request)** (cấp cổng sạc tức thời nếu rảnh, hoặc đưa vào hàng đợi ưu tiên xe pin thấp < 25% kèm thời gian chờ ước tính).
- **Cách sử dụng:**
  1. Chọn xe cá nhân, Hub và mức pin hiện tại → bấm **Kiểm tra khả năng sạc ngay**.
  2. Nếu có cổng trống → bấm **Xác nhận nhận cổng sạc**; nếu hết cổng → xác nhận **Vào hàng đợi** (có thể bấm **Hủy yêu cầu** bất cứ lúc nào).

![Yêu cầu sạc ngay UC07](submission-4/screenshots/07_student_uc07_charging_request.png)

### 3.6 Tùy chỉnh giao diện (`Customize Interface Mode`)
- Vào **Cài đặt (`/student/settings`)** để chuyển **Sáng / Tối / Theo hệ thống** (lưu trực tiếp lên tài khoản trên server, giữ nguyên khi tải lại trang).

---

## 4. Hướng dẫn sử dụng chi tiết — Vai trò Nhân viên vận hành (Operator)

Giao diện Operator được thiết kế tối giản theo nguyên tắc **ít chữ – rõ bước – hành động 1 chạm**, gồm 4 phân hệ ở thanh điều hướng bên trái.

### 4.1 Giám sát mạng lưới & Bản đồ sự cố tương tác (`UC10`)
- **Đường dẫn:** `/operator/monitoring`
- **Thuộc Use Case nào:** **UC10 — Monitor Hub & Network Status** (kết hợp cảnh báo tự động từ **FR-2.3.3**).
- **Cách sử dụng:**
  1. Quan sát **4 thẻ KPI** trên cùng (*Xe sẵn sàng, Chỗ đỗ trống, Cổng sạc rảnh, Cảnh báo mở*) cùng chỉ báo **`● Live · 3s`** (tự đồng bộ mỗi 3 giây).
  2. Trên **Bản đồ 5 Mobility Hub ĐHQG-HCM**, các Hub có cảnh báo hiển thị pin **màu vàng**. **Bấm trực tiếp vào pin Hub trên bản đồ** để mở ngay **khung Xem nhanh Hub** ở cột bên phải và bấm **`Xử lý sự cố`** (hoặc **`Xử lý`** trên thẻ cảnh báo) — hệ thống giữ nguyên ngữ cảnh Hub/tài nguyên: mở thẳng hồ sơ sự cố đang mở của Hub đó, hoặc liệt kê tài nguyên lỗi/bảo trì chưa có hồ sơ để Operator chủ động ghi nhận (không tự tạo hồ sơ, không mở nhầm sự cố đã đóng của Hub khác).
  3. Phía dưới là **Bảng tổng quan 5 Hub** (có ô tìm kiếm & lọc *Chỉ Hub có cảnh báo*); bấm vào bất kỳ dòng Hub nào để xem toàn bộ danh sách xe và lượt đặt chỗ/sạc của Hub đó.

![Giám sát mạng lưới UC10](submission-4/screenshots/08_operator_uc10_monitoring.png)

---

### 4.2 Lịch sạc thông minh & Xử lý sự cố (`UC13` & `UC11`)
- **Đường dẫn:** `/operator/charging-incidents` (hỗ trợ `?tab=incidents` để mở thẳng tab Sự cố)
- **Thuộc Use Case nào:** Tách gọn bằng **2 Tab lớn** ở góc trên bên phải để tránh rối mắt:
  - **Tab 1 — Lịch sạc thông minh (`UC13 — Manage & Apply Smart Charging Schedule`):** Điều phối phân bổ cổng sạc & công suất theo giới hạn điện của Hub.
    1. **Bước 1 (Chọn Hub & Khung giờ):** Chọn **Trạm sạc (Hub)** và xem ngay 3 ô trạng thái cổng trực quan (**`Cổng đang rảnh`**, **`Đang có xe sạc`**, **`Đang lỗi / bảo trì`**); chọn **Khung giờ lập lịch** (*2 giờ tới*, *Cao điểm 17h* hoặc *Tùy chỉnh* với 2 ô `Từ lúc` / `Đến lúc` kèm khung giờ thực tế hiển thị rõ).
    2. **Bước 2 (Quy tắc ưu tiên):** Chọn 1 trong 3 quy tắc (*Pin thấp trước < 25%*, *Đến trước sạc trước FIFO*, hoặc *Thiếu pin nhiều nhất*) → bấm **`Tạo đề xuất lịch sạc`**.
    3. **Bước 3 (Kiểm tra & Áp dụng):** Cột phải hiển thị **thanh tải điện kW 2 màu** tách rõ **`Đang sạc sẵn`** (xanh dương — giữ nguyên phiên đang sạc/lịch đặt trước) và **`Phân bổ mới`** (xanh lá — cấp cho cổng rảnh), tên cổng sạc đầy đủ kèm nhãn **`Giảm tải tự động`** khi hệ thống tự hạ công suất để không vượt giới hạn điện Hub. Có thể chỉnh tay kW từng dòng → bấm **`Kiểm tra hợp lệ`** → bấm **`Áp dụng lịch sạc`** (tự kiểm tra `baseVersion` chống xung đột).
    4. **Lịch sạc đang áp dụng:** Sau khi áp dụng, cột phải tự động hiển thị phiên bản đang hiệu lực (**`Phiên bản vN`**, thời điểm áp dụng, khung giờ và bảng phân bổ — được tải từ `GET /api/charging-schedules/latest`, không bị mất khi chuyển tab hoặc tải lại trang).
  - **Tab 2 — Xử lý sự cố (`UC11 — Record & Handle Resource Incident`):** Hiển thị theo bố cục **Master–Detail 2 cột** (trái: danh sách hồ sơ lọc **`Hồ sơ đang mở (N)`** / **`Hồ sơ đã đóng (N)`**; phải: chi tiết hồ sơ đang chọn và danh sách độc lập **`Tài nguyên lỗi/bảo trì chưa có hồ sơ (N)`**; bộ đếm sự cố ở góc trên tự cập nhật đồng bộ ngay khi có thay đổi).
    1. Khi đi từ nút **`Xử lý`** ở cảnh báo tổng hợp trên Giám sát mạng lưới (vd: *“3 tài nguyên lỗi/bảo trì”*), hệ thống giữ ngữ cảnh Hub: bấm **`Xử lý tài nguyên này`** trên đúng tài nguyên trong danh sách *Tài nguyên lỗi/bảo trì chưa có hồ sơ* (tài nguyên được khóa sẵn kèm nút **`Đổi tài nguyên khác`** và danh sách phân nhóm rõ tài nguyên lỗi/bảo trì vs tài nguyên khác), nhập mức độ & mô tả → bấm **`Ghi nhận & Hạn chế tài nguyên`** để lập hồ sơ UC11 và tự động khóa phân bổ mới.
    2. Chọn một hồ sơ ở cột trái → phần **Phương án xử lý (*Tùy chọn*)** cho phép chọn phương án (*Hạn chế & thông báo*, *Chuyển tài nguyên thay thế*, *Đưa đi bảo trì*), phạm vi ảnh hưởng và bấm **`Lưu phương án xử lý`** nhiều lần nếu cần; phần **Xác minh khắc phục & Đóng sự cố** có thể thực hiện trực tiếp (nhập minh chứng kỹ thuật từ 5 ký tự trở lên, giữ tích *Đã khắc phục xong* → bấm **`Đóng sự cố & Khôi phục`**). Nếu xe dùng chung được khôi phục có pin `< 25%`, hệ thống tự chuyển xe sang trạng thái **`Đang sạc (CHARGING)`** thay vì để kẹt ở bảo trì.
    3. Cả hồ sơ đang mở lẫn đã đóng đều hiển thị **Nhật ký xử lý sự cố** dạng dòng thời gian (ghi nhận thời điểm, nhân viên thao tác, phương án và phạm vi ảnh hưởng).

![Lịch sạc thông minh và Sự cố UC11-UC13](submission-4/screenshots/09_operator_uc11_uc13_charging_incidents.png)

---

### 4.3 Điều chuyển xe giữa các Hub (`UC12`)
- **Đường dẫn:** `/operator/redistribution`
- **Thuộc Use Case nào:** **UC12 — Redistribute Shared Vehicles** (cân bằng đội xe từ Hub dư sang Hub thiếu, giữ trước sức chứa tiếp nhận tại Hub đích).
- **Cách sử dụng:**
  1. Chọn **Hub nguồn**, **Hub đích** và thời gian dự kiến (ETA) → hệ thống tự kiểm tra sức chứa tiếp nhận khả dụng tại Hub đích *(khi đi từ nút **`Mở Điều chuyển →`** bên trang Mô phỏng What-if, Hub nguồn, Hub đích và số xe đề xuất được tự động điền sẵn)*.
  2. Chọn danh sách xe cần chuyển → bấm **Tạo lệnh điều chuyển**.
  3. Theo dõi trạng thái lệnh và lần lượt bấm **Xác nhận xuất phát** → **Xác nhận tiếp nhận** → **Đóng lệnh** (hoặc hủy mục chưa xuất phát).

![Điều chuyển xe UC12](submission-4/screenshots/10_operator_uc12_redistribution.png)

---

### 4.4 Mô phỏng tình huống What-if (`UC14`)
- **Đường dẫn:** `/operator/simulation`
- **Thuộc Use Case nào:** **UC14 — Run What-if Operational Simulation** (chạy giả lập hoàn toàn tách biệt trên `simulation_snapshots`, gắn huy hiệu **`● Bản nháp độc lập DB`**, tuyệt đối không ghi đè dữ liệu vận hành thật).
- **Cách sử dụng theo bố cục 2 cột (Cấu hình bên trái · Kết quả bên phải):**
  1. **Phạm vi bản chụp (tùy chọn):** Mặc định đã chọn đủ **5 Hub** và khung 2 giờ tới; bấm nút **`Phạm vi: 5 Hub`** ở góc trên phải khi muốn tùy chỉnh danh sách Hub, khung giờ hoặc chụp lại bản dữ liệu mới.
  2. **Chọn kịch bản & chạy mô phỏng (Cột trái):** Chọn 1 trong 4 thẻ kịch bản (*Tăng nhu cầu*, *Đóng Hub / Hết chỗ*, *Thêm cổng sạc*, *Thêm / Tập trung xe*), chọn **Hub áp dụng** (xem ngay 3 ô *Xe sẵn sàng*, *Nhu cầu*, *Hiện trạng dư/thiếu* của Hub đó), kéo **thanh trượt (slider)** chỉnh tham số → bấm **`Chạy mô phỏng`**.
  3. **Xem kết quả, Thử nghiệm phương án & Lịch sử (Cột phải):**
     - Xem **3 thẻ KPI tổng toàn mạng (Trước → Sau)** (*Tổng xe thiếu*, *Chờ trung bình*, *Hub quá tải*) và **Bảng chi tiết từng Hub** (*Xe sẵn sàng*, *Nhu cầu*, *Chỗ trống*, *Trạng thái*).
     - Tại mục **Các phương án điều phối độc lập** (*Hướng người dùng sang Hub thay thế*, *Điều chuyển phương tiện*, *Thay đổi lịch sạc*): bấm **`Thử nghiệm`** để mô phỏng tác động ngay trên bản chụp mà không sửa dữ liệu thật, hoặc bấm **`Mở Điều chuyển →`** / **`Mở Lịch sạc →`** để chuyển thẳng sang UC12 / UC13 với ngữ cảnh Hub đã điền sẵn.
     - Kéo xuống bảng **Lịch sử mô phỏng** để xem các lượt đã lưu mới nhất và bấm **`Xem kết quả`** mở lại bất kỳ lượt nào (kể cả sau khi tải lại trang, không chạy lại mô phỏng).

![Mô phỏng What-if UC14](submission-4/screenshots/11_operator_uc14_simulation.png)

---

## 5. Các tác vụ nền tự động của hệ thống (Mục 2.3)

Ngoài tương tác trực tiếp của Student và Operator, Backend chạy nền định kỳ các tác vụ sau (`server/src/schedulers/` và `server/src/simulator/`):

| Mã yêu cầu | Thành phần chạy nền | Chu kỳ | Chức năng tự động |
| --- | --- | --- | --- |
| **FR-2.3.1** | `HoldExpiryScheduler` | 15 giây | Tự động chuyển các lượt giữ tạm chỗ đỗ (`HELD`) quá 30 phút (hoặc theo `PARKING_HOLD_MINUTES`) sang `EXPIRED` để trả chỗ cho sinh viên khác. |
| **FR-2.3.2** | `ReservationExpiryScheduler` | 15 giây | Tự động hủy các lượt đặt xe dùng chung (`RESERVED`) quá hạn nhận 30 phút và trả xe về `AVAILABLE`. |
| **FR-2.3.3** | `HubAlertScheduler` | 15 giây | Tự động quét 5 Hub để bật/tắt 4 loại cảnh báo: `LOW_VEHICLE` (≤ 2 xe), `NEAR_FULL` (≤ 1 chỗ trống), `RESOURCE_FAULT` (tài nguyên lỗi/bảo trì) và `DATA_STALE` (> 30s chưa cập nhật). |
| **Simulator** | `VehicleSimulator` | 1 giây | Giả lập pin, trạng thái xe và lệnh mở/khóa thiết bị (`SIMULATOR_DEVICE_RESULT`). |
