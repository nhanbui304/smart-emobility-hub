/**
 * Kiểu dữ liệu phía client – bản sao của server/src/constants.ts, entity trong server/src/db/schema.ts
 * và datatype trong server/src/types/dto.ts (đều theo class diagram Submission #3). Ngày giờ là chuỗi ISO.
 * Sửa bên server thì sửa cả ở đây.
 */

export type AlertType = "LOW_VEHICLE" | "NEAR_FULL" | "RESOURCE_FAULT" | "DATA_STALE";
export type ChargingPortStatus = "AVAILABLE" | "IN_USE" | "OUT_OF_SERVICE";
export type ChargingRequestStatus = "ALLOCATED" | "WAITING" | "CHARGING" | "COMPLETED" | "CANCELLED" | "EXPIRED";
export type ChargingReservationStatus = "CONFIRMED" | "CHARGING" | "AWAITING_DISCONNECT" | "COMPLETED" | "CANCELLED" | "EXPIRED";
export type ChargingSessionStatus = "ACTIVE" | "ENDED";
export type ConnectorType = "TYPE_2" | "STANDARD_PLUG";
export type DeviceCommandResult = "SUCCESS" | "FAILED" | "UNKNOWN";
export type IncidentImpact = "LOW" | "MEDIUM" | "HIGH";
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";
export type ParkingAllocationStatus = "HELD" | "CONFIRMED" | "IN_USE" | "USED" | "CANCELLED" | "EXPIRED";
export type RedistributionItemStatus = "PENDING" | "IN_TRANSIT" | "ARRIVED" | "CANCELLED";
export type RedistributionStatus = "CREATED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "PARTIALLY_COMPLETED";
export type RequestOperation = "RESCHEDULE_CHARGING_RESERVATION" | "CANCEL_CHARGING_RESERVATION" | "APPLY_CHARGING_PLAN" | "START_SIMULATION_RUN" | "RESERVE_VEHICLE" | "CONFIRM_PICKUP" | "PREPARE_RETURN" | "CONFIRM_RETURN" | "ABANDON_RETURN" | "HOLD_PARKING_SLOT" | "CONFIRM_PARKING_RESERVATION" | "CANCEL_PARKING_HOLD" | "REPORT_INCIDENT" | "PROCESS_INCIDENT_HANDLING_PLAN" | "VERIFY_INCIDENT_RESOLUTION" | "CONFIRM_CHARGING_RESERVATION";
export type ResourceType = "SHARED_VEHICLE" | "PARKING_SLOT" | "CHARGING_PORT";
export type Role = "STUDENT" | "OPERATOR";
export type ScenarioType = "DEMAND_SURGE" | "HUB_CLOSURE" | "ADD_CHARGERS" | "ADD_VEHICLES";
export type SimulationRunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type SlotStatus = "IN_SERVICE" | "OUT_OF_SERVICE";
export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type TripStatus = "ACTIVE" | "RETURN_IN_PROGRESS" | "PENDING_RECONCILIATION" | "ENDED";
export type VehicleReservationStatus = "RESERVED" | "HANDING_OVER" | "PENDING_VERIFICATION" | "USED" | "CANCELLED" | "EXPIRED";
export type VehicleStatus = "AVAILABLE" | "RESERVED" | "HANDING_OVER" | "IN_USE" | "PENDING_VERIFICATION" | "UNDER_MAINTENANCE" | "CHARGING" | "IN_TRANSIT";
export type VehicleTechStatus = "OK" | "FAULT" | "UNKNOWN";
export type VehicleType = "E_BIKE" | "E_MOTORBIKE";

export interface TimeRange {
  startTime: string;
  endTime: string;
}

// ---------- Entity ----------

export interface Alert {
  id: string;
  hubId: string;
  type: AlertType;
  value: number;
  threshold: number;
  active: boolean;
  updatedAt: string;
  evaluationWindow: TimeRange | null;
}

