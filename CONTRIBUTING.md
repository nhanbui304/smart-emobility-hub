# Hướng dẫn làm việc chung

## 1. Ai làm file nào

Mỗi file có dòng `// Owner: <tên> – <UC>` ở đầu. Tìm tên mình trong project để thấy hết việc của mình.

| Người phụ trách | Use case | Backend (`server/src/`) | Frontend (`client/src/`) |
| --- | --- | --- | --- |
| **Lê Quốc Linh** | UC02, UC03, UC04, UC12, 2.3.2, View Hub and Resource Status, View My Reservations | `ReservationService`, `PickUpService`, `RedistributionService`, `HubService`, `MyReservationsService` + `ReservationRepository`, `PickUpRepository`, `RedistributionRepository`, `MyReservationsRepository`, `HubRepository`, `schedulers/ReservationExpiryScheduler.ts` | `HomePage` (danh sách Hub), `ReserveVehiclePage`, `ActiveTripPage` (UC03, UC04), `RedistributionPage`, `MyReservationsPage` |
| **Bùi Quang Nhân** | UC05, UC06, Cancel Parking Reservation, 2.3.1, Register, Sign In/Out, Customize Interface Mode | `ReturnService`, `ParkingService`, `AuthService` + `operational/parkingOps.ts`, `operational/returnOps.ts`, `operational/common.ts`, `UserRepository`, `schedulers/HoldExpiryScheduler.ts` · khung chung: `lib/`, `middleware/`, `db/`, `simulator/VehicleSimulator.ts` | `context/`, `layouts/`, `components/`, `pages/auth/`, `SettingsPage`, `ActiveTripPage` (UC05), `MyVehiclePage` (đỗ xe) |
| **Nguyễn Hoàng Nhân** | UC09, UC10, UC13, UC14, 2.3.3 | `ChargingReservationService` (method UC09), `MonitoringService`, `SmartChargingService`, `SimulationService`, `NotificationService` + `AlertRepository`, `SimulationRunRepository`, `operational/rescheduleOps.ts`, `operational/chargingScheduleOps.ts`, `operational/simulationOps.ts`, `schedulers/HubAlertScheduler.ts`, `simulator/SimulationEngine.ts` | `MonitoringPage`, `MyVehiclePage` (đổi/hủy lịch sạc), `ChargingIncidentPage` (UC13), `SimulationPage` |
| **Ngô Minh Triết** | UC01, UC07, Cancel Charging Request, UC08, UC11 | `SearchService`, `ChargingRequestService`, `ChargingReservationService` (method UC08), `IncidentService` + `MobilityRepository`, `operational/chargingRequestOps.ts`, `operational/chargingReservationOps.ts`, `operational/incidentOps.ts` | `HomePage` (UC01), `ChargingRequestPage`, `MyVehiclePage` (đặt lịch sạc), `ChargingIncidentPage` (UC11) |

Controller, route và hàm gọi API phía client (`client/src/api/`) đã có sẵn cho mọi method trong class diagram; thường chỉ cần viết Service, Repository và trang giao diện.

File dùng chung giữa hai người (ví dụ `ChargingReservationService.ts`: Triết làm UC08, Hoàng Nhân làm UC09): mỗi người chỉ sửa method của mình, pull thường xuyên để tránh xung đột.

### Code khớp class diagram Submission #3

Tên class, tên method và tham số trong code **giống hệt** class diagram đã nộp ở Submission #3 (file `.drawio` trong `docs/`). Báo cáo cuối dùng lại sơ đồ này nên:

- Không đổi tên hoặc thêm/bớt tham số của method có trong sơ đồ. Thật sự cần đổi thì báo nhóm và sửa cả sơ đồ.
- Method public (`+`) là method của đối tượng `xxxService` / `xxxRepository`. Method private (`–`) là `function` ở cuối file Service.
- `OperationalRepository` là MỘT class trong sơ đồ nhưng được tách thành nhiều file trong `repositories/operational/` theo người phụ trách; Service luôn gọi `operationalRepository.<method>`.
- Thêm hàm phụ không có trong sơ đồ được (đặt `function` trong file, không export), miễn chữ ký các method trong sơ đồ giữ nguyên.

Chi tiết những chỗ code khác sơ đồ (và lý do): `docs/submission-3/ANH_XA_CLASS_DIAGRAM_CODE.md`.

Mục tiêu final demo: chạy được ít nhất 85% chức năng. Mỗi chức năng chỉ cần luồng chính chạy được và 1–2 trường hợp lỗi quan trọng; không cần xử lý hết extension trong mô tả use case.

## 2. Kiến trúc: mỗi tầng làm một việc

```
Route  →  Controller  →  Service  →  Repository  →  SQLite
```

