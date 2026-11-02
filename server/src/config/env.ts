/** Biến môi trường, đọc từ server/.env (có giá trị mặc định để chạy ngay được). */
import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "./data/dev.db",
  sessionSecret: process.env.SESSION_SECRET ?? "doi-chuoi-nay-khi-trien-khai",
  simulatorEnabled: (process.env.SIMULATOR_ENABLED ?? "true") !== "false",
};
