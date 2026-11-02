/**
 * axios dùng chung: tự gắn token, tự bóc { ok, data }.
 * Gọi API: const hubs = await api.get<HubStatus[]>("/hubs");
 * Lỗi luôn là ApiError với code (VALIDATION_ERROR, FORBIDDEN, NOT_IMPLEMENTED...).
 */
import axios, { AxiosError } from "axios";
import type { ApiResponse } from "@hub/shared";

export const TOKEN_KEY = "hub.token";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const http = axios.create({ baseURL: "/api", timeout: 15_000 });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Được AuthContext gắn vào để tự đăng xuất khi token hết hạn. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function toApiError(err: unknown): ApiError {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiResponse<unknown> | undefined;
    if (body && body.ok === false) {
      if (err.response?.status === 401) onUnauthorized?.();
      return new ApiError(body.error.code, body.error.message, err.response?.status, body.error.details);
    }
    if (!err.response) return new ApiError("NETWORK_ERROR", "Không kết nối được máy chủ. Server đã chạy chưa?");
    return new ApiError("HTTP_ERROR", `Lỗi ${err.response.status}`, err.response.status);
  }
  return new ApiError("UNKNOWN_ERROR", "Đã có lỗi xảy ra.");
}

async function request<T>(method: "get" | "post" | "patch" | "delete", url: string, body?: unknown, params?: object) {
  try {
    const res = await http.request<ApiResponse<T>>({ method, url, data: body, params });
    if (res.data.ok) return res.data.data;
    throw new ApiError(res.data.error.code, res.data.error.message, res.status);
  } catch (err) {
    throw err instanceof ApiError ? err : toApiError(err);
  }
}

export const api = {
  get: <T>(url: string, params?: object) => request<T>("get", url, undefined, params),
  post: <T>(url: string, body?: unknown) => request<T>("post", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("patch", url, body),
  delete: <T>(url: string) => request<T>("delete", url),
};

/** Mỗi thao tác ghi (đặt, hủy, xác nhận...) sinh MỘT requestId và dùng lại khi bấm thử lại. */
export function newRequestId(): string {
  return crypto.randomUUID();
}
