<!--
Tiêu đề PR tuân theo Conventional Commits:
  <type>(<scope>): <short description>
Ví dụ: feat(UC02): confirm vehicle reservation / fix(UC06): release expired holds
-->

## Mô tả thay đổi & Lý do
<!-- Tóm tắt ngắn gọn thay đổi gì, thuộc UC/FR nào và lý do cần thay đổi -->
- **Phạm vi (UC/FR):**
- **Thay đổi chính:**
- **Lý do:**

## Liên kết Issue
<!-- Dùng "Closes #<số_issue>" để tự động đóng issue khi PR được merge -->
Closes #

## Cách kiểm thử (Verification)
1.
2.
3.

## Ảnh chụp màn hình (nếu có thay đổi UI)
<!-- Dán ảnh chụp trước / sau hoặc ảnh chạy thực tế tại đây -->

## Checklist bắt buộc
- [ ] Không phá vỡ kiến trúc 4 tầng (`Route → Controller → Service → Repository → SQLite`) và không tự ý đổi chữ ký class/method đã chốt ở Submission #3.
- [ ] Không commit file `.env`, secrets, `node_modules/` hoặc file `.db`.
- [ ] Đã chạy `npm run typecheck` (pass).
- [ ] Đã chạy `npm run lint` (pass).
- [ ] Đã chạy `npm run build` (pass).
- [ ] Đã chạy `npm test` (pass).
- [ ] Đã cập nhật tài liệu liên quan trong `docs/` / `README.md` (nếu thay đổi hành vi hoặc API).
