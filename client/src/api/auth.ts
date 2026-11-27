// Owner: Bùi Quang Nhân
import type { AuthUser, ConnectorType, PrivateVehicle, ThemePreference, VehicleType } from "../types";
import { api } from "./client";

export const authApi = {
  login: (email: string, password: string) => api.post<AuthUser>("/auth/login", { email, password }),
  register: (input: { email: string; password: string; fullName: string }) =>
    api.post<AuthUser>("/auth/register", input),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<AuthUser>("/auth/me"),
  /** Thêm ngoài sơ đồ: xe cá nhân của người dùng (chọn xe khi đặt chỗ đỗ, đặt lịch sạc). */
  myVehicles: () => api.get<PrivateVehicle[]>("/auth/me/vehicles"),
  createVehicle: (input: { plate: string; type: VehicleType; connectorType: ConnectorType }) =>
    api.post<PrivateVehicle>("/auth/me/vehicles", input),
  updateVehicle: (vehicleId: string, input: { plate: string; type: VehicleType; connectorType: ConnectorType }) =>
    api.patch<PrivateVehicle>(`/auth/me/vehicles/${vehicleId}`, input),
  deleteVehicle: (vehicleId: string) => api.del<{ deleted: boolean; id: string }>(`/auth/me/vehicles/${vehicleId}`),
  updateTheme: (themePreference: ThemePreference) => api.patch<AuthUser>("/auth/me/theme", { themePreference }),
};
