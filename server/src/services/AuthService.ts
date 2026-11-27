// Owner: Bùi Quang Nhân – Register Student Account, Sign In, Sign Out, Customize Interface Mode
import bcrypt from "bcryptjs";
import type { ConnectorType, ThemePreference, VehicleType } from "../constants";
import type { PrivateVehicle, User } from "../db/schema";
import { AppError } from "../lib/errors";
import { userRepository } from "../repositories/UserRepository";
import type { AuthUser } from "../types/dto";

export interface PrivateVehicleInput {
  plate: string;
  type: VehicleType;
  connectorType: ConnectorType;
}

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

function normalizePlate(plate: string): string {
  return plate.trim().replace(/\s+/g, " ").toUpperCase();
}

function ensureUniquePlate(normalizedPlate: string, excludeVehicleId?: string): void {
  const duplicate = userRepository
    .findAllPrivateVehicles()
    .some((v) => v.id !== excludeVehicleId && normalizePlate(v.plate) === normalizedPlate);
  if (duplicate) {
    throw new AppError("CONFLICT", "Biển số xe này đã được đăng ký trong hệ thống.");
  }
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

  /** Đăng ký xe điện cá nhân mới cho sinh viên đang đăng nhập. */
  createMyVehicle(userId: string, input: PrivateVehicleInput): PrivateVehicle {
    const plate = normalizePlate(input.plate);
    ensureUniquePlate(plate);
    return userRepository.createPrivateVehicle({
      ownerId: userId,
      plate,
      type: input.type,
      connectorType: input.connectorType,
    });
  },

  /** Cập nhật thông tin xe điện cá nhân của chính sinh viên. */
  updateMyVehicle(userId: string, vehicleId: string, input: PrivateVehicleInput): PrivateVehicle {
    const existing = userRepository.findPrivateVehicleById(vehicleId);
    if (!existing || existing.ownerId !== userId) {
      throw new AppError("NOT_FOUND", "Không tìm thấy phương tiện cá nhân của bạn.");
    }

    const plate = normalizePlate(input.plate);
    ensureUniquePlate(plate, vehicleId);

    if (input.connectorType !== existing.connectorType) {
      const now = new Date();
      if (
        userRepository.hasActiveChargingReservationForVehicle(vehicleId, now) ||
        userRepository.hasActiveChargingRequestForVehicle(vehicleId)
      ) {
        throw new AppError(
          "CONFLICT",
          "Không thể đổi chuẩn đầu cắm khi xe đang có lịch sạc hoặc yêu cầu sạc còn hiệu lực.",
        );
      }
    }

    const updated = userRepository.updatePrivateVehicle(vehicleId, {
      plate,
      type: input.type,
      connectorType: input.connectorType,
    });
    if (!updated) {
      throw new AppError("NOT_FOUND", "Không tìm thấy phương tiện cá nhân của bạn.");
    }
    return updated;
  },

  /** Xóa xe điện cá nhân khi không vướng đặt chỗ/lịch sạc còn hiệu lực hoặc lịch sử đặt sạc. */
  deleteMyVehicle(userId: string, vehicleId: string): { deleted: true; id: string } {
    const existing = userRepository.findPrivateVehicleById(vehicleId);
    if (!existing || existing.ownerId !== userId) {
      throw new AppError("NOT_FOUND", "Không tìm thấy phương tiện cá nhân của bạn.");
    }

    const now = new Date();
    if (
      userRepository.hasActiveParkingForVehicle(vehicleId, now) ||
      userRepository.hasActiveChargingRequestForVehicle(vehicleId) ||
      userRepository.hasActiveChargingReservationForVehicle(vehicleId, now)
    ) {
      throw new AppError(
        "CONFLICT",
        "Xe đang có đặt chỗ đỗ hoặc lịch sạc còn hiệu lực, vui lòng hủy trước khi xóa xe.",
      );
    }

    if (userRepository.hasAnyChargingReservationForVehicle(vehicleId)) {
      throw new AppError(
        "CONFLICT",
        "Xe đã phát sinh lịch sử đặt sạc trên hệ thống nên không thể xóa; bạn có thể cập nhật biển số hoặc loại xe.",
      );
    }

    userRepository.deletePrivateVehicle(vehicleId);
    return { deleted: true, id: vehicleId };
  },

  /** Customize Interface Mode: lưu lựa chọn sáng/tối/theo hệ thống. */
  updateTheme(userId: string, themePreference: ThemePreference): AuthUser {
    const user = userRepository.updateTheme(userId, themePreference);
    if (!user) throw new AppError("NOT_FOUND", "Không tìm thấy người dùng.");
    return toAuthUser(user);
  },
};