export interface ChargingPort {
  id: string;
  slotId: string;
  connectorType: ConnectorType;
  maxPowerKw: number;
  status: ChargingPortStatus;
}

export interface ChargingRequest {
  id: string;
  studentId: string;
  vehicleId: string;
  hubId: string;
  assignedPortId: string | null;
  currentBattery: number;
  targetBattery: number;
  status: ChargingRequestStatus;
  createdAt: string;
  allocationDeadline: string | null;
}

export interface ChargingReservation {
  id: string;
  studentId: string;
  privateVehicleId: string;
  portId: string;
  startTime: string;
  endTime: string;
  currentBattery: number | null;
  targetBattery: number | null;
  status: ChargingReservationStatus;
  version: number;
}

export interface ChargingScheduleVersion {
  scheduleVersionId: string;
  allocations: PlanAllocation[];
  hubId: string;
  version: number;
  appliedAt: string | null;
  notificationPending: boolean;
}

export interface ChargingSession {
  id: string;
  portId: string;
  reservationId: string | null;
  chargingRequestId: string | null;
  startedAt: string;
  endedAt: string | null;
  status: ChargingSessionStatus;
}

export interface Hub {
  id: string;
  name: string;
  location: string;
  lastUpdatedAt: string;
}

export interface Incident {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  description: string;
  impactLevel: IncidentImpact;
  affectedScope: string;
  status: IncidentStatus;
  reportedBy: string;
  priorityHandling: boolean;
  handlingPlan: HandlingPlan | null;
  consentPlan: ConsentPlan | null;
  notificationPending: boolean;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  version: number;
}

export interface ParkingAllocation {
  id: string;
  studentId: string;
  slotId: string;
  vehicleRef: string;
  startTime: string;
  endTime: string;
  status: ParkingAllocationStatus;
  holdExpiresAt: string | null;
}

export interface ParkingSlot {
  id: string;
  hubId: string;
  code: string;
  hasCharger: boolean;
  status: SlotStatus;
}

export interface PrivateVehicle {
  id: string;
  ownerId: string;
  plate: string;
  type: VehicleType;
  connectorType: ConnectorType;
}

export interface ProcessedRequest {
  requestId: string;
  actorId: string;
  operation: RequestOperation;
  resultId: string;
}

export interface RedistributionItem {
  id: string;
  orderId: string;
  vehicleId: string;
  status: RedistributionItemStatus;
  departedAt: string | null;
  arrivedAt: string | null;
}

export interface RedistributionOrder {
  id: string;
  sourceHubId: string;
  targetHubId: string;
  createdBy: string;
  eta: string | null;
  status: RedistributionStatus;
}

export interface SharedVehicle {
  id: string;
  code: string;
  type: VehicleType;
  batteryLevel: number;
  status: VehicleStatus;
  hubId: string | null;
  lastUpdatedAt: string;
  slotId: string | null;
}

export interface SimulationRun {
  runId: string;
  snapshotId: string;
  scenario: Scenario;
  status: SimulationRunStatus;
  result: SimulationResult | null;
}

export interface SimulationSnapshot {
  snapshotId: string;
  capturedAt: string;
  sources: string[];
  completeness: number;
  isStale: boolean;
  operationalState: OperationalState;
  dataLimitation: string | null;
  hubIds: string[];
  timeRange: TimeRange;
  staleAccepted: boolean;
}

export interface Trip {
  id: string;
  reservationId: string;
  studentId: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string | null;
  returnHubId: string | null;
  returnSlotId: string | null;
  status: TripStatus;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: Role;
  themePreference: ThemePreference;
}

export interface VehicleReservation {
  id: string;
  studentId: string;
  vehicleId: string;
  hubId: string;
  status: VehicleReservationStatus;
  pickupDeadline: string;
}

// ---------- Datatype ----------

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

