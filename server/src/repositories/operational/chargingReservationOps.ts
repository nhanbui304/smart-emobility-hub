// Owner: Ngô Minh Triết – UC08 Schedule Charging Session (queryAvailableChargingSlots dùng chung với UC09)
// Một phần của «repository» OperationalRepository (Sub #3) – xem ../OperationalRepository.ts.
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
import type { ChargingReservation } from "../../db/schema";
import type { TimeRange } from "../../lib/schemas";
import type { ChargingNeed, ChargingSlotOption, CreateResult, SlotQueryResult } from "../../types/dto";
import { db } from "../../lib/db";
import { notImplemented } from "../../lib/errors";

export const chargingReservationOps = {
  queryHubChargingSupport(hubId: string, vehicleId: string): boolean {
    throw notImplemented("OperationalRepository.queryHubChargingSupport");
  },

  findConflictingRequestsOrSchedules(
    studentId: string,
    vehicleId: string,
    date: Date,
    timeRange: TimeRange,
  ): ChargingReservation[] {
    throw notImplemented("OperationalRepository.findConflictingRequestsOrSchedules");
  },

  queryAvailableChargingSlots(
    hubId: string,
    vehicleId: string,
    date: Date,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
    now: Date,
  ): SlotQueryResult {
    throw notImplemented("OperationalRepository.queryAvailableChargingSlots");
  },

  /** UC08 bước 7 / UC09 bước 10 (findSlotOption): phương án còn hạn và thuộc đúng sinh viên. */
  findSlotOption(slotOptionId: string, studentId: string): ChargingSlotOption | undefined {
    throw notImplemented("OperationalRepository.findSlotOption");
  },

  /**
   * UC08 bước 8 – trong db.transaction: requestId đã có trong processed_requests → trả lịch cũ;
   * kiểm tra lại quyền, xung đột, cổng còn trống và không bị hạn chế; tạo lịch CONFIRMED (version = 1);
   * ghi processed_requests. Thất bại thì không để lại phần giữ tài nguyên.
   */
  atomicCreateReservation(
    requestId: string,
    studentId: string,
    vehicleId: string,
    hubId: string,
    portId: string,
    timeRange: TimeRange,
    chargingNeed: ChargingNeed,
  ): CreateResult {
    throw notImplemented("OperationalRepository.atomicCreateReservation");
  },
};
