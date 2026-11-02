/** Biến môi trường, đọc từ server/.env (có giá trị mặc định để chạy ngay được). */
import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "./data/dev.db",
  jwtSecret: process.env.JWT_SECRET ?? "doi-chuoi-nay-khi-trien-khai",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  simulatorEnabled: (process.env.SIMULATOR_ENABLED ?? "true") !== "false",
  isTest: process.env.NODE_ENV === "test" || process.env.VITEST === "true",
};
