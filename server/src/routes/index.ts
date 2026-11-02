/**
 * Gắn mọi nhóm route vào /api. Thêm route mới: tạo file trong routes/ rồi khai báo ở đây.
 *
 * Người phụ trách:
 *   Linh        – hubs, me, vehicle-reservations, trips (UC04), redistribution-orders
 *   Quang Nhân  – auth, parking, trips (UC05 trả xe)
 *   Hoàng Nhân  – monitoring, charging-reservations (UC09), charging-schedules, simulations
 *   Triết       – search, charging-requests, charging-reservations (UC08), incidents
 */
import { Router } from "express";
import { authRoutes } from "./authRoutes";
import { chargingRequestRoutes } from "./chargingRequestRoutes";
import { chargingReservationRoutes } from "./chargingReservationRoutes";
import { chargingScheduleRoutes } from "./chargingScheduleRoutes";
import { hubRoutes } from "./hubRoutes";
import { incidentRoutes } from "./incidentRoutes";
import { monitoringRoutes } from "./monitoringRoutes";
import { myReservationsRoutes } from "./myReservationsRoutes";
import { parkingRoutes } from "./parkingRoutes";
import { redistributionRoutes } from "./redistributionRoutes";
import { reservationRoutes } from "./reservationRoutes";
import { searchRoutes } from "./searchRoutes";
import { simulationRoutes } from "./simulationRoutes";
import { tripRoutes } from "./tripRoutes";

export const apiRoutes = Router();

// Lê Quốc Linh (+ Bùi Quang Nhân: /trips/:tripId/return/*)
apiRoutes.use("/hubs", hubRoutes);
apiRoutes.use("/me", myReservationsRoutes);
apiRoutes.use("/vehicle-reservations", reservationRoutes);
apiRoutes.use("/trips", tripRoutes);
apiRoutes.use("/redistribution-orders", redistributionRoutes);
// Bùi Quang Nhân
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/parking", parkingRoutes);
// Ngô Minh Triết (+ Nguyễn Hoàng Nhân: UC09 trong /charging-reservations)
apiRoutes.use("/search", searchRoutes);
apiRoutes.use("/charging-requests", chargingRequestRoutes);
apiRoutes.use("/charging-reservations", chargingReservationRoutes);
apiRoutes.use("/incidents", incidentRoutes);
// Nguyễn Hoàng Nhân
apiRoutes.use("/monitoring", monitoringRoutes);
apiRoutes.use("/charging-schedules", chargingScheduleRoutes);
apiRoutes.use("/simulations", simulationRoutes);
