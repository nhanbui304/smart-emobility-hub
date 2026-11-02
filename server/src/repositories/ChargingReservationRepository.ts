// Owner: Ngô Minh Triết (UC08 Schedule Charging Session), Nguyễn Hoàng Nhân (UC09 Manage Scheduled Charging Session)
import type { ChargingPort, ChargingReservation } from "../db/schema";
import { db, type DbOrTx, type Tx } from "../lib/db";
import { notImplemented } from "../lib/errors";

export const chargingReservationRepository = {
  /** UC08/UC09: cổng phù hợp đầu sạc, không có lịch chồng lấn trong khung giờ. */
  findFreePorts(
    hubId: string,
    connectorType: string,
    startTime: Date,
    endTime: Date,
    excludeReservationId?: string,
    conn: DbOrTx = db,
  ): ChargingPort[] {
    throw notImplemented("ChargingReservationRepository.findFreePorts (UC08)");
  },

  findById(reservationId: string, conn: DbOrTx = db): ChargingReservation | undefined {
    throw notImplemented("ChargingReservationRepository.findById (UC09)");
  },

  /** UC08 – trong runIdempotent: kiểm tra lại không chồng lấn rồi tạo lịch CONFIRMED (version = 1). */
  atomicCreateReservation(
    tx: Tx,
    input: { studentId: string; privateVehicleId: string; portId: string; startTime: Date; endTime: Date },
  ): ChargingReservation {
    throw notImplemented("ChargingReservationRepository.atomicCreateReservation (UC08)");
  },

  /** UC09 – trong runIdempotent: version phải khớp expectedVersion; đổi cổng/khung giờ, version + 1. */
  atomicReschedule(
    tx: Tx,
    input: {
      studentId: string;
      reservationId: string;
      portId: string;
      startTime: Date;
      endTime: Date;
      expectedVersion: number;
    },
  ): ChargingReservation {
    throw notImplemented("ChargingReservationRepository.atomicReschedule (UC09)");
  },

  /** UC09 – trong runIdempotent: version phải khớp; CONFIRMED → CANCELLED. */
  atomicCancelReservation(
    tx: Tx,
    input: { studentId: string; reservationId: string; expectedVersion: number; now: Date },
  ): ChargingReservation {
    throw notImplemented("ChargingReservationRepository.atomicCancelReservation (UC09)");
  },
};
