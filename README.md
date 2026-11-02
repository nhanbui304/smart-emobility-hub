# Smart E-Mobility Hub

Hệ thống điều phối xe điện dùng chung, chỗ đỗ và trạm sạc trong khu đô thị ĐHQG-HCM.
Bài tập lớn môn Công nghệ phần mềm (CO3001) – HK261 – Nhóm 17.

- **Student** (giao diện mobile): tìm Hub, đặt/nhận/trả xe, đặt chỗ đỗ, đặt lịch sạc.
- **Operator** (giao diện desktop): giám sát mạng lưới, xử lý sự cố, điều chuyển xe, lịch sạc thông minh, mô phỏng What-if.

> Quy trình làm việc, phân công file và quy ước code: xem **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Chạy dự án

Yêu cầu: **Node.js 20.19+** (khuyên dùng Node 22 LTS). Không cần cài database: dữ liệu lưu trong một file SQLite.

```bash
npm install        # cài cho cả 3 phần; tự tạo server/.env từ server/.env.example
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
| `npm run db:push -w server` | Cập nhật bảng theo schema mới, cố giữ dữ liệu |
| `npm run db:studio -w server` | Mở Drizzle Studio để xem/sửa dữ liệu trên trình duyệt |
| `npm run test` | Chạy test (Vitest) trên database test riêng |
| `npm run typecheck` | Kiểm tra kiểu TypeScript cả 3 phần |

## Công nghệ

| Tầng | Công nghệ |
| --- | --- |
| Frontend | React 18, Vite, TypeScript, React Router, Tailwind CSS |
| Backend | Node.js, Express 5, TypeScript (chạy bằng `tsx`) |
| Database | SQLite (`better-sqlite3`) + Drizzle ORM |
| Real-time | Socket.IO |
| Validate | zod |
| Xác thực | JWT + bcryptjs |
| Test | Vitest |

## Cấu trúc thư mục

```
smart-emobility-hub/
├── shared/src/             # Dùng chung client + server
│   ├── enums.ts            #   MỌI trạng thái (VehicleStatus, ParkingAllocationStatus...) + nhãn tiếng Việt
│   ├── types.ts            #   DTO dùng chung (HubStatus, AuthUser...)
│   └── socketEvents.ts     #   Tên sự kiện Socket.IO
├── server/
│   ├── .env.example        # Biến môi trường (npm install tự copy thành .env)
│   ├── drizzle.config.ts   # Cấu hình Drizzle Kit
│   └── src/
│       ├── index.ts        # Khởi động HTTP + Socket.IO + simulator + scheduler
│       ├── app.ts          # Express app: middleware → routes → xử lý lỗi
│       ├── config/         # env.ts (biến môi trường), systemConfig.ts (tham số nghiệp vụ)
│       ├── db/             # schema.ts (các bảng), seed.ts (dữ liệu mẫu)
│       ├── lib/            # db, errors, idempotency (runIdempotent), jwt, socket, schemas
│       ├── middleware/     # requireAuth, requireRole, validateBody, errorHandler
│       ├── routes/         # Khai báo URL + quyền + validate  → gọi controller
│       ├── controllers/    # Đọc request → gọi service → trả response
│       ├── services/       # Nghiệp vụ (kiểm tra điều kiện, gọi repository, gửi thông báo)
│       ├── repositories/   # Truy cập database (chỉ Drizzle, không nghiệp vụ)
│       ├── schedulers/     # Tác vụ định kỳ: hết hạn giữ chỗ, hết hạn đặt xe, cảnh báo Hub
│       ├── simulator/      # VehicleSimulator (thiết bị giả lập), SimulationEngine (UC14)
│       └── tests/          # Test Vitest
└── client/src/
    ├── api/                # Hàm gọi API theo nhóm (axios, tự gắn token)
    ├── context/            # AuthContext, ThemeContext
    ├── hooks/              # useSocket/useSocketEvent, useAsync
    ├── layouts/            # StudentLayout (tab dưới), OperatorLayout (sidebar)
    ├── components/         # Button, Card, StatusBadge, PageHeader, EmptyState, ErrorMessage...
    └── pages/              # auth/, student/, operator/
