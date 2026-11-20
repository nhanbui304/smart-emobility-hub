// Owner: Lê Quốc Linh – sinh requestId cho thao tác ghi (chống gửi lặp).
// crypto.randomUUID chỉ có trên HTTPS/localhost; mở bằng http://<IP LAN> trên điện thoại thì không có, nên cần bản dự phòng.
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
