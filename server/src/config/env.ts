/** Biến môi trường, đọc từ server/.env (có giá trị mặc định để chạy ngay được). */
import "dotenv/config";
import { randomBytes } from "node:crypto";

const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET?.trim();

if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
  throw new Error("Production requires a SESSION_SECRET of at least 32 characters.");
}

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "./data/dev.db",
  sessionSecret: sessionSecret || randomBytes(32).toString("hex"),
  simulatorEnabled: (process.env.SIMULATOR_ENABLED ?? "true") !== "false",
};
