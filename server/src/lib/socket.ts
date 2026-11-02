/**
 * Socket.IO dùng chung.
 * - Xác thực bằng JWT khi kết nối: client gửi { auth: { token } }.
 * - Mỗi người dùng vào phòng user:<id>; Operator vào thêm phòng "operators".
 *
 * Gửi sự kiện từ service:
 *   emitToAll(SocketEvents.HUB_STATUS_UPDATED, payload)
 *   emitToOperators(SocketEvents.ALERT_RAISED, alert)
 *   emitToUser(studentId, SocketEvents.NOTIFICATION, { title, message, createdAt })
 */
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { Role, SocketRooms, type SocketEvent } from "@hub/shared";
import { env } from "../config/env";
import { verifyToken } from "./jwt";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, { cors: { origin: env.clientOrigin } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = typeof token === "string" ? verifyToken(token) : null;
    if (!payload) return next(new Error("UNAUTHORIZED"));
    socket.data.user = { id: payload.sub, role: payload.role };
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as { id: string; role: Role };
    socket.join(SocketRooms.user(user.id));
    if (user.role === Role.OPERATOR) socket.join(SocketRooms.OPERATORS);
  });

  return io;
}

export function emitToAll(event: SocketEvent, payload: unknown): void {
  io?.emit(event, payload);
}

export function emitToOperators(event: SocketEvent, payload: unknown): void {
  io?.to(SocketRooms.OPERATORS).emit(event, payload);
}

export function emitToUser(userId: string, event: SocketEvent, payload: unknown): void {
  io?.to(SocketRooms.user(userId)).emit(event, payload);
}

export function closeSocket(): Promise<void> {
  return new Promise((resolve) => (io ? io.close(() => resolve()) : resolve()));
}