/** Chi tiết Hub = HubStatus + danh sách xe (tổng quát hóa HubStatus như sơ đồ UC10). */
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
  evaluationWindow?: TimeRange;
}

/** Chi tiết Hub cho Operator (UC10 bước 3). */
export interface OperatorHubDetail extends HubDetail {
  activeAlerts: AlertDto[];
  /** Hub có dữ liệu quá dataStaleSeconds giây chưa cập nhật. */
  isDataStale: boolean;
  reservations: HubReservations;
}

export interface ActiveHold {
  hold: ParkingAllocation;
  remainingSeconds: number;
}

export interface AffectedContext {
  affectedHolds: string[];
  affectedBookings: string[];
  affectedTrips: string[];
  affectedSchedules: string[];
}

export interface ApplyResult {
  scheduleVersionId: string;
  allocations: PlanAllocation[];
  changeSummary: ChangeSummary;
  appliedNow: boolean;
}

export interface BatteryReading {
  vehicleId: string;
  batteryLevel: number;
}

export interface CancelChargingResult {
  chargingRequestId: string;
  status: ChargingRequestStatus;
}

export interface CancellationCheck {
  canCancel: boolean;
  reason?: string;
  version: number;
}

export interface CancellationPreview {
  reservation: VehicleReservation;
  cancellationAllowed: boolean;
  message: string;
}

export interface CancellationResult {
  reservationId: string;
  status: ChargingReservationStatus;
}

export interface ChangeSummary {
  allocations: PlanAllocation[];
}

export interface ChargingContext {
  demands: ChargingDemand[];
  batteryLevels: BatteryReading[];
  activeSessions: ChargingSession[];
  confirmedReservations: ChargingReservation[];
  activeHolds: PositionHold[];
  hubPowerCapacityKw: number;
  restrictedResources: ResourceRestriction[];
}

export interface ChargingDemand {
  demandId: string;
  vehicleId: string;
  chargingNeed: ChargingNeed;
}

export interface ChargingNeed {
  currentBattery: number;
  targetBattery: number;
}

export interface ChargingPortWithHub {
  id: string;
  slotId: string;
  hubId: string;
  connectorType: ConnectorType;
  maxPowerKw: number;
  status: ChargingPortStatus;
}

export interface ChargingProposal {
  canAllocateNow: boolean;
  proposedPortId?: string;
  estimatedWaitMinutes: number;
  allocationDeadline?: string;
}

export interface ChargingRequestResult {
  chargingRequestId: string;
  status: ChargingRequestStatus;
  assignedPortId?: string;
  allocationDeadline?: string;
  usageGuide: string;
}

export interface ChargingSlotOption {
  slotOptionId: string;
  portId: string;
  hubId: string;
  startTime: string;
  endTime: string;
  maxPowerKw: number;
}

export interface ConsentPlan {
  pendingChanges: string[];
  responseDeadline: string;
}

export interface CreateResult {
  reservationId: string;
  hubId: string;
  portId: string;
  timeRange: TimeRange;
  status: ChargingReservationStatus;
  usageGuide: string;
}

export interface CreateRunResult {
  runId: string;
  created: boolean;
}

export interface HandlingPlan {
  actionType: string;
  allocationChanges: string[];
}

export interface HubAcceptance {
  hub?: Hub;
  accepting: boolean;
}

export interface HubReservations {
  vehicleReservations: VehicleReservation[];
  parkingAllocations: ParkingAllocation[];
  chargingReservations: ChargingReservation[];
}

export interface HubReturnContext {
  hubId: string;
  accepting: boolean;
  confirmedBooking?: ParkingAllocation;
  availableSlots: ParkingSlot[];
}

export interface IncidentContext {
  resourceId: string;
  resourceStatus: string;
  openIncidents: Incident[];
}

export interface IncidentDetails {
  incident: Incident;
  affectedServices: string[];
}

export interface IncidentResult {
  success: boolean;
  message: string;
  incidentId?: string;
}

