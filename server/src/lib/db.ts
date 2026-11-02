/**
 * Kết nối SQLite dùng chung cho toàn server.
 * better-sqlite3 chạy ĐỒNG BỘ: mọi truy vấn trong db.transaction(...) chạy liền một mạch,
 * không xen kẽ với request khác – đây là nền cho các thao tác atomic...
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
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

/** Kiểu của db, dùng khi viết repository. */
export type Db = typeof db;
/** Kiểu của tx bên trong db.transaction((tx) => ...). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Repository nhận db hoặc tx đều được. */
export type DbOrTx = Db | Tx;

export function closeDb(): void {
  sqlite.close();
}
