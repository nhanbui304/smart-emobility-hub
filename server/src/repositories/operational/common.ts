// Owner: Dùng chung (cả nhóm)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import { eq } from "drizzle-orm";
import { processedRequests, type ProcessedRequest } from "../../db/schema";
import { db } from "../../lib/db";

export const commonOps = {
  /**
   * Tra cứu yêu cầu ghi đã xử lý theo requestId để chống gửi lặp (Idempotency – Mục 3.1 NFR & Sub #3 mục 4.1).
   */
  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    return db.select().from(processedRequests).where(eq(processedRequests.requestId, requestId)).get();
  },
};
