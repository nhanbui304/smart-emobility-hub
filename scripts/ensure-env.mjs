// Tạo server/.env từ server/.env.example nếu chưa có (chạy tự động sau npm install).
import { existsSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(root, "server", ".env.example");
const target = join(root, "server", ".env");

if (existsSync(example) && !existsSync(target)) {
  copyFileSync(example, target);
  console.log("[ensure-env] Đã tạo server/.env từ server/.env.example");
}
