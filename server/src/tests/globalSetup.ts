/** Tạo lại DB test sạch (schema mới nhất) trước khi chạy toàn bộ test. */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const TEST_DB = "./data/test.db";

export default function setup(): void {
  mkdirSync("./data", { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    if (existsSync(TEST_DB + suffix)) rmSync(TEST_DB + suffix);
  }
  execSync("npx drizzle-kit push --force", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: TEST_DB },
  });
}
