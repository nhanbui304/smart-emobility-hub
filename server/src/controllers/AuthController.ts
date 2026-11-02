// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import type { Request, Response } from "express";
import { z } from "zod";
import { ThemePreference, enumValues } from "@hub/shared";
import { sendOk } from "../lib/response";
import { currentUser } from "../middleware/auth";
import { authService } from "../services/AuthService";

export const registerSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự."),
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên."),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});

export const themeSchema = z.object({
  themePreference: z.enum(enumValues(ThemePreference)),
});

export const authController = {
  /** POST /api/auth/register */
  async register(req: Request, res: Response): Promise<void> {
    sendOk(res, await authService.register(req.body), 201);
  },

  /** POST /api/auth/login */
  async login(req: Request, res: Response): Promise<void> {
    sendOk(res, await authService.login(req.body));
  },

  /**
   * POST /api/auth/logout
   * JWT không lưu phía server: client xóa token là đăng xuất. Endpoint giữ lại để đúng luồng Sign Out
   * và để sau này có thể thêm danh sách token bị thu hồi.
   */
  logout(_req: Request, res: Response): void {
    sendOk(res, { loggedOut: true });
  },

  /** GET /api/auth/me */
  me(req: Request, res: Response): void {
    sendOk(res, authService.getMe(currentUser(req).id));
  },

  /** PATCH /api/auth/me/theme */
  updateTheme(req: Request, res: Response): void {
    sendOk(res, authService.updateTheme(currentUser(req).id, req.body.themePreference));
  },
};
