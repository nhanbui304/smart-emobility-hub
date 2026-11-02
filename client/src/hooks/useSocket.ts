/**
 * Kết nối Socket.IO dùng chung (một kết nối cho cả app, xác thực bằng token).
 *
 * Nghe một sự kiện trong component:
 *   useSocketEvent<HubStatusUpdatedPayload>(SocketEvents.HUB_STATUS_UPDATED, (payload) => setHubs(payload.hubs));
 */
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { SocketEvent } from "@hub/shared";
import { useAuth } from "../context/AuthContext";

let socket: Socket | null = null;
let socketToken: string | null = null;

function getSocket(token: string): Socket {
  if (socket && socketToken === token) return socket;
  socket?.disconnect();
  socket = io({ auth: { token }, transports: ["websocket", "polling"] });
  socketToken = token;
  return socket;
}

/** Trả về socket hiện tại và trạng thái kết nối. */
export function useSocket(): { socket: Socket | null; connected: boolean } {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const s = token ? getSocket(token) : null;

  useEffect(() => {
    if (!s) {
      socket?.disconnect();
      socket = null;
      socketToken = null;
      setConnected(false);
      return;
    }
    setConnected(s.connected);
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    s.on("connect", on);
    s.on("disconnect", off);
    return () => {
      s.off("connect", on);
      s.off("disconnect", off);
    };
  }, [s]);

  return { socket: s, connected };
}

/** Đăng ký nghe một sự kiện; tự hủy khi component unmount. */
export function useSocketEvent<T>(event: SocketEvent, handler: (payload: T) => void): { connected: boolean } {
  const { socket: s, connected } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!s) return;
    const listener = (payload: T) => handlerRef.current(payload);
    s.on(event, listener);
    return () => {
      s.off(event, listener);
    };
  }, [s, event]);

  return { connected };
}
