// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import type { Request, Response } from "express";
import { z } from "zod";
import { THEME_PREFERENCES } from "../constants";
import { sendOk } from "../lib/response";
import { currentUser } from "../middleware/auth";
import { authService } from "../services/AuthService";
import type { AuthUser } from "../types/dto";

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
  themePreference: z.enum(THEME_PREFERENCES),
});

/** Lưu người dùng vào phiên đăng nhập (tạo phiên mới để tránh dùng lại phiên cũ). */
function startSession(req: Request, user: AuthUser): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = { id: user.id, role: user.role };
      resolve();
    });
  });
}

export const authController = {
  /** POST /api/auth/register – đăng ký xong thì đăng nhập luôn */
  async register(req: Request, res: Response): Promise<void> {
    const { email, password, fullName } = req.body;
    const user = await authService.register(email, password, fullName);
    await startSession(req, user);
    sendOk(res, user, 201);
  },

  /** POST /api/auth/login */
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;
    const user = await authService.login(email, password);
    await startSession(req, user);
    sendOk(res, user);
  },

  /** POST /api/auth/logout */
  logout(req: Request, res: Response): void {
    req.session.destroy(() => sendOk(res, { loggedOut: true }));
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
