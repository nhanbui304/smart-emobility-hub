// Owner: Ngô Minh Triết (UC08 Schedule Charging Session), Nguyễn Hoàng Nhân (UC09 Manage Scheduled Charging Session)
import type { ChargingReservation } from "../db/schema";
import { notImplemented } from "../lib/errors";
import type { TimeRange } from "../lib/schemas";
import type { ChargingNeed } from "./ChargingRequestService";

export interface ChargingSlotOption {
  /** Mã phương án tạm (giữ trong bộ nhớ hoặc mã hóa portId + thời gian). */
  slotOptionId: string;
  portId: string;
  hubId: string;
  startTime: Date;
  endTime: Date;
  maxPowerKw: number;
}

export interface CancellationCheck {
  canCancel: boolean;
  reason?: string;
  version: number;
}

export const chargingReservationService = {
  /** UC08 bước 2–4: tìm khung giờ/cổng sạc phù hợp. */
  async findChargingSlots(
    studentId: string,
    vehicleId: string,
    hubId: string,
    date: Date,
    timeRange: TimeRange,
    need: ChargingNeed,
  ): Promise<ChargingSlotOption[]> {
    throw notImplemented("ChargingReservationService.findChargingSlots (UC08)");
  },

  /** UC08 bước 5–6: xác nhận đặt lịch sạc. */
  async confirmChargingReservation(studentId: string, slotOptionId: string): Promise<ChargingReservation> {
    throw notImplemented("ChargingReservationService.confirmChargingReservation (UC08)");
  },

  /** UC09 bước 1–2: xem chi tiết lịch sạc (chỉ của chính sinh viên). */
  async getReservationDetail(studentId: string, reservationId: string): Promise<ChargingReservation> {
    throw notImplemented("ChargingReservationService.getReservationDetail (UC09)");
  },

  /** UC09 đổi lịch bước 1: kiểm tra lịch còn đổi được (CONFIRMED, chưa tới giờ). */
  async startReschedule(studentId: string, reservationId: string): Promise<ChargingReservation> {
    throw notImplemented("ChargingReservationService.startReschedule (UC09)");
  },

  /** UC09 đổi lịch bước 2: tìm phương án mới, bỏ qua chính lịch hiện tại khi kiểm tra chồng lấn. */
  async findRescheduleOptions(
    studentId: string,
    reservationId: string,
    timeRange: TimeRange,
  ): Promise<ChargingSlotOption[]> {
    throw notImplemented("ChargingReservationService.findRescheduleOptions (UC09)");
  },

  /** UC09 đổi lịch bước 3: xác nhận, kiểm tra expectedVersion. */
  async confirmReschedule(
    studentId: string,
    reservationId: string,
    optionId: string,
    expectedVersion: number,
  ): Promise<ChargingReservation> {
    throw notImplemented("ChargingReservationService.confirmReschedule (UC09)");
  },

  /** UC09 hủy lịch bước 1: kiểm tra có được hủy không. */
  async checkCancellation(studentId: string, reservationId: string): Promise<CancellationCheck> {
    throw notImplemented("ChargingReservationService.checkCancellation (UC09)");
  },

  /** UC09 hủy lịch bước 2: hủy, kiểm tra expectedVersion. */
  async cancelReservation(
    studentId: string,
    reservationId: string,
    expectedVersion: number,
  ): Promise<ChargingReservation> {
    throw notImplemented("ChargingReservationService.cancelReservation (UC09)");
  },
};
