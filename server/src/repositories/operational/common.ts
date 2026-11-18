// Owner: Dùng chung (cả nhóm)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ProcessedRequest } from "../../db/schema";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const commonOps = {
  findProcessedRequest(requestId: string): ProcessedRequest | undefined {
    throw notImplemented("OperationalRepository.findProcessedRequest");
  },
};
