/** Điểm khởi động server: Express API + bộ giả lập xe + các tác vụ định kỳ. */
import { env } from "./config/env";
import { createApp } from "./app";
import { startSchedulers } from "./schedulers";
import { vehicleSimulator } from "./simulator/VehicleSimulator";

const app = createApp();

app.listen(env.port, (error) => {
  if (error) throw error;
  console.log(`[server] API chạy tại http://localhost:${env.port}/api`);
  if (env.simulatorEnabled) vehicleSimulator.start();
  startSchedulers();
});
