/**
 * DTO dùng chung client/server.
 * Thêm DTO mới của use case mình vào đây khi cần cả hai phía cùng dùng.
 */
import type { AlertType, Role, ThemePreference, VehicleStatus, VehicleType } from "./enums";

/** Định dạng phản hồi thống nhất của mọi API. */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  themePreference: ThemePreference;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/** Trạng thái tổng hợp của một Hub (View Hub and Resource Status, UC10). */
export interface HubStatus {
  id: string;
  name: string;
  location: string;
  availableVehicles: number;
  totalVehicles: number;
  freeSlots: number;
  totalSlots: number;
  freeChargingPorts: number;
  totalChargingPorts: number;
  averageBattery: number;
  lastUpdatedAt: string;
}

export interface SharedVehicleSummary {
  id: string;
  code: string;
  type: VehicleType;
  batteryLevel: number;
  status: VehicleStatus;
  hubId: string | null;
  slotId: string | null;
  lastUpdatedAt: string;
}

export interface HubDetail extends HubStatus {
  vehicles: SharedVehicleSummary[];
}

export interface AlertDto {
  id: string;
  hubId: string;
  type: AlertType;
  value: number;
  threshold: number;
  active: boolean;
  updatedAt: string;
}

/** Payload sự kiện HUB_STATUS_UPDATED. */
export interface HubStatusUpdatedPayload {
  hubs: HubStatus[];
  emittedAt: string;
}

/** Payload sự kiện NOTIFICATION gửi riêng cho một người dùng. */
export interface NotificationPayload {
  title: string;
  message: string;
  createdAt: string;
}
