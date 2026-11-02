import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../lib/errors";

/**
 * Kiểm tra req.body bằng zod. Body sau khi kiểm tra (đã ép kiểu, bỏ trường thừa) thay vào req.body.
 *   router.post("/", validateBody(createSchema), controller.create)
 */
export function validateBody(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
}

/** Dùng trong controller cho query/params: const q = parseOrThrow(querySchema, req.query). */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new AppError("VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", details);
  }
  return result.data;
}
