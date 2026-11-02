/** Tên sự kiện Socket.IO dùng chung client/server. */
export const SocketEvents = {
  HUB_STATUS_UPDATED: "HUB_STATUS_UPDATED",
  VEHICLE_STATUS_UPDATED: "VEHICLE_STATUS_UPDATED",
  ALERT_RAISED: "ALERT_RAISED",
  ALERT_CLEARED: "ALERT_CLEARED",
  SIMULATION_FINISHED: "SIMULATION_FINISHED",
  NOTIFICATION: "NOTIFICATION",
} as const;
export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

/** Phòng (room) Socket.IO. */
export const SocketRooms = {
  OPERATORS: "operators",
  user: (userId: string) => `user:${userId}`,
} as const;
