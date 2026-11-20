// Owner: Bùi Quang Nhân
import type { AuthUser, PrivateVehicle, ThemePreference } from "../types";
import { api } from "./client";

export const authApi = {
  login: (email: string, password: string) => api.post<AuthUser>("/auth/login", { email, password }),
  register: (input: { email: string; password: string; fullName: string }) =>
    api.post<AuthUser>("/auth/register", input),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<AuthUser>("/auth/me"),
  /** Thêm ngoài sơ đồ: xe cá nhân của người dùng (chọn xe khi đặt chỗ đỗ, đặt lịch sạc). */
  myVehicles: () => api.get<PrivateVehicle[]>("/auth/me/vehicles"),
  updateTheme: (themePreference: ThemePreference) => api.patch<AuthUser>("/auth/me/theme", { themePreference }),
};
