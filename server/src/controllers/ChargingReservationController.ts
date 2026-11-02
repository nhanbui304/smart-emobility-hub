// Owner: Ngô Minh Triết (UC08 Schedule Charging Session), Nguyễn Hoàng Nhân (UC09 Manage Scheduled Charging Session)
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { idParams, requestIdField, timeRangeSchema, versionField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { chargingReservationService } from "../services/ChargingReservationService";

export const findSlotsSchema = z.object({
  vehicleId: z.string().min(1),
  hubId: z.string().min(1),
  date: z.coerce.date(),
  timeRange: timeRangeSchema,
  need: z.object({
    currentBattery: z.number().int().min(0).max(100),
    targetBattery: z.number().int().min(1).max(100),
  }),
});
export const confirmChargingSchema = z.object({ requestId: requestIdField, slotOptionId: z.string().min(1) });
export const rescheduleOptionsSchema = z.object({ timeRange: timeRangeSchema });
export const confirmRescheduleSchema = z.object({
  requestId: requestIdField,
  optionId: z.string().min(1),
  expectedVersion: versionField,
});
export const cancelChargingSchema = z.object({ requestId: requestIdField, expectedVersion: versionField });

export const chargingReservationController = {
  /** POST /api/charging-reservations/search */
  async search(req: Request, res: Response): Promise<void> {
    const { vehicleId, hubId, date, timeRange, need } = req.body;
    sendOk(
      res,
      await chargingReservationService.findChargingSlots(currentUser(req).id, vehicleId, hubId, date, timeRange, need),
    );
  },

  /** POST /api/charging-reservations */
  async confirm(req: Request, res: Response): Promise<void> {
    const { requestId, slotOptionId } = req.body;
    sendOk(
      res,
      await chargingReservationService.confirmChargingReservation(requestId, currentUser(req).id, slotOptionId),
      201,
    );
  },

  /** GET /api/charging-reservations/:id */
  async detail(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await chargingReservationService.getReservationDetail(currentUser(req).id, id));
  },

  /** POST /api/charging-reservations/:id/reschedule/start */
  async startReschedule(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await chargingReservationService.startReschedule(currentUser(req).id, id));
  },

  /** POST /api/charging-reservations/:id/reschedule/options */
  async rescheduleOptions(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await chargingReservationService.findRescheduleOptions(currentUser(req).id, id, req.body.timeRange));
  },

  /** POST /api/charging-reservations/:id/reschedule/confirm */
  async confirmReschedule(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    const { requestId, optionId, expectedVersion } = req.body;
    sendOk(
      res,
      await chargingReservationService.confirmReschedule(requestId, currentUser(req).id, id, optionId, expectedVersion),
    );
  },

  /** GET /api/charging-reservations/:id/cancellation-check */
  async checkCancellation(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    sendOk(res, await chargingReservationService.checkCancellation(currentUser(req).id, id));
  },

  /** POST /api/charging-reservations/:id/cancel */
  async cancel(req: Request, res: Response): Promise<void> {
    const { id } = parseOrThrow(idParams, req.params);
    const { requestId, expectedVersion } = req.body;
    sendOk(res, await chargingReservationService.cancelReservation(requestId, currentUser(req).id, id, expectedVersion));
  },
};
