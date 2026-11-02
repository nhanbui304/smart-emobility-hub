/** Điểm khởi động server: HTTP + Socket.IO + bộ giả lập + các scheduler. */
import { createServer } from "node:http";
import { env } from "./config/env";
import { createApp } from "./app";
import { closeDb } from "./lib/db";
import { closeSocket, initSocket } from "./lib/socket";
import { startSchedulers, stopSchedulers } from "./schedulers";
import { vehicleSimulator } from "./simulator/VehicleSimulator";

const app = createApp();
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`[server] API chạy tại http://localhost:${env.port}/api`);
  if (env.simulatorEnabled) vehicleSimulator.start();
  startSchedulers();
});

async function shutdown() {
  console.log("\n[server] Đang tắt...");
  vehicleSimulator.stop();
  stopSchedulers();
  await closeSocket();
  httpServer.close(() => {
    closeDb();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
