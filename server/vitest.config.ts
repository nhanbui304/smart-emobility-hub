import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    globalSetup: ["src/__tests__/globalSetup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "./data/test.db",
      SIMULATOR_ENABLED: "false",
      SESSION_SECRET: "test-session-secret",
    },
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./test-results/junit.xml",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/services/**/*.ts", "src/repositories/**/*.ts"],
    },
  },
});
