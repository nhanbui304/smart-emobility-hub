/**
 * axios dùng chung: tự bóc { ok, data } và đổi lỗi thành ApiError.
 * Đăng nhập bằng cookie nên không cần gắn token.
 *
 *   const hubs = await api.get<HubStatus[]>("/hubs");
 *   // lỗi: ApiError với code (VALIDATION_ERROR, FORBIDDEN, NOT_IMPLEMENTED...)
 */
import axios, { AxiosError } from "axios";

export class ApiError extends Error {
  code: string;
  status?: number;
  /** Dữ liệu kèm lỗi từ server (ví dụ danh sách Hub gợi ý, vị trí còn trống). */
  details?: unknown;

  constructor(code: string, message: string, status?: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const http = axios.create({ baseURL: "/api", timeout: 15_000 });

/** AuthContext gắn hàm này vào để tự đăng xuất khi phiên hết hạn. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const body = err.response?.data;
    if (body && body.ok === false) {
      if (err.response?.status === 401) onUnauthorized?.();
      return new ApiError(body.error.code, body.error.message, err.response?.status, body.error.details);
    }
    if (!err.response) return new ApiError("NETWORK_ERROR", "Không kết nối được máy chủ. Server đã chạy chưa?");
    return new ApiError("HTTP_ERROR", `Lỗi ${err.response.status}`, err.response.status);
  }
  return new ApiError("UNKNOWN_ERROR", "Đã có lỗi xảy ra.");
}

async function request<T>(
  method: "get" | "post" | "patch" | "delete",
  url: string,
  body?: unknown,
  params?: object,
): Promise<T> {
  try {
    const res = await http.request({ method, url, data: body, params });
    return res.data.data as T;
  } catch (err) {
    throw toApiError(err);
  }
}

export const api = {
  get: <T>(url: string, params?: object) => request<T>("get", url, undefined, params),
  post: <T>(url: string, body?: unknown) => request<T>("post", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("patch", url, body),
  del: <T>(url: string) => request<T>("delete", url),
};
