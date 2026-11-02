# Hướng dẫn làm việc chung

## 1. Ai làm file nào

Chia đều 4 người: mỗi người làm trọn một cụm use case (backend, frontend, test) và việc chung của Submission #3.
Mỗi file có dòng `// Owner: <tên> – <UC>` ở đầu. Tìm tên mình trong project để thấy hết việc của mình.

| Người phụ trách | Use case | Backend (`server/src/`) | Frontend (`client/src/`) | Việc chung |
| --- | --- | --- | --- | --- |
| **Lê Quốc Linh** | UC02, UC03, UC04, UC12, 2.3.2, View Hub and Resource Status, View My Reservations | `ReservationService`, `PickUpService`, `RedistributionService`, `HubService`, `MyReservationsService` (+ repository, controller, route), `schedulers/ReservationExpiryScheduler.ts` | `HomePage` (danh sách Hub), `ReserveVehiclePage`, `ActiveTripPage` (UC03, UC04), `RedistributionPage`, `MyReservationsPage` | Mẫu + tổng hợp test case, checklist soát chéo |
| **Bùi Quang Nhân** | UC05, UC06, Cancel Parking Reservation, 2.3.1, Register, Sign In/Out, Customize Interface Mode | `ReturnService`, `ParkingService`, `AuthService` (+ repository, controller, route), `schedulers/HoldExpiryScheduler.ts` · khung chung `lib/`, `middleware/`, `db/schema.ts`, `simulator/VehicleSimulator.ts` | `context/`, `layouts/`, `components/`, `pages/auth/`, `SettingsPage`, `ActiveTripPage` (UC05), `MyVehiclePage` (đỗ xe) | Quy ước chung, ghép class diagram |
| **Nguyễn Hoàng Nhân** | UC09, UC10, UC13, UC14, 2.3.3 | `ChargingReservationService` (method UC09), `MonitoringService`, `AlertRepository`, `SmartChargingService`, `SimulationService`, `schedulers/HubAlertScheduler.ts`, `simulator/SimulationEngine.ts` | `MonitoringPage`, `MyVehiclePage` (đổi/hủy lịch sạc), `ChargingIncidentPage` (UC13), `SimulationPage` | Development view |
| **Ngô Minh Triết** | UC01, UC07, Cancel Charging Request, UC08, UC11 | `SearchService`, `ChargingRequestService`, `ChargingReservationService` (method UC08), `IncidentService` (+ repository, controller, route) | `HomePage` (UC01), `ChargingRequestPage`, `MyVehiclePage` (đặt lịch sạc), `ChargingIncidentPage` (UC11) | Deployment view, gộp PDF |

File dùng chung giữa hai người (ví dụ `ChargingReservationService.ts`: Triết làm UC08, Hoàng Nhân làm UC09): mỗi người chỉ sửa method của mình, pull thường xuyên để tránh xung đột.
Test: mỗi người viết test cho UC của mình trong `server/src/tests/` (file test cũng ghi `Owner`).

## 2. Kiến trúc: mỗi tầng làm một việc

```
Route  →  Controller  →  Service  →  Repository  →  SQLite
```

| Tầng | Được làm | Không được làm |
| --- | --- | --- |
| `routes/` | Khai báo URL, gắn `requireAuth` / `requireRole`, `validateBody(schema)` | Viết logic |
| `controllers/` | Đọc `req` (params, query, body), lấy người dùng bằng `currentUser(req)`, gọi service, `sendOk(res, data)` | Nghiệp vụ, truy cập db |
| `services/` | Nghiệp vụ: kiểm tra điều kiện, gọi `runIdempotent`, gọi repository, gọi simulator, gửi Socket.IO | Đọc `req`/`res`, viết truy vấn SQL |
| `repositories/` | Truy vấn Drizzle (select/insert/update) | Quyết định nghiệp vụ, gửi thông báo |

**Luồng mẫu đã chạy thật để nhìn theo:** `GET /api/hubs`
→ `routes/hubRoutes.ts` → `controllers/HubController.ts` → `services/HubService.ts` → `repositories/HubRepository.ts`.

## 3. Làm một use case từ đầu đến cuối

Ví dụ UC02 – xác nhận đặt xe. Route, controller, schema validate đã có sẵn; chỉ cần điền service và repository.

**Bước 1 – Repository** (`ReservationRepository.atomicReserveVehicle`): viết bằng `tx`, kiểm tra lại điều kiện rồi mới ghi.

```ts
atomicReserveVehicle(tx, { studentId, hubId, vehicleId, pickupDeadline, now }) {
  const vehicle = tx.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
  if (!vehicle || vehicle.hubId !== hubId || vehicle.status !== VehicleStatus.AVAILABLE) {
    throw new AppError(ErrorCode.CONFLICT, "Xe vừa được người khác đặt, vui lòng chọn xe khác.");
  }
  // ... kiểm tra sinh viên chưa có đặt xe khác ...
  tx.update(sharedVehicles).set({ status: VehicleStatus.RESERVED }).where(eq(sharedVehicles.id, vehicleId)).run();
  return tx.insert(vehicleReservations)
    .values({ studentId, vehicleId, hubId, status: VehicleReservationStatus.RESERVED, pickupDeadline })
    .returning().get();
}
```

