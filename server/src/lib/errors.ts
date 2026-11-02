/** Lỗi nghiệp vụ có mã. errorHandler sẽ chuyển về { ok: false, error: { code, message } }. */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  /** requestId đã được dùng cho thao tác khác hoặc bởi người khác. */
  DUPLICATE_REQUEST_MISMATCH: "DUPLICATE_REQUEST_MISMATCH",
  /** expectedVersion / baseVersion không khớp – dữ liệu đã bị người khác đổi. */
  VERSION_CONFLICT: "VERSION_CONFLICT",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const defaultStatus: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_REQUEST_MISMATCH: 409,
  VERSION_CONFLICT: 409,
  NOT_IMPLEMENTED: 501,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, httpStatus?: number, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus ?? defaultStatus[code];
    this.details = details;
  }
}

/** Dùng trong thân các method chưa làm: throw notImplemented("UC02 – confirmReservation"). */
export function notImplemented(what: string): AppError {
  return new AppError(ErrorCode.NOT_IMPLEMENTED, `Chưa hiện thực: ${what}`);
}
