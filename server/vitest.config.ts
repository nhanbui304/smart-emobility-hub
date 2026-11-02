import { defineConfig } from "vitest/config";

/** Test chạy trên DB riêng (data/test.db), không đụng dữ liệu dev. */
export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    globalSetup: ["./src/tests/globalSetup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "./data/test.db",
      JWT_SECRET: "test-secret",
      SIMULATOR_ENABLED: "false",
    },
    // SQLite là 1 file: chạy tuần tự các file test để tránh khóa DB
    fileParallelism: false,
  },
});
