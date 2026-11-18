// Owner: Ngô Minh Triết – UC08 Schedule Charging Session; Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { chargingNeedSchema, requestIdField, timeRangeSchema, versionField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { chargingReservationService } from "../services/ChargingReservationService";

export const findChargingSlotsBody = z.object({
  vehicleId: z.string().min(1),
  hubId: z.string().min(1),
  date: z.coerce.date(),
  timeRange: timeRangeSchema,
  chargingNeed: chargingNeedSchema,
});
export const confirmChargingReservationBody = z.object({ requestId: requestIdField, slotOptionId: z.string().min(1) });
export const findRescheduleOptionsBody = z.object({
  hubId: z.string().min(1),
  timeRange: timeRangeSchema,
  chargingNeed: chargingNeedSchema,
});
export const confirmRescheduleBody = z.object({
  requestId: requestIdField,
  optionId: z.string().min(1),
  expectedVersion: versionField,
});
export const cancelReservationBody = z.object({ requestId: requestIdField, expectedVersion: versionField });

export const chargingReservationController = {
  /** POST /api/charging-reservations/search */
  async findChargingSlots(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { vehicleId, hubId, date, timeRange, chargingNeed } = req.body as z.infer<typeof findChargingSlotsBody>;
    sendOk(res, await chargingReservationService.findChargingSlots(user.id, vehicleId, hubId, date, timeRange, chargingNeed));
  },

  /** POST /api/charging-reservations */
  async confirmChargingReservation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId, slotOptionId } = req.body as z.infer<typeof confirmChargingReservationBody>;
    sendOk(res, await chargingReservationService.confirmChargingReservation(requestId, user.id, slotOptionId));
  },

  /** GET /api/charging-reservations/:reservationId */
  async getReservationDetail(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    sendOk(res, await chargingReservationService.getReservationDetail(user.id, reservationId));
  },

  /** POST /api/charging-reservations/:reservationId/reschedule/start */
  async startReschedule(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    sendOk(res, await chargingReservationService.startReschedule(user.id, reservationId));
  },

  /** POST /api/charging-reservations/:reservationId/reschedule/options */
  async findRescheduleOptions(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    const { hubId, timeRange, chargingNeed } = req.body as z.infer<typeof findRescheduleOptionsBody>;
    sendOk(res, await chargingReservationService.findRescheduleOptions(user.id, reservationId, hubId, timeRange, chargingNeed));
  },

  /** POST /api/charging-reservations/:reservationId/reschedule/confirm */
  async confirmReschedule(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    const { requestId, optionId, expectedVersion } = req.body as z.infer<typeof confirmRescheduleBody>;
    sendOk(res, await chargingReservationService.confirmReschedule(requestId, user.id, reservationId, optionId, expectedVersion));
  },

  /** GET /api/charging-reservations/:reservationId/cancellation-check */
  async checkCancellation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    sendOk(res, await chargingReservationService.checkCancellation(user.id, reservationId));
  },

  /** POST /api/charging-reservations/:reservationId/cancel */
  async cancelReservation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    const { requestId, expectedVersion } = req.body as z.infer<typeof cancelReservationBody>;
    sendOk(res, await chargingReservationService.cancelReservation(requestId, user.id, reservationId, expectedVersion));
  },
};