| Tầng | Được làm | Không được làm |
| --- | --- | --- |
| `routes/` | Khai báo URL, gắn `requireAuth` / `requireRole`, `validateBody(schema)` | Viết logic |
| `controllers/` | Đọc `req` (params, query, body), lấy người dùng bằng `currentUser(req)`, gọi service, `sendOk(res, data)` | Nghiệp vụ, truy cập db |
| `services/` | Nghiệp vụ: kiểm tra điều kiện, bọc `db.transaction`, gọi repository, gọi simulator | Đọc `req`/`res`, viết truy vấn |
| `repositories/` | Truy vấn Drizzle (select/insert/update) | Quyết định nghiệp vụ |

**Luồng mẫu đã chạy thật để nhìn theo:** `GET /api/hubs`
→ `routes/hubRoutes.ts` → `controllers/HubController.ts` → `services/HubService.ts` → `repositories/HubRepository.ts`.

## 3. Làm một use case từ đầu đến cuối

Ví dụ UC02 – xác nhận đặt xe. Route, controller, kiểm tra dữ liệu gửi lên và hàm gọi API phía client đã có sẵn; chỉ cần điền repository, service và giao diện. Chữ ký method lấy đúng theo class diagram Sub #3.

**Bước 1 – Repository** (`ReservationRepository.atomicReserveVehicle`): kiểm tra lại điều kiện rồi mới ghi, ghi luôn `processed_requests` trong cùng thao tác để chống gửi lặp.

```ts
atomicReserveVehicle(requestId: string, studentId: string, hubId: string, vehicleId: string, pickupDeadlineDuration: number, now: Date): VehicleReservation {
  const vehicle = db.select().from(sharedVehicles).where(eq(sharedVehicles.id, vehicleId)).get();
  if (!vehicle || vehicle.hubId !== hubId || vehicle.status !== "AVAILABLE") {
    throw new AppError("CONFLICT", "Xe vừa được người khác đặt, vui lòng chọn xe khác.");
  }
  // ... kiểm tra sinh viên chưa có đặt xe khác ...
  db.update(sharedVehicles).set({ status: "RESERVED" }).where(eq(sharedVehicles.id, vehicleId)).run();
  const reservation = db
    .insert(vehicleReservations)
    .values({ studentId, vehicleId, hubId, status: "RESERVED", pickupDeadline: new Date(now.getTime() + pickupDeadlineDuration * 60_000) })
    .returning()
    .get();
  db.insert(processedRequests).values({ requestId, actorId: studentId, operation: "RESERVE_VEHICLE", resultId: reservation.id }).run();
  return reservation;
},
```

**Bước 2 – Service** (`ReservationService.confirmReservation`): gửi lặp thì trả kết quả cũ; bọc trong `db.transaction` để "kiểm tra rồi ghi" chạy liền một mạch, hai người bấm cùng lúc thì chỉ một người được.

```ts
async confirmReservation(requestId: string, studentId: string, hubId: string, vehicleId: string): Promise<VehicleReservation> {
  const done = reservationRepository.findProcessedRequest(requestId);
  if (done) return reservationRepository.findById(done.resultId)!;
  return db.transaction(() =>
    reservationRepository.atomicReserveVehicle(requestId, studentId, hubId, vehicleId, systemConfig.pickupDeadlineMinutes, new Date()),
  );
},
```

**Bước 3 – Frontend**: gọi hàm có sẵn trong `client/src/api/` (tên giống method của Controller), hiển thị lỗi bằng `<ErrorMessage>`. `requestId` sinh **một lần** cho mỗi lần bấm xác nhận; bấm lại do mất mạng thì gửi lại cùng mã.

```ts
const requestId = crypto.randomUUID();
await reservationApi.confirmReservation(requestId, hubId, vehicleId);
```

**Thêm API mới hoàn toàn** (method không có trong sơ đồ – hạn chế): tạo schema zod trong controller → route trong `routes/<nhóm>Routes.ts` → khai báo ở `routes/index.ts` nếu là file route mới → thêm hàm gọi trong `client/src/api/` → báo nhóm để cập nhật sơ đồ.

## 4. Quy tắc bắt buộc

