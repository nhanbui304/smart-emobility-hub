/** Lỗi nghiệp vụ có mã. errorHandler sẽ chuyển về { ok: false, error: { code, message } }. */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  /** expectedVersion / baseVersion không khớp – dữ liệu đã bị người khác đổi. */
  | "VERSION_CONFLICT"
  | "NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

const httpStatusOf: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VERSION_CONFLICT: 409,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  httpStatus: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatusOf[code];
    this.details = details;
  }
}

/** Dùng trong thân các method chưa làm: throw notImplemented("UC02 – confirmReservation"). */
export function notImplemented(what: string): AppError {
  return new AppError("NOT_IMPLEMENTED", `Chưa hiện thực: ${what}`);
}
