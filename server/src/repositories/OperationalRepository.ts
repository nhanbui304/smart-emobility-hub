/**
 * «repository» OperationalRepository – class Repository dùng chung trong class diagram Submission #3
 * (đỗ xe, trả xe, sạc, sự cố, đọc dữ liệu vận hành cho mô phỏng).
 *
 * Trong thiết kế đây là MỘT class. Trong code, các method được tách sang nhiều file con theo người phụ trách
 * (thư mục operational/) để mỗi người sửa file của mình, không đụng nhau; file này gộp lại thành một đối tượng.
 * Service luôn gọi qua `operationalRepository.<method>`.
 *
 * Thêm method mới: viết vào file con tương ứng và cập nhật sơ đồ.
 */
import { commonOps } from "./operational/common";
import { parkingOps } from "./operational/parkingOps";
import { returnOps } from "./operational/returnOps";
import { chargingRequestOps } from "./operational/chargingRequestOps";
import { chargingReservationOps } from "./operational/chargingReservationOps";
import { rescheduleOps } from "./operational/rescheduleOps";
import { chargingScheduleOps } from "./operational/chargingScheduleOps";
import { incidentOps } from "./operational/incidentOps";
import { simulationOps } from "./operational/simulationOps";

export const operationalRepository = {
  ...commonOps, // Dùng chung (cả nhóm)
  ...parkingOps, // Bùi Quang Nhân – UC06 Reserve Parking Space, mục 2.3.1
  ...returnOps, // Bùi Quang Nhân – UC05 Return Shared Vehicle
  ...chargingRequestOps, // Ngô Minh Triết – UC07 Submit Charging Request
  ...chargingReservationOps, // Ngô Minh Triết – UC08 Schedule Charging Session (queryAvailableChargingSlots dùng chung với UC09)
  ...rescheduleOps, // Nguyễn Hoàng Nhân – UC09 Manage Scheduled Charging Session
  ...chargingScheduleOps, // Nguyễn Hoàng Nhân – UC13 Manage Smart Charging Schedule
  ...incidentOps, // Ngô Minh Triết – UC11 Handle Operational Incident
  ...simulationOps, // Nguyễn Hoàng Nhân – UC14 Run What-if Simulation (đọc dữ liệu vận hành để chụp snapshot)
};
