import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { AppError, ErrorCode } from "../lib/errors";

/**
 * Validate req.body bằng zod. Body sau khi parse (đã ép kiểu, bỏ trường thừa) thay vào req.body.
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
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Dữ liệu gửi lên không hợp lệ.",
      400,
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}
