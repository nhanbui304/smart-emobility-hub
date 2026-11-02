import type { Response } from "express";
import type { ApiSuccess } from "@hub/shared";

/** Trả phản hồi thành công theo định dạng thống nhất { ok: true, data }. */
export function sendOk<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { ok: true, data };
  res.status(status).json(body);
}
