# Software Test Document (STD)

> **Tài liệu test case chi tiết theo thành viên:**
> - [quangnhan-method-testcase.md](submission-3/quangnhan/quangnhan-method-testcase.md) (UC05, UC06, 2.3.1)
> - [qlinh_method+testcase.md](submission-3/quoclinh/qlinh_method+testcase.md) (UC02, UC03, UC04, UC12, 2.3.2)
> - [Test cases.docx](submission-3/mtriet-submission3/Test%20cases.docx) (UC01, UC07, UC08, UC11)
> - Walkthroughs UC09, UC10, UC13, UC14 trong `docs/submission-3/hoangnhan_submission3/`

---

## 1. Chiến lược & Các mức kiểm thử

| Mức kiểm thử | Công cụ / Cách thực hiện | Phạm vi chính |
| --- | --- | --- |
| **Static Analysis** | TypeScript (`npm run typecheck`) + ESLint (`npm run lint`) | Toàn bộ `server/src/` và `client/src/`. |
| **Unit & Integration Tests** | **Vitest** + `@vitest/coverage-v8` (`npm test`) | Nghiệp vụ lõi trên SQLite test riêng (`server/data/test.db`, không chạm `dev.db`): `AuthService`, `ReservationService`, `ParkingService` (kèm transaction, idempotency `requestId`, phân quyền và hết hạn giữ chỗ). |
| **Production Build Verification** | Vite (`npm run build`) | Kiểm tra đóng gói toàn bộ frontend React + TypeScript không lỗi. |
| **System / E2E Manual Demo** | Kịch bản 6 phút ([KICH_BAN_VIDEO_DEMO.md](submission-4/KICH_BAN_VIDEO_DEMO.md)) | Toàn bộ 14 UC trên trình duyệt (Student + Operator), đồng bộ polling 3 giây, chế độ Sáng/Tối và nhánh lỗi thiết bị giả lập. |

## 2. Quy ước đặt tên Test Case

- Định dạng chuẩn: `TC-<UC/FR>-<STT>` (ví dụ: `TC-UC02-01`, `TC-UC06-03`, `TC-2.3.1-01`, `TC-AUTH-01`).
- Tên file test tự động đặt trong `server/src/__tests__/*.test.ts`.

## 3. Bảng tổng hợp Test Case chính (14 Use Cases + Nền)

| Nhóm / UC | Mã TC tiêu biểu | Kịch bản kiểm thử trọng tâm | Trạng thái |
| --- | --- | --- | --- |
| **Auth & Theme** | `TC-AUTH-01..05` | Đăng ký tài khoản Student, chống trùng email, đăng nhập đúng/sai mật khẩu, cập nhật theme. | Automated (Vitest) |
| **UC01** | `TC-UC01-01..04` | Lọc phương tiện theo loại xe & mức pin tối thiểu; chuyển sang đặt dịch vụ. | Manual E2E |
| **UC02** | `TC-UC02-01..05` | Đặt xe thành công, chống gửi lặp `requestId`, chặn đặt trùng khi xe đã `RESERVED`, chặn sinh viên đang có đặt xe hiệu lực. | Vitest `01..03`, còn lại kiểm thử thủ công. |
| **UC03** | `TC-UC03-01..04` | Hủy đặt xe còn hạn → trả xe về `AVAILABLE`; chặn hủy đặt xe của người khác (`FORBIDDEN`); chống gửi lặp hủy. | Vitest `01..02`, còn lại kiểm thử thủ công. |
| **UC04** | `TC-UC04-01..04` | Mở khóa nhận xe thành công; xử lý nhánh thiết bị `FAILED`/`UNKNOWN`. | Manual E2E |
| **UC05** | `TC-UC05-01..05` | Trả xe về Hub có chỗ trống; giải phóng chỗ khi dừng trả xe; xử lý lỗi khóa xe. | Manual E2E |
| **UC06 & 2.3.1** | `TC-UC06-01..04`, `TC-2.3.1-01` | Tìm chỗ đỗ, giữ tạm (`HELD`), xác nhận (`CONFIRMED`), chống gửi lặp `requestId`, hủy đặt chỗ, tự động giải phóng lượt giữ quá hạn (`expireDueHolds`). | Automated (Vitest) + E2E |
| **UC07** | `TC-UC07-01..04` | Sạc ngay khi có cổng trống; xếp hàng đợi khi đầy cổng; hủy yêu cầu sạc. | Manual E2E |
| **UC08** | `TC-UC08-01..04` | Đặt lịch sạc trước cho xe cá nhân; chặn trùng khung giờ/cổng sạc. | Manual E2E |
| **UC09** | `TC-UC09-01..04` | Xem, đổi khung giờ và hủy lịch sạc; kiểm tra xung đột `version`. | Manual E2E |
| **UC10 & 2.3.3** | `TC-UC10-01..04`, `TC-2.3.3-01` | Giám sát 5 Hub, 4 chỉ số KPI, kích hoạt/tắt cảnh báo ngưỡng mỗi chu kỳ. | Manual E2E |
| **UC11** | `TC-UC11-01..04` | Ghi nhận sự cố, lập phương án xử lý, đóng sự cố và khôi phục tài nguyên. | Manual E2E |
| **UC12** | `TC-UC12-01..04` | Chọn Hub nguồn/đích, kiểm tra sức chứa tiếp nhận, hoàn tất điều chuyển xe. | Manual E2E |
| **UC13** | `TC-UC13-01..04` | Sinh và áp dụng lịch sạc thông minh với kiểm tra `baseVersion`. | Manual E2E |
| **UC14** | `TC-UC14-01..04` | Chụp snapshot độc lập, chạy kịch bản What-if, so sánh KPI cơ sở vs kịch bản (không ghi đè bảng vận hành). | Manual E2E |
| **2.3.2** | `TC-2.3.2-01` | Hết hạn nhận xe, giải phóng xe về danh sách khả dụng. | Manual E2E |

## 4. Hướng dẫn chạy kiểm thử tự động & xem Coverage

Từ thư mục gốc `smart-emobility-hub/`:

```bash
npm run typecheck       # Kiểm tra kiểu TypeScript (server + client)
npm run lint            # Kiểm tra quy tắc ESLint (server + client)
npm run build           # Kiểm tra build production (client)
npm test                # Chạy toàn bộ bộ test Vitest trên DB test cô lập
npm run test:coverage   # Chạy test và xuất báo cáo coverage (server/coverage/)
```

> **Cô lập dữ liệu test:** File `server/vitest.config.ts` cấu hình biến `DATABASE_URL=./data/test.db` và chạy `globalSetup` khởi tạo schema sạch trước mỗi lượt test, sau đó dọn file DB test — hoàn toàn không ảnh hưởng dữ liệu phát triển (`server/data/dev.db`).
