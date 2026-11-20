/**
 * Kiểu dữ liệu («datatype») trong class diagram Submission #3 – dữ liệu service/controller trả về.
 * Phần "Sinh từ sơ đồ" được tạo tự động từ các file .drawio trong docs/; client có bản sao trong client/src/types.ts.
 * Ngày giờ (DateTime) ở server là Date, khi gửi JSON thành chuỗi ISO.
 */
import type { AlertType, ChargingPortStatus, ChargingRequestStatus, ChargingReservationStatus, ConnectorType, DeviceCommandResult, Role, ScenarioType, SimulationRunStatus, ThemePreference, VehicleStatus, VehicleTechStatus, VehicleType } from "../constants";
import type { ChargingPort, ChargingReservation, ChargingSession, Hub, Incident, ParkingAllocation, ParkingSlot, PrivateVehicle, RedistributionItem, RedistributionOrder, SharedVehicle, Trip, User, VehicleReservation } from "../db/schema";
import type { TimeRange } from "../lib/schemas";

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
  updatedAt: Date;
  evaluationWindow?: TimeRange;
}

/** Chi tiết Hub cho Operator (UC10 bước 3). */
export interface OperatorHubDetail extends HubDetail {
  activeAlerts: AlertDto[];
  /** Hub có dữ liệu quá dataStaleSeconds giây chưa cập nhật. */
  isDataStale: boolean;
  reservations: HubReservations;
}

// ---------- Sinh từ sơ đồ ----------

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
  connectorType?: ConnectorType;
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
  allocationDeadline?: Date;
}

export interface ChargingRequestResult {
  chargingRequestId: string;
  status: ChargingRequestStatus;
  assignedPortId?: string;
  allocationDeadline?: Date;
  usageGuide: string;
}

export interface ChargingSlotOption {
  slotOptionId: string;
  portId: string;
  hubId: string;
  startTime: Date;
  endTime: Date;
  maxPowerKw: number;
}

export interface ConsentPlan {
  pendingChanges: string[];
  responseDeadline: Date;
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
  lastUpdatedAt: Date;
}

export interface MobilityOption {
  optionId: string;
  hubId: string;
  vehicle: SharedVehicle;
  estimatedDistance: number;
}

export interface MyReservationsResult {
  vehicleReservations: VehicleReservation[];
  parkingAllocations: ParkingAllocation[];
  chargingReservations: ChargingReservation[];
}

export interface NetworkOverview {
  hubs: HubStatus[];
  activeAlerts: AlertDto[];
  generatedAt: Date;
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
  pickupDeadline: Date;
}

export interface PickUpResult {
  outcome: DeviceCommandResult;
  trip?: Trip;
  reservation: VehicleReservation;
}

export interface PlanAdjustment {
  demandId?: string;
  portId: string;
  positionId: string;
  timeRange: TimeRange;
  allocatedPowerKw: number;
}

export interface PlanAllocation {
  demandId?: string;
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
  eta: Date;
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
  pickupDeadline: Date;
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
  returnedAt?: Date;
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
  updatedAt: Date;
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
  capturedAt: Date;
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
  reportedAt: Date;
}

export interface VerificationContext {
  resourceStatus: string;
  remainingImpacts: string[];
}
