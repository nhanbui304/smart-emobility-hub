import type { Config } from "tailwindcss";

/** Màu chủ đạo lấy theo mockup Figma của nhóm. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#123b2c", // xanh lá đậm – thẻ nổi bật, header
          light: "#1d5a43",
          dark: "#0b261c",
        },
        lime: {
          DEFAULT: "#c8f169", // xanh chanh – nút chính
          dark: "#a9d64a",
        },
        surface: {
          DEFAULT: "#f3f4f1", // nền xám rất nhạt
          dark: "#0e1512",
        },
        panel: {
          dark: "#17221d", // nền thẻ ở chế độ tối
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
