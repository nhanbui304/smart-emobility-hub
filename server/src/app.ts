/** Tạo Express app: middleware chung → routes → xử lý lỗi. */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import session from "express-session";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRoutes } from "./routes";

const clientDist = fileURLToPath(new URL("../../client/dist/", import.meta.url));

export function createApp() {
  const app = express();

  app.use(express.json());
  // Đăng nhập bằng session: server lưu người dùng trong phiên, trình duyệt giữ cookie.
  // Phiên lưu trong bộ nhớ: khởi động lại server thì mọi người phải đăng nhập lại (chấp nhận được cho demo).
  app.use(
    session({
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 },
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, data: { status: "up", time: new Date().toISOString() } });
  });

  app.use("/api", apiRoutes);

  app.use("/api", notFoundHandler);

  if (env.isProduction) {
    app.use(express.static(clientDist));
    app.get("/{*path}", (req, res, next) => {
      if (!req.accepts("html")) return next();
      res.sendFile(join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
