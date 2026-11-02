// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import bcrypt from "bcryptjs";
import { Role, type AuthUser, type LoginResponse, type ThemePreference } from "@hub/shared";
import type { User } from "../db/schema";
import { AppError, ErrorCode } from "../lib/errors";
import { signToken } from "../lib/jwt";
import { userRepository } from "../repositories/UserRepository";

const SALT_ROUNDS = 10;

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    themePreference: user.themePreference,
  };
}

export const authService = {
  /** Register Student Account: chỉ tạo tài khoản STUDENT. Mật khẩu luôn được hash. */
  async register(input: { email: string; password: string; fullName: string }): Promise<LoginResponse> {
    const email = input.email.trim().toLowerCase();
    if (userRepository.findByEmail(email)) {
      throw new AppError(ErrorCode.CONFLICT, "Email này đã được đăng ký.");
    }
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const user = userRepository.create({ email, passwordHash, fullName: input.fullName.trim(), role: Role.STUDENT });
    return { token: signToken({ sub: user.id, role: user.role }), user: toAuthUser(user) };
  },

  /** Sign In. Không tiết lộ email có tồn tại hay không. */
  async login(input: { email: string; password: string }): Promise<LoginResponse> {
    const user = userRepository.findByEmail(input.email.trim().toLowerCase());
    const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Email hoặc mật khẩu không đúng.");
    }
    return { token: signToken({ sub: user.id, role: user.role }), user: toAuthUser(user) };
  },

  getMe(userId: string): AuthUser {
    const user = userRepository.findById(userId);
    if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, "Phiên đăng nhập không còn hợp lệ.");
    return toAuthUser(user);
  },

  /** Customize Interface Mode: lưu lựa chọn sáng/tối/theo hệ thống. */
  updateTheme(userId: string, themePreference: ThemePreference): AuthUser {
    const user = userRepository.updateTheme(userId, themePreference);
    if (!user) throw new AppError(ErrorCode.NOT_FOUND, "Không tìm thấy người dùng.");
    return toAuthUser(user);
  },
};
