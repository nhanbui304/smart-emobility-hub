// Owner: Bùi Quang Nhân – UC06 Reserve Parking Space, Cancel Parking Reservation
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { timeRangeSchema } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { parkingService } from "../services/ParkingService";

const searchQuery = z.object({
  hubId: z.string().min(1),
  vehicleId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
});
export const holdSchema = z.object({
  slotId: z.string().min(1),
  vehicleId: z.string().min(1),
  timeRange: timeRangeSchema,
});

export const parkingController = {
  /** GET /api/parking/slots?hubId=&vehicleId=&startTime=&endTime= */
  async search(req: Request, res: Response): Promise<void> {
    const q = parseOrThrow(searchQuery, req.query);
    const timeRange = parseOrThrow(timeRangeSchema, { startTime: q.startTime, endTime: q.endTime });
    sendOk(res, await parkingService.searchAvailableSlots(currentUser(req).id, q.hubId, q.vehicleId, timeRange));
  },

  /** POST /api/parking/holds */
  async hold(req: Request, res: Response): Promise<void> {
    const { slotId, vehicleId, timeRange } = req.body;
    sendOk(res, await parkingService.holdSlot(currentUser(req).id, slotId, vehicleId, timeRange), 201);
  },

  /** POST /api/parking/holds/:holdToken/confirm */
  async confirm(req: Request, res: Response): Promise<void> {
    const { holdToken } = parseOrThrow(z.object({ holdToken: z.string().min(1) }), req.params);
    sendOk(res, await parkingService.confirmReservation(currentUser(req).id, holdToken));
  },

  /** POST /api/parking/holds/:holdToken/cancel */
  async cancelHold(req: Request, res: Response): Promise<void> {
    const { holdToken } = parseOrThrow(z.object({ holdToken: z.string().min(1) }), req.params);
    sendOk(res, await parkingService.cancelHold(currentUser(req).id, holdToken));
  },

  /** POST /api/parking/bookings/:bookingId/cancel */
  async cancelBooking(req: Request, res: Response): Promise<void> {
    const { bookingId } = parseOrThrow(z.object({ bookingId: z.string().min(1) }), req.params);
    sendOk(res, await parkingService.cancelBooking(currentUser(req).id, bookingId));
  },
};
