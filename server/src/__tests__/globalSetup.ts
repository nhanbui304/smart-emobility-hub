import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";

const testDbPath = resolve(process.cwd(), "data/test.db");

function cleanupTestDb(): void {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      rmSync(`${testDbPath}${suffix}`, { force: true });
    } catch {
      // ignore if locked or missing
    }
  }
}

export function setup(): void {
  cleanupTestDb();
  mkdirSync(dirname(testDbPath), { recursive: true });
  execSync("npx drizzle-kit push --force", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDbPath },
    stdio: "pipe",
  });
}

export function teardown(): void {
  cleanupTestDb();
}
