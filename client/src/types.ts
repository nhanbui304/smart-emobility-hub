/**
 * Kiểu dữ liệu API trả về – bản sao của server/src/types/dto.ts và server/src/constants.ts.
 * Sửa bên server thì sửa cả ở đây.
 */
export type Role = "STUDENT" | "OPERATOR";
export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  themePreference: ThemePreference;
}

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

export interface VehicleSummary {
  id: string;
  code: string;
  type: "E_BIKE" | "E_MOTORBIKE";
  batteryLevel: number;
  status: string;
  hubId: string | null;
  slotId: string | null;
  lastUpdatedAt: string;
}

export interface HubDetail extends HubStatus {
  vehicles: VehicleSummary[];
}
