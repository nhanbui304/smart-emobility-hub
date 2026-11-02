// Owner: Bùi Quang Nhân – Sign In / Sign Out
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { setUnauthorizedHandler } from "../api/client";
import type { AuthUser } from "../types";

interface AuthState {
  user: AuthUser | null;
  /** true trong lúc kiểm tra phiên đăng nhập khi mở trang. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; fullName: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Mở trang: hỏi server xem cookie phiên còn hợp lệ không
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Phiên hết hạn giữa chừng → về trạng thái chưa đăng nhập
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const value: AuthState = {
    user,
    loading,
    login: async (email, password) => {
      const u = await authApi.login(email, password);
      setUser(u);
      return u;
    },
    register: async (input) => {
      const u = await authApi.register(input);
      setUser(u);
      return u;
    },
    logout: async () => {
      await authApi.logout().catch(() => undefined);
      setUser(null);
    },
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  return ctx;
}
