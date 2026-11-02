// Tạo server/.env từ server/.env.example nếu chưa có (chạy tự động sau npm install).
import { copyFileSync, existsSync } from "node:fs";

if (existsSync(".env.example") && !existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("[ensure-env] Đã tạo server/.env từ server/.env.example");
}
