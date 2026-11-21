// Owner: Dùng chung (cả nhóm)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { eq } from "drizzle-orm";
import type { RequestOperation } from "../../constants";
import { processedRequests, type ProcessedRequest } from "../../db/schema";
import { db } from "../../lib/db";
import { AppError } from "../../lib/errors";

export const commonOps = {
  /** Yêu cầu ghi đã xử lý với requestId này (chống gửi lặp – quy ước Sub #3 mục 4.1). */
  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    return db.select().from(processedRequests).where(eq(processedRequests.requestId, requestId)).get();
  },
};

// ---------- Hàm hỗ trợ dùng TRONG transaction của các method atomic (không phải method của class) ----------

/**
 * requestId đã được xử lý cho đúng người và đúng thao tác → trả resultId cũ để trả lại kết quả cũ.
 * requestId đã bị dùng cho người/thao tác khác → báo lỗi (client phải sinh mã mới).
 */
export function previousResultId(requestId: string, actorId: string, operation: RequestOperation): string | undefined {
  const done = commonOps.findProcessedRequest(requestId);
  if (!done) return undefined;
  if (done.actorId !== actorId || done.operation !== operation) {
    throw new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho thao tác khác, vui lòng thử lại.");
  }
  return done.resultId;
}

/** Ghi nhận requestId đã xử lý, gọi trong CÙNG transaction với thao tác chính. */
export function recordProcessedRequest(
  requestId: string,
  actorId: string,
  operation: RequestOperation,
  resultId: string,
): void {
  db.insert(processedRequests).values({ requestId, actorId, operation, resultId }).run();
}
