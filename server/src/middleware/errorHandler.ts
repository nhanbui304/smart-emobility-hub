import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";

/** Chuyển MỌI lỗi về { ok: false, error: { code, message } }. Gắn cuối cùng trong app.ts. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res
      .status(err.httpStatus)
      .json({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // JSON sai cú pháp trong body
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "JSON không hợp lệ." } });
    return;
  }
  console.error("[error]", err);
  res
    .status(500)
    .json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Đã có lỗi xảy ra, vui lòng thử lại." } });
}

/** Route không tồn tại. */
export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json({ ok: false, error: { code: "NOT_FOUND", message: `Không tìm thấy ${req.method} ${req.path}` } });
}
