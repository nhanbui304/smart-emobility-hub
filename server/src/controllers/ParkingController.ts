// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField, timeRangeSchema } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { parkingService } from "../services/ParkingService";

const searchAvailableSlotsQuery = z.object({
  hubId: z.string().min(1),
  vehicleId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});
export const holdSlotBody = z.object({
  requestId: requestIdField,
  slotId: z.string().min(1),
  vehicleId: z.string().min(1),
  timeRange: timeRangeSchema,
});
export const confirmReservationBody = z.object({ requestId: requestIdField });
export const cancelHoldBody = z.object({ requestId: requestIdField });

export const parkingController = {
  /** GET /api/parking/slots */
  async searchAvailableSlots(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { hubId, vehicleId, startTime, endTime } = parseOrThrow(searchAvailableSlotsQuery, req.query);
    const timeRange = parseOrThrow(timeRangeSchema, { startTime, endTime });
    sendOk(res, await parkingService.searchAvailableSlots(user.id, hubId, vehicleId, timeRange));
  },

  /** POST /api/parking/holds */
  async holdSlot(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId, slotId, vehicleId, timeRange } = req.body as z.infer<typeof holdSlotBody>;
    sendOk(res, await parkingService.holdSlot(requestId, user.id, slotId, vehicleId, timeRange));
  },

  /** GET /api/parking/holds/active */
  async getActiveHold(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    sendOk(res, await parkingService.getActiveHold(user.id));
  },

  /** POST /api/parking/holds/:holdToken/confirm */
  async confirmReservation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { holdToken } = parseOrThrow(z.object({ holdToken: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof confirmReservationBody>;
    sendOk(res, await parkingService.confirmReservation(requestId, user.id, holdToken));
  },

  /** POST /api/parking/holds/:holdToken/cancel */
  async cancelHold(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { holdToken } = parseOrThrow(z.object({ holdToken: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof cancelHoldBody>;
    sendOk(res, await parkingService.cancelHold(requestId, user.id, holdToken));
  },

  /** POST /api/parking/bookings/:bookingId/cancel */
  async cancelBooking(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { bookingId } = parseOrThrow(z.object({ bookingId: z.string().min(1) }), req.params);
    sendOk(res, await parkingService.cancelBooking(user.id, bookingId));
  },
};
