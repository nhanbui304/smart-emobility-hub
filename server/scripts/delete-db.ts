// Xóa file SQLite hiện tại (dùng trong npm run db:reset). Chạy được trên cả Windows/macOS/Linux.
import "dotenv/config";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

if (process.env.NODE_ENV === "production") {
  throw new Error("db:reset chỉ dùng cho môi trường phát triển.");
}

const dbPath = process.env.DATABASE_URL ?? "./data/dev.db";
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const file = dbPath + suffix;
  if (existsSync(file)) rmSync(file);
}
mkdirSync(dirname(dbPath), { recursive: true });
console.log(`[db:reset] Đã xóa ${dbPath}`);
