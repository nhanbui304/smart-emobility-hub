// Owner: Bùi Quang Nhân
import type { AuthUser, LoginResponse, ThemePreference } from "@hub/shared";
import { api } from "./client";

export const authApi = {
  login: (email: string, password: string) => api.post<LoginResponse>("/auth/login", { email, password }),
  register: (input: { email: string; password: string; fullName: string }) =>
    api.post<LoginResponse>("/auth/register", input),
  logout: () => api.post<{ loggedOut: boolean }>("/auth/logout"),
  me: () => api.get<AuthUser>("/auth/me"),
  updateTheme: (themePreference: ThemePreference) => api.patch<AuthUser>("/auth/me/theme", { themePreference }),
};
