/**
 * Mọi trạng thái của hệ thống đặt ở ĐÂY và chỉ ở đây.
 * Không tự đặt chuỗi trạng thái ở nơi khác (client lẫn server đều import từ file này).
 *
 * Cách dùng:
 *   import { VehicleStatus } from "@hub/shared";
 *   if (vehicle.status === VehicleStatus.AVAILABLE) { ... }
 *   function f(s: VehicleStatus) { ... }   // VehicleStatus vừa là object, vừa là kiểu
 */

/** Helper: lấy kiểu union từ object hằng. */
type ValueOf<T> = T[keyof T];

/** Liệt kê các giá trị của một enum, dùng cho zod: z.enum(enumValues(Role)). */
export function enumValues<T extends Record<string, string>>(e: T): [ValueOf<T>, ...ValueOf<T>[]] {
  return Object.values(e) as [ValueOf<T>, ...ValueOf<T>[]];
}

export const Role = {
  STUDENT: "STUDENT",
  OPERATOR: "OPERATOR",
} as const;
export type Role = ValueOf<typeof Role>;

export const ThemePreference = {
  LIGHT: "LIGHT",
  DARK: "DARK",
  SYSTEM: "SYSTEM",
} as const;
export type ThemePreference = ValueOf<typeof ThemePreference>;

/** Trạng thái xe dùng chung – theo state-chart Submission #2. */
export const VehicleStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  HANDING_OVER: "HANDING_OVER",
  IN_USE: "IN_USE",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  UNDER_MAINTENANCE: "UNDER_MAINTENANCE",
  CHARGING: "CHARGING",
  IN_TRANSIT: "IN_TRANSIT",
} as const;
export type VehicleStatus = ValueOf<typeof VehicleStatus>;

export const VehicleType = {
  E_BIKE: "E_BIKE",
  E_MOTORBIKE: "E_MOTORBIKE",
} as const;
export type VehicleType = ValueOf<typeof VehicleType>;