**Bước 2 – Service** (`ReservationService.confirmReservation`): bọc trong `runIdempotent`.

```ts
async confirmReservation(requestId, studentId, hubId, vehicleId) {
  const now = new Date();
  const pickupDeadline = new Date(now.getTime() + systemConfig.pickupDeadlineMinutes * 60_000);
  const { result } = runIdempotent(requestId, "UC02.confirmReservation", studentId, (tx) =>
    reservationRepository.atomicReserveVehicle(tx, { studentId, hubId, vehicleId, pickupDeadline, now }),
  );
  return result;
}
```

**Bước 3 – Frontend**: sinh `requestId` một lần khi mở màn hình xác nhận, dùng lại khi bấm "Thử lại".

```ts
const [requestId] = useState(newRequestId);
await vehicleApi.confirmReservation(requestId, hubId, vehicleId);
```

**Bước 4 – Test**: thêm test vào `server/src/tests/<nhóm>/`, đổi `it.todo` thành `it` (xem mẫu `tests/lib/idempotency.test.ts`).

**Thêm API mới hoàn toàn:** tạo schema zod trong controller → route trong `routes/<nhóm>Routes.ts` → khai báo route ở `routes/index.ts` nếu là file route mới.

## 4. Quy tắc bắt buộc

1. **Thao tác ghi dữ liệu nhận `requestId`** (client sinh bằng `crypto.randomUUID()`, có sẵn `newRequestId()`) và chạy qua `runIdempotent`.
2. **Kiểm tra lại điều kiện bên trong transaction** trước khi ghi, không tin kết quả kiểm tra ở bước trước (người khác có thể vừa đặt mất).
3. **Hàm truyền vào `runIdempotent` phải đồng bộ** (không `await` bên trong). Gọi thiết bị (`vehicleSimulator.requestUnlock`), gửi Socket.IO làm **ngoài** transaction.
4. **`studentId` / `operatorId` luôn lấy từ `currentUser(req)`**, không bao giờ nhận từ body.
5. **Kiểm tra quyền ở backend** (`requireRole` + kiểm tra "bản ghi này có phải của người này không" trong service), không chỉ ẩn nút trên giao diện.
6. **Không tự đặt chuỗi trạng thái.** Dùng `shared/src/enums.ts`; cần trạng thái mới thì thêm vào đó (và thêm nhãn trong `StatusLabel`).
7. **Không viết số cứng** (30 phút, 20% pin...) trong service: dùng `config/systemConfig.ts`.
8. **Lỗi nghiệp vụ dùng `AppError`** với mã trong `lib/errors.ts`; không trả lỗi kiểu `res.status(400).send(...)`.
9. **Trạng thái hiển thị bằng `<StatusBadge>`** (luôn có chữ, không chỉ màu).
10. **Mô phỏng (UC14) không ghi vào bảng vận hành**: `SimulationEngine` không được import `db`.

## 5. Sửa database

1. Sửa `server/src/db/schema.ts`.
2. Chạy `npm run db:push -w server` (giữ dữ liệu) hoặc `npm run db:reset` (xóa sạch, seed lại).
3. Báo nhóm trong group chat để mọi người chạy lại `npm run db:reset` sau khi pull.

## 6. Quy ước Git

- Không push thẳng lên `main`.
- Mỗi người làm trên nhánh riêng: `feature/<tên>-<uc>`, ví dụ `feature/linh-uc02`, `feature/quangnhan-uc06`.
- Trước khi mở Pull Request: `npm run typecheck` và `npm run test` phải qua.
- Mở Pull Request vào `main`, nhờ ít nhất một người review.
- Commit message ngắn, nói rõ việc: `UC02: xác nhận đặt xe`, `fix UC06: hết hạn giữ chỗ`.
- `package-lock.json`: người tạo repo chạy `npm install` lần đầu trên Windows rồi commit file này; sau đó mọi người dùng chung, không tự xóa.

```bash
git checkout main && git pull
git checkout -b feature/linh-uc02
# ... code ...
npm run typecheck && npm run test
git add . && git commit -m "UC02: xác nhận đặt xe"
git push -u origin feature/linh-uc02
```

## 7. Gặp lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `NOT_IMPLEMENTED` (501) khi bấm nút | Bình thường: method đó chưa có người viết |
| Trang báo "Không kết nối được máy chủ" | Server chưa chạy hoặc lỗi: xem cửa sổ terminal `[server]` |
| Lỗi thiếu bảng / thiếu cột sau khi pull | `npm run db:reset` |
| Đăng nhập rồi bị đá ra | Token hết hạn (8 giờ) hoặc đã reset DB: đăng nhập lại |
| `npm install` lỗi trên Windows | Kiểm tra Node đúng bản 20.19+ / 22 LTS (`node -v`), xóa `node_modules` rồi cài lại |
