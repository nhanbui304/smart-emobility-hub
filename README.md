# Smart E-Mobility Hub

[![CI](https://github.com/nhanbui304/smart-emobility-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/nhanbui304/smart-emobility-hub/actions/workflows/ci.yml)

Hệ thống điều phối xe điện dùng chung, chỗ đỗ và trạm sạc trong khu đô thị ĐHQG-HCM.
Bài tập lớn môn Công nghệ phần mềm (CO3001) – HK261 – Nhóm 17.

- **Student** (giao diện mobile): tìm Hub, đặt/nhận/trả xe, đặt chỗ đỗ, đặt lịch sạc.
- **Operator** (giao diện desktop): giám sát mạng lưới, xử lý sự cố, điều chuyển xe, lịch sạc, mô phỏng What-if.

> **Tài liệu dự án:** [**docs/README.md**](docs/README.md) · [SRS](docs/SRS.md) · [SDD](docs/SDD.md) · [STD](docs/STD.md) · [User’s Manual](docs/USER_MANUAL.md) · [CONTRIBUTING.md](CONTRIBUTING.md)

## Chạy dự án

Yêu cầu **Node.js 24 LTS** và kết nối npm registry để tải thư viện. Dữ liệu lưu trong một file SQLite cục bộ.
`better-sqlite3` 13 có sẵn bản biên dịch (Node-API) cho Windows, macOS, Linux nên không cần cài công cụ build C++.

```bash
npm ci             # cài theo ba lockfile và tạo server/.env nếu thiếu
npm run db:reset   # tạo database + dữ liệu mẫu
npm run dev        # chạy server (cổng 3000) và client (cổng 5173)
```

Mở <http://localhost:5173> hoặc địa chỉ Local mà Vite in ra nếu cổng 5173 bận. Cổng 3000 phải trống để proxy API vào đúng server.

Giao diện Student tự đổi theo màn hình: điện thoại hiển thị như app (thanh tab dưới đáy), máy tính hiển thị như web
(menu ngang trên cùng). Giao diện Operator dành cho máy tính.

**Mở trên điện thoại:** điện thoại và máy tính dùng chung Wi-Fi, chạy `npm run dev`, xem dòng `Network:` mà Vite in ra
(ví dụ `http://192.168.1.5:5173`) rồi mở địa chỉ đó trên điện thoại. Windows hỏi tường lửa thì chọn cho phép.

### Tài khoản demo

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Operator | `operator@hub.local` | `operator123` |
| Student | `student1@hub.local` | `student123` |
| Student | `student2@hub.local` | `student123` |

Trang đăng nhập ở chế độ dev có nút điền nhanh tài khoản demo.

### Các lệnh khác

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy server + client, tự tải lại khi sửa code |
| `npm run db:reset` | Xóa database, tạo lại bảng theo schema, nạp dữ liệu mẫu |
| `npm run db:seed` | Chỉ nạp lại dữ liệu mẫu (giữ nguyên bảng) |
| `npm run typecheck` | Kiểm tra lỗi TypeScript cả server và client |
| `npm run lint` | Kiểm tra chất lượng mã nguồn với ESLint (server + client) |
| `npm run build` | Build bản production cho frontend (`client/dist`) |
| `npm test` | Chạy bộ test tự động Vitest trên SQLite test cô lập |
| `npm run test:coverage` | Chạy test và xuất báo cáo coverage (`server/coverage/`) |
| `npm run db:studio --prefix server` | Xem/sửa dữ liệu trên trình duyệt |

## Chạy bản production

Chạy `npm run build` để tạo `client/dist`. Tạo thư mục chứa DB triển khai, đặt `DATABASE_URL` trỏ vào file SQLite trong thư mục đó, rồi chạy `npm run db:push --prefix server` để tạo schema. Đặt `NODE_ENV=production` và cấp `SESSION_SECRET` ngẫu nhiên ít nhất 32 ký tự trước khi chạy `npm run start --prefix server`. Express phục vụ giao diện và API trên cùng cổng.

Dockerfile tạo schema lúc khởi động. Cấp `SESSION_SECRET` qua biến môi trường và gắn volume tại `/app/server/data` để giữ DB qua các lần thay container. Các lệnh `db:reset` và `db:seed` chỉ dùng cho bản demo dev.

## Công nghệ

| Phần | Công nghệ |
| --- | --- |
| Ngôn ngữ | TypeScript |
| Frontend | React 18, Vite, React Router, Tailwind CSS |
| Backend | Node.js, Express |
| Database | SQLite + Drizzle ORM |
| Đăng nhập | express-session (cookie phiên) + bcryptjs (hash mật khẩu) |
| Kiểm tra dữ liệu gửi lên | zod |

Trang giám sát tự gọi lại API mỗi 3 giây để cập nhật số liệu (yêu cầu phi chức năng: cập nhật trong 3 giây).
Trạng thái xe được thay đổi bởi bộ giả lập chạy trong server, thay cho thiết bị thật.

## Cấu trúc thư mục

```
smart-emobility-hub/
├── package.json            # lệnh chạy chung (dev, db:reset, typecheck)
├── server/
│   ├── .env.example        # biến môi trường (npm ci tự copy thành .env)
│   └── src/
│       ├── index.ts        # khởi động API + bộ giả lập + tác vụ định kỳ
│       ├── app.ts          # Express: session → routes → xử lý lỗi
│       ├── constants.ts    # MỌI trạng thái (VEHICLE_STATUSES...)
│       ├── config/         # env.ts (biến môi trường), systemConfig.ts (tham số nghiệp vụ)
│       ├── db/             # schema.ts (các bảng), seed.ts (dữ liệu mẫu)
│       ├── types/dto.ts    # datatype trong class diagram Sub #3 (dữ liệu API trả về)
│       ├── lib/            # db, errors, response, schemas
│       ├── middleware/     # requireAuth, requireRole, validateBody, errorHandler
│       ├── routes/         # URL + quyền + kiểm tra dữ liệu → gọi controller
│       ├── controllers/    # đọc request → gọi service → trả response
│       ├── services/       # nghiệp vụ
│       ├── repositories/   # truy vấn database; operational/ = các phần của OperationalRepository
│       ├── schedulers/     # tác vụ định kỳ mục 2.3: hết hạn giữ chỗ, hết hạn đặt xe, cảnh báo Hub
│       └── simulator/      # VehicleSimulator (thiết bị giả lập), SimulationEngine (UC14)
└── client/src/
    ├── types.ts            # kiểu dữ liệu API (bản sao enum, entity, datatype từ server)
    ├── statusLabels.ts     # nhãn tiếng Việt cho trạng thái
    ├── api/                # hàm gọi API, mỗi file ứng với một Controller (tên hàm = tên method)
    ├── context/            # AuthContext (đăng nhập), ThemeContext (sáng/tối)
    ├── hooks/useAsync.ts   # gọi API + tự tải lại định kỳ
    ├── layouts/            # StudentLayout (tab dưới), OperatorLayout (sidebar)
    ├── components/         # Button, Card, StatusBadge, ErrorMessage...
    └── pages/              # auth/, student/, operator/
```

## Trạng thái hoàn thiện (MVP -- 14/14 Use Cases)

Toàn bộ **14/14 Use Cases** và các tác vụ nền mục 2.3 đã được hiện thực đầy đủ theo kiến trúc 4 tầng (`Route → Controller → Service → Repository → SQLite`) từ Submission #3:

- **Xác thực & Giao diện:** Đăng ký, đăng nhập, đăng xuất, phân quyền Student/Operator (`requireRole`), đổi chế độ Sáng/Tối/Theo hệ thống (lưu trên server), bản đồ thực tế ĐHQG-HCM (`Leaflet + OpenStreetMap`) đồng bộ dữ liệu tự động mỗi 3 giây.
- **Luồng Sinh viên (UC01 -- UC09):**
  - **UC01:** Tìm phương án phù hợp theo loại xe và mức pin tối thiểu.
  - **UC02 / UC03:** Chọn xe dùng chung (kèm biển số, mã đội xe, mức pin) và đặt/hủy đặt xe.
  - **UC04 / UC05:** Mở khóa nhận xe và trả xe về Hub có sức chứa trống (kèm xử lý nhánh lỗi thiết bị giả lập).
  - **UC06:** Đặt/hủy chỗ đỗ xe cá nhân chống tranh chấp sức chứa (transaction + idempotency `requestId`).
  - **UC07:** Yêu cầu sạc ngay tại Hub hoặc tự động xếp hàng đợi kèm thời gian chờ ước tính.
  - **UC08 / UC09:** Đặt lịch sạc trước theo khung giờ, xem/đổi/hủy lịch sạc (khóa phiên bản `version`).
- **Luồng Nhân viên vận hành (UC10 -- UC14):**
  - **UC10:** Giám sát mạng lưới 5 Hub theo thời gian thực, 4 chỉ số KPI và cảnh báo quá tải/thiếu xe theo ngưỡng.
  - **UC11:** Ghi nhận và cập nhật vòng đời xử lý sự cố thiết bị/xe (`version` optimistic locking).
  - **UC12:** Điều chuyển xe giữa các Hub nguồn/đích kèm kiểm tra sức chứa tiếp nhận.
  - **UC13:** Quản lý và tối ưu lịch sạc thông minh.
  - **UC14:** Mô phỏng tình huống What-if trên bản chụp độc lập (snapshot) so sánh KPI cơ sở và kịch bản.
- **Tác vụ nền (Mục 2.3):** Tự động giải phóng lượt giữ chỗ đỗ quá hạn (2.3.1), lượt đặt xe quá hạn (2.3.2), cập nhật cảnh báo Hub và bộ giả lập thiết bị xe mỗi giây.

**Kiểm tra nhánh lỗi thiết bị / hết hạn giữ chỗ** (sửa `server/.env` rồi khởi động lại server):

- `SIMULATOR_DEVICE_RESULT=FAILED` hoặc `UNKNOWN`: giả lập lệnh mở/khóa xe thất bại hoặc không rõ phản hồi (UC04, UC05). Mặc định `RANDOM` (90% thành công).
- `PARKING_HOLD_MINUTES=1`: rút ngắn thời gian giữ chỗ đỗ xuống 1 phút để kiểm thử tự động giải phóng quá hạn (TC-2.3.1-01).
