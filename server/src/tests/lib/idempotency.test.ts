// Test mẫu cho cơ chế chống gửi lặp (runIdempotent) – cả nhóm viết test theo mẫu này.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { hubs, requestLogs } from "../../db/schema";
import { db } from "../../lib/db";
import { AppError, ErrorCode } from "../../lib/errors";
import { runIdempotent } from "../../lib/idempotency";

const USER_ID = "user-test";

function createHub(name: string) {
  return (tx: Parameters<Parameters<typeof runIdempotent>[3]>[0]) =>
    tx.insert(hubs).values({ name, location: "test" }).returning().get();
}

describe("runIdempotent", () => {
  beforeEach(() => {
    db.delete(requestLogs).run();
    db.delete(hubs).run();
  });

  it("gọi 2 lần cùng requestId chỉ tạo 1 bản ghi và trả cùng kết quả", () => {
    const requestId = crypto.randomUUID();

    const first = runIdempotent(requestId, "TEST.createHub", USER_ID, createHub("Hub A"));
    const second = runIdempotent(requestId, "TEST.createHub", USER_ID, createHub("Hub A"));

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.result.id).toBe(first.result.id);
    expect(db.select().from(hubs).where(eq(hubs.name, "Hub A")).all()).toHaveLength(1);
    expect(db.select().from(requestLogs).where(eq(requestLogs.requestId, requestId)).all()).toHaveLength(1);
  });

  it("requestId khác nhau thì xử lý độc lập", () => {
    runIdempotent(crypto.randomUUID(), "TEST.createHub", USER_ID, createHub("Hub B"));
    runIdempotent(crypto.randomUUID(), "TEST.createHub", USER_ID, createHub("Hub B"));
    expect(db.select().from(hubs).where(eq(hubs.name, "Hub B")).all()).toHaveLength(2);
  });

  it("lỗi trong fn thì không ghi gì và cho phép gửi lại", () => {
    const requestId = crypto.randomUUID();
    expect(() =>
      runIdempotent(requestId, "TEST.createHub", USER_ID, (tx) => {
        createHub("Hub C")(tx);
        throw new AppError(ErrorCode.CONFLICT, "giả lập xung đột");
      }),
    ).toThrow(AppError);
    expect(db.select().from(hubs).where(eq(hubs.name, "Hub C")).all()).toHaveLength(0);

    const retry = runIdempotent(requestId, "TEST.createHub", USER_ID, createHub("Hub C"));
    expect(retry.replayed).toBe(false);
    expect(db.select().from(hubs).where(eq(hubs.name, "Hub C")).all()).toHaveLength(1);
  });

  it("dùng lại requestId cho thao tác khác thì báo DUPLICATE_REQUEST_MISMATCH", () => {
    const requestId = crypto.randomUUID();
    runIdempotent(requestId, "TEST.createHub", USER_ID, createHub("Hub D"));
    expect(() => runIdempotent(requestId, "TEST.other", USER_ID, createHub("Hub D"))).toThrowError(
      expect.objectContaining({ code: ErrorCode.DUPLICATE_REQUEST_MISMATCH }),
    );
  });
});
