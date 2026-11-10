/**
 * Mọi trạng thái của hệ thống đặt ở ĐÂY và chỉ ở đây.
 *
 * Mỗi nhóm có: một mảng các giá trị (dùng cho database và kiểm tra dữ liệu bằng zod)
 * và một kiểu TypeScript cùng tên (dùng khi khai báo biến, tham số).
 *
 *   import { VEHICLE_STATUSES, type VehicleStatus } from "../constants";
 *   if (vehicle.status === "AVAILABLE") { ... }      // TypeScript báo lỗi nếu gõ sai chuỗi
 */

export const ROLES = ["STUDENT", "OPERATOR"] as const;
export type Role = (typeof ROLES)[number];

export const THEME_PREFERENCES = ["LIGHT", "DARK", "SYSTEM"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Trạng thái xe dùng chung – theo state-chart Submission #2. */
export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "HANDING_OVER",
  "IN_USE",
  "PENDING_VERIFICATION",
  "UNDER_MAINTENANCE",
  "CHARGING",
  "IN_TRANSIT",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_TYPES = ["E_BIKE", "E_MOTORBIKE"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_RESERVATION_STATUSES = [
  "RESERVED",
  "HANDING_OVER",
  "PENDING_VERIFICATION",
  "USED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type VehicleReservationStatus = (typeof VEHICLE_RESERVATION_STATUSES)[number];

export const TRIP_STATUSES = ["ACTIVE", "RETURN_IN_PROGRESS", "PENDING_RECONCILIATION", "ENDED"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

/** Giữ tạm (HELD) và đặt chỗ đã xác nhận (CONFIRMED) là CÙNG MỘT bản ghi, chỉ đổi trạng thái. */
export const PARKING_ALLOCATION_STATUSES = ["HELD", "CONFIRMED", "IN_USE", "USED", "CANCELLED", "EXPIRED"] as const;
export type ParkingAllocationStatus = (typeof PARKING_ALLOCATION_STATUSES)[number];

export const SLOT_STATUSES = ["IN_SERVICE", "OUT_OF_SERVICE"] as const;
export type SlotStatus = (typeof SLOT_STATUSES)[number];

export const CHARGING_PORT_STATUSES = ["AVAILABLE", "IN_USE", "OUT_OF_SERVICE"] as const;
export type ChargingPortStatus = (typeof CHARGING_PORT_STATUSES)[number];

export const CONNECTOR_TYPES = ["TYPE_2", "STANDARD_PLUG"] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export const CHARGING_REQUEST_STATUSES = ["ALLOCATED", "WAITING", "CHARGING", "COMPLETED", "CANCELLED"] as const;
export type ChargingRequestStatus = (typeof CHARGING_REQUEST_STATUSES)[number];

export const CHARGING_RESERVATION_STATUSES = [
  "CONFIRMED",
  "CHARGING",
  "AWAITING_DISCONNECT",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type ChargingReservationStatus = (typeof CHARGING_RESERVATION_STATUSES)[number];

export const CHARGING_SESSION_STATUSES = ["ACTIVE", "ENDED"] as const;
export type ChargingSessionStatus = (typeof CHARGING_SESSION_STATUSES)[number];

export const INCIDENT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const IMPACT_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];

export const RESOURCE_TYPES = ["SHARED_VEHICLE", "PARKING_SLOT", "CHARGING_PORT"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const REDISTRIBUTION_STATUSES = [
  "CREATED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "PARTIALLY_COMPLETED",
] as const;
export type RedistributionStatus = (typeof REDISTRIBUTION_STATUSES)[number];

export const REDISTRIBUTION_ITEM_STATUSES = ["PENDING", "IN_TRANSIT", "ARRIVED", "CANCELLED"] as const;
export type RedistributionItemStatus = (typeof REDISTRIBUTION_ITEM_STATUSES)[number];

export const SIMULATION_RUN_STATUSES = ["RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export type SimulationRunStatus = (typeof SIMULATION_RUN_STATUSES)[number];

/**
 * Các thao tác ghi có chống gửi lặp bằng requestId (Sequence Sub #2: nhánh duplicateRequest).
 * Mỗi lần xử lý xong ghi một dòng ProcessedRequest; gửi lại cùng requestId thì trả kết quả cũ.
 */
export const REQUEST_OPERATIONS = [
  "CONFIRM_CHARGING_RESERVATION",
  "RESCHEDULE_CHARGING_RESERVATION",
  "CANCEL_CHARGING_RESERVATION",
  "APPLY_CHARGING_PLAN",
  "START_SIMULATION_RUN",
] as const;
export type RequestOperation = (typeof REQUEST_OPERATIONS)[number];

export const ALERT_TYPES = ["LOW_VEHICLE", "NEAR_FULL", "RESOURCE_FAULT", "DATA_STALE"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

/** Kết quả giả lập từ thiết bị xe khi mở khóa / khóa. */
export type DeviceCommandResult = "SUCCESS" | "FAILED" | "UNKNOWN";