```

## Trạng thái hiện tại

**Đã chạy thật**

- Đăng ký, đăng nhập, đăng xuất, đổi giao diện sáng/tối/theo hệ thống (lưu trên server).
- Xem trạng thái Hub (`GET /api/hubs`, `GET /api/hubs/:id`) – luồng mẫu đủ 4 tầng.
- Bộ giả lập xe chạy mỗi giây, đẩy `HUB_STATUS_UPDATED` qua Socket.IO; trang Giám sát mạng lưới tự cập nhật.
- Phân quyền Student/Operator ở cả backend (`requireRole`) và frontend (chuyển hướng).
- `runIdempotent` cho thao tác atomic + chống gửi lặp, có test.

**Khung sẵn, chờ hiện thực**

Mọi route của UC01–UC14 đã có, đã gắn quyền và validate. Gọi vào sẽ nhận
`{ ok: false, error: { code: "NOT_IMPLEMENTED" } }` (HTTP 501) cho tới khi người phụ trách viết logic.
Tìm việc của mình: tìm `Owner: <tên bạn>` trong project.

## Quyết định khi dựng nền

Những điểm khác hoặc bổ sung so với kế hoạch ban đầu:

1. **Drizzle ORM thay cho Prisma.** Prisma cần tải engine riêng từ server của Prisma khi cài, dễ lỗi khi mạng chặn.
   Drizzle chỉ là thư viện npm, `better-sqlite3` đã có sẵn bản build cho Windows/macOS/Linux.
   Transaction của `better-sqlite3` chạy đồng bộ nên các thao tác `atomic...` không bị request khác chen vào.
2. **Dùng `drizzle-kit push` thay cho migration.** Phù hợp giai đoạn thiết kế còn đổi schema thường xuyên; không bị xung đột file migration giữa các thành viên.
3. **`drizzle-orm` khai báo thêm ở `package.json` gốc** để npm đặt nó cùng chỗ với `drizzle-kit` (nếu không, `drizzle-kit` báo không tìm thấy `drizzle-orm`).
4. **`bcryptjs` thay cho `bcrypt`.** Cùng thuật toán, viết bằng JS thuần, không cần biên dịch native trên Windows.
5. **Enum dạng object hằng (`as const`)** thay cho `enum` của TypeScript: dùng trực tiếp làm giá trị cột TEXT và cho zod.
   Thêm vài enum chưa có trong kế hoạch: `ThemePreference`, `ChargingPortStatus`, `ConnectorType`, `ChargingSessionStatus`,
   `ImpactLevel`, `ResourceType`, `RedistributionItemStatus`, `DeviceCommandResult`.
6. **Method của Operator có thêm tham số cuối `operatorId`** (UC11–UC14) để ghi vết người thao tác và dùng cho `runIdempotent`. Các tham số trước giữ đúng thứ tự trong sequence diagram.
7. **Repository có thêm vài method hỗ trợ** chưa có trong sequence (ví dụ `findById`, `findExpiredHolds`, `atomicCreateRequest`). Đổi tên thoải mái nếu class diagram chốt khác.
8. **`systemConfig` có thêm `dataStaleSeconds` và `schedulerIntervalMs`.** Các con số trong `systemConfig.ts` là giá trị nhóm chọn cho demo, chưa phải quy định từ tài liệu.
9. **React Router 7** (thay cho 6) vì bản 6 có cảnh báo bảo mật; cách dùng không đổi.
10. **Vitest ghim bản 4.0.x** vì 4.1 gây lỗi cài đặt của npm trong workspace. `npm audit` còn cảnh báo mức moderate ở công cụ dev (Vitest, esbuild trong drizzle-kit), không ảnh hưởng bản chạy.
