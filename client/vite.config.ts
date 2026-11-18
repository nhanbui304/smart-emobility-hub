import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Gọi /api sẽ được chuyển tới server (cổng 3000), nên client và server dùng chung cookie đăng nhập.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Cho phép mở từ điện thoại cùng Wi-Fi: http://<IP máy tính>:5173
    host: true,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
