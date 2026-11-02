/**
 * Schema cơ sở dữ liệu (Drizzle ORM + SQLite).
 *
 * - Mỗi bảng ứng với một entity trong class diagram.
 * - Trường trạng thái lưu dạng TEXT nhưng được gõ kiểu theo enum trong @hub/shared,
 *   nên TypeScript sẽ báo lỗi nếu ghi một trạng thái không tồn tại.
 * - Sau khi sửa file này: chạy `npm run db:push` (giữ dữ liệu nếu được)
 *   hoặc `npm run db:reset` (xóa sạch và seed lại).
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import {
  AlertType,
  ChargingPortStatus,
  ChargingRequestStatus,
  ChargingReservationStatus,
  ChargingSessionStatus,
  ConnectorType,
  ImpactLevel,
  IncidentStatus,
  ParkingAllocationStatus,
  RedistributionItemStatus,
  RedistributionStatus,
  ResourceType,
  Role,
  SimulationRunStatus,
  SlotStatus,
  ThemePreference,
  TripStatus,
  VehicleReservationStatus,
  VehicleStatus,
  VehicleType,
  enumValues,
} from "@hub/shared";

// ---------- Cột dùng chung ----------
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () =>
  timestamp("created_at")
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp("updated_at")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ---------- Tài khoản ----------
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role", { enum: enumValues(Role) }).notNull(),
  themePreference: text("theme_preference", { enum: enumValues(ThemePreference) })
    .notNull()
    .default(ThemePreference.SYSTEM),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Hub và tài nguyên ----------
export const hubs = sqliteTable("hubs", {
  id: id(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  lastUpdatedAt: timestamp("last_updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const parkingSlots = sqliteTable(
  "parking_slots",
  {
    id: id(),
    hubId: text("hub_id")
      .notNull()
      .references(() => hubs.id),
    code: text("code").notNull(),
    hasCharger: integer("has_charger", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: enumValues(SlotStatus) })
      .notNull()
      .default(SlotStatus.IN_SERVICE),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("parking_slots_hub_code_uq").on(t.hubId, t.code)],
);

/** Cổng sạc nằm TRONG một vị trí đỗ – không cộng thêm sức chứa của Hub. */
export const chargingPorts = sqliteTable("charging_ports", {
  id: id(),
  slotId: text("slot_id")
    .notNull()
    .unique()
    .references(() => parkingSlots.id),
  connectorType: text("connector_type", { enum: enumValues(ConnectorType) }).notNull(),
  maxPowerKw: real("max_power_kw").notNull(),
  status: text("status", { enum: enumValues(ChargingPortStatus) })
    .notNull()
    .default(ChargingPortStatus.AVAILABLE),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sharedVehicles = sqliteTable(
  "shared_vehicles",
  {
    id: id(),
    code: text("code").notNull().unique(),
    type: text("type", { enum: enumValues(VehicleType) }).notNull(),
    batteryLevel: integer("battery_level").notNull(),
    status: text("status", { enum: enumValues(VehicleStatus) }).notNull(),
    hubId: text("hub_id").references(() => hubs.id),
    slotId: text("slot_id").references(() => parkingSlots.id),
    lastUpdatedAt: timestamp("last_updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("shared_vehicles_hub_idx").on(t.hubId)],
);

export const privateVehicles = sqliteTable("private_vehicles", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  plate: text("plate").notNull(),
  type: text("type", { enum: enumValues(VehicleType) }).notNull(),
  connectorType: text("connector_type", { enum: enumValues(ConnectorType) }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Xe dùng chung: đặt xe, chuyến đi ----------
export const vehicleReservations = sqliteTable(
  "vehicle_reservations",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => sharedVehicles.id),
    hubId: text("hub_id")
      .notNull()
      .references(() => hubs.id),
    status: text("status", { enum: enumValues(VehicleReservationStatus) }).notNull(),
    pickupDeadline: timestamp("pickup_deadline").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("vehicle_reservations_student_idx").on(t.studentId)],
);

export const trips = sqliteTable("trips", {
  id: id(),
  reservationId: text("reservation_id")
    .notNull()
    .unique()
    .references(() => vehicleReservations.id),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id),
  vehicleId: text("vehicle_id")
    .notNull()
    .references(() => sharedVehicles.id),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  returnHubId: text("return_hub_id").references(() => hubs.id),
  returnSlotId: text("return_slot_id").references(() => parkingSlots.id),
  status: text("status", { enum: enumValues(TripStatus) }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Đỗ xe ----------
/** Giữ tạm (HELD) và đặt chỗ xác nhận (CONFIRMED) là cùng một bản ghi. */
export const parkingAllocations = sqliteTable(
  "parking_allocations",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id),
    slotId: text("slot_id")
      .notNull()
      .references(() => parkingSlots.id),
    /** Xe cá nhân (privateVehicles.id) hoặc xe dùng chung (sharedVehicles.id). */
    vehicleRef: text("vehicle_ref").notNull(),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    status: text("status", { enum: enumValues(ParkingAllocationStatus) }).notNull(),
    holdExpiresAt: timestamp("hold_expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("parking_allocations_slot_time_idx").on(t.slotId, t.startTime, t.endTime)],
);

// ---------- Sạc ----------
export const chargingRequests = sqliteTable("charging_requests", {
  id: id(),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id),
  vehicleRef: text("vehicle_ref").notNull(),
  hubId: text("hub_id")
    .notNull()
    .references(() => hubs.id),
  portId: text("port_id").references(() => chargingPorts.id),
  status: text("status", { enum: enumValues(ChargingRequestStatus) }).notNull(),
  targetBattery: integer("target_battery").notNull(),
  queuedAt: timestamp("queued_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const chargingReservations = sqliteTable(
  "charging_reservations",
  {
    id: id(),
    studentId: text("student_id")
      .notNull()
      .references(() => users.id),
    privateVehicleId: text("private_vehicle_id")
      .notNull()
      .references(() => privateVehicles.id),
    portId: text("port_id")
      .notNull()
      .references(() => chargingPorts.id),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    status: text("status", { enum: enumValues(ChargingReservationStatus) }).notNull(),
    /** Dùng cho expectedVersion khi đổi lịch / hủy (UC09). */
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("charging_reservations_port_time_idx").on(t.portId, t.startTime, t.endTime)],
);

export const chargingSessions = sqliteTable("charging_sessions", {
  id: id(),
  portId: text("port_id")
    .notNull()
    .references(() => chargingPorts.id),
  reservationId: text("reservation_id").references(() => chargingReservations.id),
  requestId: text("request_id").references(() => chargingRequests.id),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  status: text("status", { enum: enumValues(ChargingSessionStatus) }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Vận hành ----------
export const incidents = sqliteTable("incidents", {
  id: id(),
  resourceType: text("resource_type", { enum: enumValues(ResourceType) }).notNull(),
  resourceId: text("resource_id").notNull(),
  description: text("description").notNull(),
  impactLevel: text("impact_level", { enum: enumValues(ImpactLevel) }).notNull(),
  status: text("status", { enum: enumValues(IncidentStatus) }).notNull(),
  /** Phương án xử lý, lưu dạng JSON. */
  handlingPlan: text("handling_plan", { mode: "json" }),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const alerts = sqliteTable(
  "alerts",
  {
    id: id(),
    hubId: text("hub_id")
      .notNull()
      .references(() => hubs.id),
    type: text("type", { enum: enumValues(AlertType) }).notNull(),
    value: real("value").notNull(),
    threshold: real("threshold").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("alerts_hub_type_idx").on(t.hubId, t.type)],
);

export const redistributionOrders = sqliteTable("redistribution_orders", {
  id: id(),
  sourceHubId: text("source_hub_id")
    .notNull()
    .references(() => hubs.id),
  targetHubId: text("target_hub_id")
    .notNull()
    .references(() => hubs.id),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  eta: timestamp("eta"),
  status: text("status", { enum: enumValues(RedistributionStatus) }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const redistributionItems = sqliteTable("redistribution_items", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => redistributionOrders.id),
  vehicleId: text("vehicle_id")
    .notNull()
    .references(() => sharedVehicles.id),
  status: text("status", { enum: enumValues(RedistributionItemStatus) }).notNull(),
  departedAt: timestamp("departed_at"),
  arrivedAt: timestamp("arrived_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const chargingPlans = sqliteTable("charging_plans", {
  id: id(),
  hubId: text("hub_id")
    .notNull()
    .references(() => hubs.id),
  /** Dùng cho baseVersion khi áp dụng lịch sạc (UC13). */
  version: integer("version").notNull().default(1),
  payload: text("payload", { mode: "json" }).notNull(),
  appliedAt: timestamp("applied_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Lần chạy mô phỏng What-if (UC14). Snapshot/kịch bản/kết quả lưu JSON, tách khỏi dữ liệu vận hành. */
export const simulationRuns = sqliteTable("simulation_runs", {
  id: id(),
  snapshot: text("snapshot", { mode: "json" }).notNull(),
  scenario: text("scenario", { mode: "json" }).notNull(),
  result: text("result", { mode: "json" }),
  status: text("status", { enum: enumValues(SimulationRunStatus) }).notNull(),
  dataLimitation: text("data_limitation"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Chống gửi lặp ----------
/** Mỗi requestId chỉ được xử lý một lần; lần gửi lặp trả lại resultJson đã lưu. */
export const requestLogs = sqliteTable("request_logs", {
  requestId: text("request_id").primaryKey(),
  operation: text("operation").notNull(),
  userId: text("user_id").notNull(),
  resultJson: text("result_json").notNull(),
  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ---------- Kiểu dữ liệu suy ra từ bảng ----------
export type User = typeof users.$inferSelect;
export type Hub = typeof hubs.$inferSelect;
export type ParkingSlot = typeof parkingSlots.$inferSelect;
export type ChargingPort = typeof chargingPorts.$inferSelect;
export type SharedVehicle = typeof sharedVehicles.$inferSelect;
export type PrivateVehicle = typeof privateVehicles.$inferSelect;
export type VehicleReservation = typeof vehicleReservations.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type ParkingAllocation = typeof parkingAllocations.$inferSelect;
export type ChargingRequest = typeof chargingRequests.$inferSelect;
export type ChargingReservation = typeof chargingReservations.$inferSelect;
export type ChargingSession = typeof chargingSessions.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type RedistributionOrder = typeof redistributionOrders.$inferSelect;
export type RedistributionItem = typeof redistributionItems.$inferSelect;
export type ChargingPlan = typeof chargingPlans.$inferSelect;
export type SimulationRun = typeof simulationRuns.$inferSelect;
export type RequestLog = typeof requestLogs.$inferSelect;
