# Smart E-Mobility Hub

Hệ thống điều phối xe điện dùng chung, chỗ đỗ và trạm sạc trong khu đô thị ĐHQG-HCM.
Bài tập lớn môn Công nghệ phần mềm (CO3001) – HK261 – Nhóm 17.

- **Student** (giao diện mobile): tìm Hub, đặt/nhận/trả xe, đặt chỗ đỗ, đặt lịch sạc.
- **Operator** (giao diện desktop): giám sát mạng lưới, xử lý sự cố, điều chuyển xe, lịch sạc, mô phỏng What-if.

> Phân công, quy trình làm một use case và quy tắc code: xem **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Chạy dự án

Yêu cầu: **Node.js 20.19+** (khuyên dùng Node 22 LTS). Không cần cài database: dữ liệu lưu trong một file SQLite.

```bash
npm install        # cài cho cả server/ và client/; tự tạo server/.env
npm run db:reset   # tạo database + dữ liệu mẫu
npm run dev        # chạy server (cổng 3000) và client (cổng 5173)
```

Mở <http://localhost:5173>.

### Tài khoản demo

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Operator | `operator@hub.local` | `operator123` |
| Student | `student1@hub.local` | `student123` |
| Student | `student2@hub.local` | `student123` |

Trang đăng nhập có sẵn nút điền nhanh tài khoản demo.

### Các lệnh khác

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy server + client, tự tải lại khi sửa code |
| `npm run db:reset` | Xóa database, tạo lại bảng theo schema, nạp dữ liệu mẫu |
| `npm run db:seed` | Chỉ nạp lại dữ liệu mẫu (giữ nguyên bảng) |
| `npm run typecheck` | Kiểm tra lỗi TypeScript cả server và client |
| `npm run db:studio --prefix server` | Xem/sửa dữ liệu trên trình duyệt |

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
│   ├── .env.example        # biến môi trường (npm install tự copy thành .env)
│   └── src/
│       ├── index.ts        # khởi động API + bộ giả lập + tác vụ định kỳ
│       ├── app.ts          # Express: session → routes → xử lý lỗi
│       ├── constants.ts    # MỌI trạng thái (VEHICLE_STATUSES...)
│       ├── config/         # env.ts (biến môi trường), systemConfig.ts (tham số nghiệp vụ)
│       ├── db/             # schema.ts (các bảng), seed.ts (dữ liệu mẫu)
│       ├── types/dto.ts    # dữ liệu API trả về
│       ├── lib/            # db, errors, response, schemas
│       ├── middleware/     # requireAuth, requireRole, validateBody, errorHandler
│       ├── routes/         # URL + quyền + kiểm tra dữ liệu → gọi controller
│       ├── controllers/    # đọc request → gọi service → trả response
│       ├── services/       # nghiệp vụ
│       ├── repositories/   # truy vấn database
│       ├── schedulers/     # tác vụ định kỳ mục 2.3: hết hạn giữ chỗ, hết hạn đặt xe, cảnh báo Hub
│       └── simulator/      # VehicleSimulator (thiết bị giả lập), SimulationEngine (UC14)
└── client/src/
    ├── types.ts            # kiểu dữ liệu API (bản sao từ server)
    ├── statusLabels.ts     # nhãn tiếng Việt cho trạng thái
    ├── api/                # hàm gọi API theo nhóm
    ├── context/            # AuthContext (đăng nhập), ThemeContext (sáng/tối)
    ├── hooks/useAsync.ts   # gọi API + tự tải lại định kỳ
    ├── layouts/            # StudentLayout (tab dưới), OperatorLayout (sidebar)
    ├── components/         # Button, Card, StatusBadge, ErrorMessage...
    └── pages/              # auth/, student/, operator/
```

## Trạng thái hiện tại

**Đã chạy thật**

- Đăng ký, đăng nhập, đăng xuất, đổi giao diện sáng/tối/theo hệ thống (lưu trên server).
- Xem trạng thái Hub (`GET /api/hubs`, `GET /api/hubs/:id`) – luồng mẫu đủ 4 tầng.
- Bộ giả lập xe chạy mỗi giây; trang Giám sát mạng lưới và Trang chủ tự cập nhật mỗi 3 giây.
- Phân quyền Student/Operator ở cả backend (`requireRole`) và frontend (chuyển hướng).

**Khung sẵn, chờ hiện thực**

Mọi route của UC01–UC14 đã có, đã gắn quyền và kiểm tra dữ liệu. Gọi vào sẽ nhận
`{ ok: false, error: { code: "NOT_IMPLEMENTED" } }` (HTTP 501) cho tới khi người phụ trách viết logic.
Tìm việc của mình: tìm `Owner: <tên bạn>` trong project.
