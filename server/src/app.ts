/** Tạo Express app: middleware chung → routes → xử lý lỗi. */
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRoutes } from "./routes";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, data: { status: "up", time: new Date().toISOString() } });
  });

  app.use("/api", apiRoutes);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);
  return app;
}