export interface LockResult {
  status: DeviceCommandResult;
  batteryLevel?: number;
  techStatus: VehicleTechStatus;
}

export interface MobilityContext {
  hubs: Hub[];
  vehicles: SharedVehicle[];
  lastUpdatedAt: string;
}

export interface MobilityOption {
  optionId: string;
  hubId: string;
  vehicle: SharedVehicle;
  estimatedDistance: number;
}

export interface MyReservationsResult {
  vehicleReservations: VehicleReservation[];
  parkingAllocations: (ParkingAllocation & { slotCode?: string; hubName?: string })[];
  chargingReservations: ChargingReservation[];
}

export interface NetworkOverview {
  hubs: HubStatus[];
  activeAlerts: AlertDto[];
  generatedAt: string;
}

export interface NotificationResult {
  sent: boolean;
  failedRecipientIds: string[];
  reason?: string;
}

export interface OperationalState {
  hubIds: string[];
  timeRange: TimeRange;
  hubs: HubStatus[];
}

export interface OperatorAlert {
  alertType: string;
  message: string;
  vehicleId?: string;
  reservationId?: string;
  tripId?: string;
  hubId?: string;
  slotId?: string;
}

export interface OptionSelectionResult {
  optionChanged: boolean;
  nextActions: string[];
  updatedResult: SearchResult;
}

export interface OptionState {
  isAvailable: boolean;
  currentBattery: number;
}

export interface ParkingBooking {
  allocation: ParkingAllocation;
  hubId: string;
  slotCode: string;
  arrivalConditions: string;
}

export interface PickUpContext {
  reservation: VehicleReservation;
  vehicle: SharedVehicle;
  hub: Hub;
}

export interface PickUpPreview {
  reservation: VehicleReservation;
  vehicleCode: string;
  batteryLevel: number;
  pickupDeadline: string;
}

export interface PickUpResult {
  outcome: DeviceCommandResult;
  trip?: Trip;
  reservation: VehicleReservation;
}

export interface PlanAdjustment {
  demandId: string;
  portId: string;
  positionId: string;
  timeRange: TimeRange;
  allocatedPowerKw: number;
}

export interface PlanAllocation {
  portId: string;
  positionId: string;
  timeRange: TimeRange;
  allocatedPowerKw: number;
}

export interface PlanDraft {
  planDraftId: string;
  servedRequests: string[];
  waitingRequests: string[];
  proposedAllocations: PlanAllocation[];
}

export interface PortWithHub {
  port: ChargingPort;
  hubId: string;
}

export interface PositionHold {
  positionId: string;
  timeRange: TimeRange;
}

export interface RawSimulationResult {
  baseline: SimulationMetrics;
  scenario: SimulationMetrics;
}

export interface Recommendation {
  recommendationId: string;
  targetUseCase: string;
  reason: string;
  constraints: string[];
}

export interface RedistributionPreview {
  sourceHub: Hub;
  targetHub: Hub;
  vehicles: SharedVehicle[];
  eta: string;
  availableCapacity: number;
}

export interface RedistributionResult {
  order: RedistributionOrder;
  items: RedistributionItem[];
}

export interface RescheduleForm {
  reservation: ChargingReservation;
}

export interface RescheduleResult {
  reservation: ChargingReservation;
}

export interface ReservationContext {
  student: User;
  vehicle: SharedVehicle;
  hub: Hub;
}

export interface ReservationDetail {
  vehicle: PrivateVehicle;
  hubId: string;
  portId: string;
  timeRange: TimeRange;
  status: ChargingReservationStatus;
  allowedActions: string[];
}

export interface ReservationPreview {
  hubId: string;
  vehicle: SharedVehicle;
  pickupDeadline: string;
}

export interface ResolutionResult {
  isResolved: boolean;
  evidence: string;
}

export interface ResourceRestriction {
  resourceId: string;
  reason: string;
}

