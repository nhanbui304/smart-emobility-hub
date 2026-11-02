import type { Response } from "express";

/** Trả phản hồi thành công theo định dạng thống nhất { ok: true, data }. */
export function sendOk(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ ok: true, data });
}
