/**
 * Kết nối SQLite dùng chung cho toàn server.
 *
 * Transaction: bọc các lệnh ghi trong db.transaction(() => { ... }).
 * SQLite chỉ có MỘT kết nối nên mọi lệnh db bên trong hàm đó đều thuộc transaction;
 * nếu hàm ném lỗi thì mọi thay đổi bị hủy. Hàm bên trong phải đồng bộ (không dùng await).
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../config/env";
import * as schema from "../db/schema";

mkdirSync(dirname(env.databaseUrl), { recursive: true });

const sqlite = new Database(env.databaseUrl);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function closeDb(): void {
  sqlite.close();
}
