import type { Role } from "@hub/shared";

declare global {
  namespace Express {
    interface Request {
      /** Gắn bởi middleware requireAuth. studentId/operatorId LUÔN lấy từ đây. */
      user?: { id: string; role: Role };
    }
  }
}

export {};
