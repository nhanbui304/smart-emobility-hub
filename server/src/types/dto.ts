/**
 * Dữ liệu API trả về cho client. Client có bản sao trong client/src/types.ts –
 * sửa ở đây thì sửa cả bên đó.
 */
import type { AlertType, Role, ThemePreference, VehicleStatus, VehicleType } from "../constants";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  themePreference: ThemePreference;
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

export interface VehicleSummary {
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
  vehicles: VehicleSummary[];
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