export const VehicleReservationStatus = {
  RESERVED: "RESERVED",
  HANDING_OVER: "HANDING_OVER",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  USED: "USED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type VehicleReservationStatus = ValueOf<typeof VehicleReservationStatus>;

export const TripStatus = {
  ACTIVE: "ACTIVE",
  RETURN_IN_PROGRESS: "RETURN_IN_PROGRESS",
  PENDING_RECONCILIATION: "PENDING_RECONCILIATION",
  ENDED: "ENDED",
} as const;
export type TripStatus = ValueOf<typeof TripStatus>;

/** Giữ tạm và đặt chỗ đã xác nhận là CÙNG MỘT bản ghi, chỉ đổi trạng thái. */
export const ParkingAllocationStatus = {
  HELD: "HELD",
  CONFIRMED: "CONFIRMED",
  IN_USE: "IN_USE",
  USED: "USED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type ParkingAllocationStatus = ValueOf<typeof ParkingAllocationStatus>;

export const SlotStatus = {
  IN_SERVICE: "IN_SERVICE",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
} as const;
export type SlotStatus = ValueOf<typeof SlotStatus>;

export const ChargingPortStatus = {
  AVAILABLE: "AVAILABLE",
  IN_USE: "IN_USE",
  OUT_OF_SERVICE: "OUT_OF_SERVICE",
} as const;
export type ChargingPortStatus = ValueOf<typeof ChargingPortStatus>;

export const ConnectorType = {
  TYPE_2: "TYPE_2",
  STANDARD_PLUG: "STANDARD_PLUG",
} as const;
export type ConnectorType = ValueOf<typeof ConnectorType>;

export const ChargingRequestStatus = {
  ALLOCATED: "ALLOCATED",
  WAITING: "WAITING",
  CHARGING: "CHARGING",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type ChargingRequestStatus = ValueOf<typeof ChargingRequestStatus>;

export const ChargingReservationStatus = {
  CONFIRMED: "CONFIRMED",
  CHARGING: "CHARGING",
  AWAITING_DISCONNECT: "AWAITING_DISCONNECT",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;
export type ChargingReservationStatus = ValueOf<typeof ChargingReservationStatus>;

export const ChargingSessionStatus = {
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
} as const;
export type ChargingSessionStatus = ValueOf<typeof ChargingSessionStatus>;

export const IncidentStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
} as const;
export type IncidentStatus = ValueOf<typeof IncidentStatus>;

export const ImpactLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type ImpactLevel = ValueOf<typeof ImpactLevel>;

export const ResourceType = {
  SHARED_VEHICLE: "SHARED_VEHICLE",
  PARKING_SLOT: "PARKING_SLOT",
  CHARGING_PORT: "CHARGING_PORT",
} as const;
export type ResourceType = ValueOf<typeof ResourceType>;

export const RedistributionStatus = {
  CREATED: "CREATED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  PARTIALLY_COMPLETED: "PARTIALLY_COMPLETED",
} as const;
export type RedistributionStatus = ValueOf<typeof RedistributionStatus>;

export const RedistributionItemStatus = {
  PENDING: "PENDING",
  IN_TRANSIT: "IN_TRANSIT",
  ARRIVED: "ARRIVED",
  CANCELLED: "CANCELLED",
} as const;
export type RedistributionItemStatus = ValueOf<typeof RedistributionItemStatus>;

export const SimulationRunStatus = {
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type SimulationRunStatus = ValueOf<typeof SimulationRunStatus>;

export const AlertType = {
  LOW_VEHICLE: "LOW_VEHICLE",
  NEAR_FULL: "NEAR_FULL",
  RESOURCE_FAULT: "RESOURCE_FAULT",
  DATA_STALE: "DATA_STALE",
} as const;
export type AlertType = ValueOf<typeof AlertType>;

/** Kết quả giả lập từ thiết bị xe (mở khóa / khóa). */
export const DeviceCommandResult = {
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN",
} as const;
export type DeviceCommandResult = ValueOf<typeof DeviceCommandResult>;

/** Nhãn tiếng Việt cho trạng thái – dùng cho StatusBadge (NFR: trạng thái phải có chữ). */
export const StatusLabel: Record<string, string> = {
  AVAILABLE: "Sẵn sàng",
  RESERVED: "Đã đặt",
  HANDING_OVER: "Đang bàn giao",
  IN_USE: "Đang sử dụng",
  PENDING_VERIFICATION: "Chờ xác minh",
  UNDER_MAINTENANCE: "Đang bảo trì",
  CHARGING: "Đang sạc",
  IN_TRANSIT: "Đang điều chuyển",
  USED: "Đã dùng",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  ACTIVE: "Đang diễn ra",
  RETURN_IN_PROGRESS: "Đang trả xe",
  PENDING_RECONCILIATION: "Chờ đối soát",
  ENDED: "Đã kết thúc",
  HELD: "Đang giữ tạm",
  CONFIRMED: "Đã xác nhận",
  IN_SERVICE: "Hoạt động",
  OUT_OF_SERVICE: "Ngừng hoạt động",
  ALLOCATED: "Đã phân bổ",
  WAITING: "Đang chờ",
  COMPLETED: "Hoàn tất",
  AWAITING_DISCONNECT: "Chờ rút sạc",
  OPEN: "Mới ghi nhận",
  IN_PROGRESS: "Đang xử lý",
  RESOLVED: "Đã khắc phục",
  CREATED: "Mới tạo",
  PARTIALLY_COMPLETED: "Hoàn tất một phần",
  RUNNING: "Đang chạy",
  FAILED: "Thất bại",
  LOW_VEHICLE: "Thiếu xe",
  NEAR_FULL: "Sắp đầy",
  RESOURCE_FAULT: "Tài nguyên lỗi",
  DATA_STALE: "Dữ liệu cũ",
};