1. **Thao tác ghi quan trọng (đặt xe, giữ chỗ, đặt lịch sạc...) bọc trong `db.transaction(() => { ... })`** và kiểm tra lại điều kiện bên trong trước khi ghi.
2. **Hàm truyền vào `db.transaction` phải đồng bộ** (không `await` bên trong). Gọi thiết bị (`vehicleSimulator.requestUnlock`) làm **ngoài** transaction.
3. **`studentId` / `operatorId` luôn lấy từ `currentUser(req)`**, không bao giờ nhận từ body.
4. **Kiểm tra quyền ở backend** (`requireRole` + kiểm tra "bản ghi này có phải của người này không" trong service), không chỉ ẩn nút trên giao diện.
5. **Không tự đặt chuỗi trạng thái.** Dùng danh sách trong `server/src/constants.ts`; cần trạng thái mới thì thêm vào đó và thêm nhãn trong `client/src/statusLabels.ts`.
6. **Không viết số cứng** (30 phút, 20% pin...) trong service: dùng `config/systemConfig.ts`.
7. **Lỗi nghiệp vụ dùng `AppError`** (`throw new AppError("CONFLICT", "...")`); không trả lỗi kiểu `res.status(400).send(...)`.
8. **Thao tác ghi có `requestId` thì chống gửi lặp**: gặp lại `requestId` đã xử lý (`findProcessedRequest`) thì trả kết quả cũ; xử lý mới thì ghi một dòng `processed_requests` (operation lấy trong `REQUEST_OPERATIONS`) trong cùng transaction.
9. **Trạng thái hiển thị bằng `<StatusBadge>`** (luôn có chữ, không chỉ màu).
10. **Mô phỏng (UC14) không đọc/ghi bảng vận hành**: `SimulationEngine` chỉ làm việc trên snapshot đã chụp (`simulation_snapshots`).
11. **TypeScript dùng ở mức cơ bản**: khai báo kiểu cho tham số và dữ liệu là đủ; gặp lỗi kiểu khó thì hỏi nhóm trước khi dùng `any`.

## 5. Sửa database

1. Sửa `server/src/db/schema.ts`.
2. Chạy `npm run db:push --prefix server` (giữ dữ liệu) hoặc `npm run db:reset` (xóa sạch, seed lại).
3. Báo nhóm trong group chat để mọi người chạy lại `npm run db:reset` sau khi pull.

Xem dữ liệu trên trình duyệt: `npm run db:studio --prefix server`.

## 6. Quy ước Git

**Nhánh**

- Không commit, push thẳng lên `main`; không tự merge vào `main`.
- Mỗi việc một nhánh, tạo từ `main` mới nhất:
  - code: `feature/<tên>-<uc>` – ví dụ `feature/linh-uc02`, `feature/triet-uc08`
  - sửa lỗi: `fix/<tên>-<việc>` – ví dụ `fix/hoangnhan-alert`
  - sơ đồ, báo cáo: `docs/<tên>-<việc>` – ví dụ `docs/quangnhan-class-diagram`

**Commit** (Conventional Commits): `<loại>(<phạm vi>): <mô tả ngắn>`

| Loại | Dùng khi | Ví dụ |
| --- | --- | --- |
| `feat` | Thêm chức năng | `feat(UC02): confirm vehicle reservation` |
| `fix` | Sửa lỗi | `fix(UC06): release expired parking holds` |
| `docs` | Tài liệu, sơ đồ | `docs(class): add parking subsystem diagram` |
| `refactor` | Sửa code, không đổi chức năng | `refactor(UC10): extract alert calculation` |
| `style` | Giao diện, CSS | `style(UC08): update charging schedule form` |
| `chore` | Cấu hình, thư viện | `chore: add dayjs dependency` |

Mô tả viết bằng tiếng Anh, thể mệnh lệnh, chữ thường, không dấu chấm cuối (`add`, `fix`, `update`...). Mỗi commit một ý. Không commit `node_modules`, `.env`, file `.db`.

**Quy trình**

```bash
git checkout main && git pull
git checkout -b feature/linh-uc02
# ... code ...
npm run typecheck
git add .
git commit -m "feat(UC02): confirm vehicle reservation"
git push -u origin feature/linh-uc02
```

1. Push xong thì mở Pull Request vào `main` trên GitHub, ghi ngắn đã làm gì và cách thử.
2. Gửi link PR vào group để mọi người xem và góp ý.
3. Sửa theo góp ý: commit tiếp trên cùng nhánh, không mở PR mới.
4. Có ít nhất 1 người đồng ý thì Quang Nhân merge.
5. Trước khi làm việc mới: `git checkout main && git pull` rồi tạo nhánh mới.

`package-lock.json` (trong `server/` và `client/`): commit cùng code, không tự xóa.

## 7. Gặp lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| `NOT_IMPLEMENTED` (501) khi bấm nút | Bình thường: method đó chưa có người viết |
| Trang báo "Không kết nối được máy chủ" | Server chưa chạy hoặc lỗi: xem cửa sổ terminal `[server]` |
| Lỗi thiếu bảng / thiếu cột sau khi pull | `npm run db:reset` |
| Bị đá ra trang đăng nhập | Server vừa khởi động lại (phiên đăng nhập lưu trong bộ nhớ) hoặc đã 8 giờ: đăng nhập lại |
| `npm install` lỗi trên Windows | Kiểm tra Node đúng bản 20.19+ / 22 LTS (`node -v`), xóa `node_modules` trong `server/` và `client/` rồi cài lại |
