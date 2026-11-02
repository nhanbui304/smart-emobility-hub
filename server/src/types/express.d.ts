import "express-session";
import type { Role } from "../constants";

declare module "express-session" {
  interface SessionData {
    /** Người dùng đang đăng nhập. studentId / operatorId LUÔN lấy từ đây. */
    user?: { id: string; role: Role };
  }
}
