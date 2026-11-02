/**
 * Chống gửi lặp + thao tác nguyên tử (atomic) – MẪU CHUNG cho mọi thao tác ghi dữ liệu.
 *
 * Cách dùng trong service:
 *
 *   const { result } = runIdempotent(requestId, "UC02.confirmReservation", studentId, (tx) => {
 *     // 1. Kiểm tra LẠI điều kiện bằng tx (xe còn AVAILABLE? sinh viên chưa có đặt xe khác?)
 *     // 2. Ghi dữ liệu bằng tx
 *     // 3. return kết quả (sẽ được lưu vào request_logs)
 *     return reservationRepository.atomicReserveVehicle(tx, ...);
 *   });
 *
 * Quy tắc:
 * - `fn` PHẢI là hàm đồng bộ (không async/await bên trong). better-sqlite3 chạy transaction
 *   đồng bộ nên toàn bộ fn chạy liền một mạch, không request nào chen vào giữa.
 * - Việc gọi thiết bị (VehicleSimulator.requestUnlock...) hay gửi thông báo làm NGOÀI fn,
 *   trước hoặc sau transaction – đúng như sequence diagram.
 * - Nếu fn ném lỗi: mọi thay đổi bị hủy, KHÔNG lưu request_logs, client có thể gửi lại.
 * - Nếu requestId đã xử lý: trả lại kết quả cũ, không chạy fn lần nữa.
 */
import { eq } from "drizzle-orm";
import { requestLogs } from "../db/schema";
import { db, type Tx } from "./db";
import { AppError, ErrorCode } from "./errors";

export interface IdempotentOutcome<T> {
  result: T;
  /** true nếu đây là lần gửi lặp và kết quả lấy từ lần xử lý trước. */
  replayed: boolean;
}

export function runIdempotent<T>(
  requestId: string,
  operation: string,
  userId: string,
  fn: (tx: Tx) => T,
): IdempotentOutcome<T> {
  return db.transaction(
    (tx) => {
      const existing = tx.select().from(requestLogs).where(eq(requestLogs.requestId, requestId)).get();

      if (existing) {
        if (existing.operation !== operation || existing.userId !== userId) {
          throw new AppError(
            ErrorCode.DUPLICATE_REQUEST_MISMATCH,
            "requestId này đã được dùng cho một thao tác khác.",
          );
        }
        return { result: JSON.parse(existing.resultJson) as T, replayed: true };
      }

      const result = fn(tx);
      if (result instanceof Promise) {
        throw new Error("runIdempotent: fn phải là hàm đồng bộ, không được trả về Promise.");
      }

      tx.insert(requestLogs)
        .values({ requestId, operation, userId, resultJson: JSON.stringify(result ?? null) })
        .run();

      return { result, replayed: false };
    },
    // IMMEDIATE: khóa ghi ngay từ đầu để hai request cùng lúc không đọc cùng một trạng thái cũ.
    { behavior: "immediate" },
  );
}
