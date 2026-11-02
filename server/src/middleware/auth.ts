import type { NextFunction, Request, Response } from "express";
import type { Role } from "@hub/shared";
import { AppError, ErrorCode } from "../lib/errors";
import { verifyToken } from "../lib/jwt";

/** Bắt buộc đăng nhập. Gắn req.user = { id, role }. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Bạn cần đăng nhập để tiếp tục.");
  }
  req.user = { id: payload.sub, role: payload.role };
  next();
}

/** Chỉ cho phép các vai trò được liệt kê. Dùng SAU requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này.");
    }
    next();
  };
}

/** Lấy người dùng hiện tại trong controller (đã qua requireAuth). */
export function currentUser(req: Request): { id: string; role: Role } {
  if (!req.user) throw new AppError(ErrorCode.UNAUTHORIZED, "Bạn cần đăng nhập để tiếp tục.");
  return req.user;
}
