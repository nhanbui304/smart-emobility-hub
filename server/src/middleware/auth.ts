import type { NextFunction, Request, Response } from "express";
import type { Role } from "../constants";
import { AppError } from "../lib/errors";

/** Bắt buộc đăng nhập. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session.user) {
    throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.");
  }
  next();
}

/** Chỉ cho phép các vai trò được liệt kê. Dùng SAU requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.session.user;
    if (!user || !roles.includes(user.role)) {
      throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }
    next();
  };
}

/** Lấy người dùng hiện tại trong controller (đã qua requireAuth). */
export function currentUser(req: Request): { id: string; role: Role } {
  const user = req.session.user;
  if (!user) throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục.");
  return user;
}
