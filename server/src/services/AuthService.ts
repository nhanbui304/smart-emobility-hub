// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import bcrypt from "bcryptjs";
import type { ThemePreference } from "../constants";
import type { PrivateVehicle, User } from "../db/schema";
import { AppError } from "../lib/errors";
import { userRepository } from "../repositories/UserRepository";
import type { AuthUser } from "../types/dto";

/** Bỏ passwordHash trước khi trả về client. */
function toAuthUser(user: User): AuthUser {
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
  async register(email: string, password: string, fullName: string): Promise<AuthUser> {
    const normalizedEmail = email.trim().toLowerCase();
    if (userRepository.findByEmail(normalizedEmail)) {
      throw new AppError("CONFLICT", "Email này đã được đăng ký.");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = userRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName: fullName.trim(),
      role: "STUDENT",
    });
    return toAuthUser(user);
  },

  /** Sign In. Không tiết lộ email có tồn tại hay không. */
  async login(email: string, password: string): Promise<AuthUser> {
    const user = userRepository.findByEmail(email.trim().toLowerCase());
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new AppError("UNAUTHORIZED", "Email hoặc mật khẩu không đúng.");
    }
    return toAuthUser(user);
  },

  getMe(userId: string): AuthUser {
    const user = userRepository.findById(userId);
    if (!user) throw new AppError("UNAUTHORIZED", "Phiên đăng nhập không còn hợp lệ.");
    return toAuthUser(user);
  },

  /** Thêm ngoài sơ đồ: xe cá nhân của người dùng đang đăng nhập. */
  getMyVehicles(userId: string): PrivateVehicle[] {
    return userRepository.findPrivateVehicles(userId);
  },

  /** Customize Interface Mode: lưu lựa chọn sáng/tối/theo hệ thống. */
  updateTheme(userId: string, themePreference: ThemePreference): AuthUser {
    const user = userRepository.updateTheme(userId, themePreference);
    if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng.");
    return toAuthUser(user);
  },
};
