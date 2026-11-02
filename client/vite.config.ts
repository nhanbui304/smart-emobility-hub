import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Gọi /api và /socket.io sẽ được chuyển tới server (cổng 3000) – client không cần biết địa chỉ server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