export interface ReturnAllocation {
  trip: Trip;
  allocation: ParkingAllocation;
}

export interface ReturnHandoverContext {
  tripId: string;
  vehicleId: string;
  hubId: string;
  slotId: string;
  allocationId: string;
  bookingId?: string;
}

export interface ReturnPreparation {
  trip: Trip;
  allocation: ParkingAllocation;
  slotCode: string;
}

export interface ReturnResult {
  outcome: DeviceCommandResult;
  trip: Trip;
  returnedAt?: string;
  hubId: string;
  slotId: string;
  pendingReconciliation?: boolean;
}

export interface ReturnSlotPlan {
  slotId: string;
  bookingId?: string;
}

export interface RunCancelled {
  runId: string;
}

export interface RunOutcome {
  status: SimulationRunStatus;
  result?: SimulationResult;
  failureReason?: string;
}

export interface RunStarted {
  runId: string;
}

export interface SaveResult {
  saveStatus: SaveStatus;
}

export interface SaveStatus {
  saved: boolean;
  reason?: string;
}

export interface Scenario {
  scenarioDraftId: string;
  snapshotId: string;
  scenarioType: ScenarioType;
  assumptions: ScenarioAssumptions;
}

export interface ScenarioAssumptions {
  hubId?: string;
  demandMultiplier?: number;
  additionalChargers?: number;
  additionalVehicles?: number;
}

export interface ScheduleResult {
  scheduleVersionId: string;
  allocations: PlanAllocation[];
}

export interface SearchCriteria {
  purpose: string;
  originHubId: string;
  vehicleType: VehicleType;
  minBattery: number;
}

export interface SearchFormConfig {
  defaultHubId: string;
  availableVehicleTypes: VehicleType[];
}

export interface SearchResult {
  options: MobilityOption[];
  updatedAt: string;
  unverifiedFlags: string[];
}

export interface SimulationComparison {
  baseline: SimulationMetrics;
  scenario: SimulationMetrics;
}

export interface SimulationMetrics {
  unavailableVehicles: number;
  waitingTimeMinutes: number;
  overloadedHubCount: number;
}

export interface SimulationPreview {
  scenarioDraftId: string;
  baseline: SimulationMetrics;
  scenario: Scenario;
  kpis: string[];
}

export interface SimulationResult {
  comparison: SimulationComparison;
  recommendations: Recommendation[];
  constraints: string[];
  saveStatus: SaveStatus;
}

export interface SlotQueryResult {
  options: ChargingSlotOption[];
  verified: boolean;
  slots: ParkingSlot[];
}

export interface SnapshotDataAssessment {
  missingFields: string[];
  completeness: number;
  isStale: boolean;
}

export interface SnapshotInfo {
  snapshotId: string;
  capturedAt: string;
  sources: string[];
  completeness: number;
  isStale: boolean;
}

export interface SnapshotReady {
  snapshotId: string;
}

export interface TargetWorkflow {
  targetUseCase: string;
  recommendationContext: Recommendation;
}

export interface UpdatedReservation {
  reservationId: string;
  hubId: string;
  portId: string;
  timeRange: TimeRange;
  usageGuide: string;
}

export interface ValidatedPlan {
  planDraftId: string;
  baseVersion: number;
}

export interface VehiclePosition {
  hubId: string;
  slotId: string;
  reportedAt: string;
}

export interface VerificationContext {
  resourceStatus: string;
  remainingImpacts: string[];
}

// ---------- Thêm ngoài sơ đồ (xem docs/submission-3/ANH_XA_CLASS_DIAGRAM_CODE.md) ----------

/** Chuyến đi chưa kết thúc của sinh viên, cho trang Chuyến đi (GET /api/trips/current). */
export interface CurrentTripInfo {
  trip: Trip;
  vehicleCode: string;
  vehicleType: VehicleType;
  batteryLevel: number;
  returnHubName?: string;
  returnSlotCode?: string;
}
