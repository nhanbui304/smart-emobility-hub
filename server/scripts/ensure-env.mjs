// Tạo server/.env từ server/.env.example nếu chưa có (chạy tự động sau npm install).
import { constants, copyFileSync } from "node:fs";

try {
  const example = new URL("../.env.example", import.meta.url);
  const target = new URL("../.env", import.meta.url);
  copyFileSync(example, target, constants.COPYFILE_EXCL);
  console.log("[ensure-env] Đã tạo server/.env từ server/.env.example");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
