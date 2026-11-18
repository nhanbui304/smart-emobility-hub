// Owner: Lê Quốc Linh – UC02 Reserve Shared Vehicle, UC03 Cancel Vehicle Reservation
// Chữ ký method khớp class diagram Submission #3 (docs/**/*.drawio). Đổi chữ ký thì sửa cả sơ đồ.
// Controller chỉ đọc request → gọi service → trả response. studentId/operatorId lấy từ phiên đăng nhập.
import type { Request, Response } from "express";
import { z } from "zod";
import { sendOk } from "../lib/response";
import { requestIdField } from "../lib/schemas";
import { currentUser } from "../middleware/auth";
import { parseOrThrow } from "../middleware/validate";
import { myReservationsService } from "../services/MyReservationsService";
import { reservationService } from "../services/ReservationService";

const getReservableVehiclesQuery = z.object({ hubId: z.string().min(1) });
export const prepareReservationBody = z.object({ hubId: z.string().min(1), vehicleId: z.string().min(1) });
export const confirmReservationBody = z.object({
  requestId: requestIdField,
  hubId: z.string().min(1),
  vehicleId: z.string().min(1),
});
export const confirmCancellationBody = z.object({ requestId: requestIdField });

export const reservationController = {
  /** GET /api/vehicle-reservations/reservable */
  async getReservableVehicles(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { hubId } = parseOrThrow(getReservableVehiclesQuery, req.query);
    sendOk(res, await reservationService.getReservableVehicles(user.id, hubId));
  },

  /** POST /api/vehicle-reservations/prepare */
  async prepareReservation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { hubId, vehicleId } = req.body as z.infer<typeof prepareReservationBody>;
    sendOk(res, await reservationService.prepareReservation(user.id, hubId, vehicleId));
  },

  /** POST /api/vehicle-reservations */
  async confirmReservation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId, hubId, vehicleId } = req.body as z.infer<typeof confirmReservationBody>;
    sendOk(res, await reservationService.confirmReservation(requestId, user.id, hubId, vehicleId));
  },

  /** GET /api/vehicle-reservations/results/:requestId */
  async getReservationResult(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId } = parseOrThrow(z.object({ requestId: z.string().min(1) }), req.params);
    sendOk(res, await reservationService.getReservationResult(requestId, user.id));
  },

  /** GET /api/vehicle-reservations/mine */
  async getMyReservations(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    sendOk(res, (await myReservationsService.getMyReservations(user.id)).vehicleReservations);
  },

  /** GET /api/vehicle-reservations/cancellations/results/:requestId */
  async getCancellationResult(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { requestId } = parseOrThrow(z.object({ requestId: z.string().min(1) }), req.params);
    sendOk(res, await reservationService.getCancellationResult(requestId, user.id));
  },

  /** POST /api/vehicle-reservations/:reservationId/cancel/prepare */
  async prepareCancellation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    sendOk(res, await reservationService.prepareCancellation(user.id, reservationId));
  },

  /** POST /api/vehicle-reservations/:reservationId/cancel */
  async confirmCancellation(req: Request, res: Response): Promise<void> {
    const user = currentUser(req);
    const { reservationId } = parseOrThrow(z.object({ reservationId: z.string().min(1) }), req.params);
    const { requestId } = req.body as z.infer<typeof confirmCancellationBody>;
    sendOk(res, await reservationService.confirmCancellation(requestId, user.id, reservationId));
  },
};
