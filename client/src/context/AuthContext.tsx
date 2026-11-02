// Owner: Bùi Quang Nhân – Sign In / Sign Out
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "@hub/shared";
import { authApi } from "../api/auth";
import { TOKEN_KEY, setUnauthorizedHandler } from "../api/client";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  /** true trong lúc kiểm tra token đã lưu khi mở trang. */
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: { email: string; password: string; fullName: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clear);
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // Mở lại trang: dùng token đã lưu để lấy thông tin người dùng
  useEffect(() => {
    if (!token || user) return;
    authApi
      .me()
      .then(setUser)
      .catch(clear)
      .finally(() => setLoading(false));
  }, [token, user, clear]);

  const save = useCallback((t: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    setLoading(false);
    return u;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => {
        const res = await authApi.login(email, password);
        return save(res.token, res.user);
      },
      register: async (input) => {
        const res = await authApi.register(input);
        return save(res.token, res.user);
      },
      logout: async () => {
        await authApi.logout().catch(() => undefined);
        clear();
      },
      setUser,
    }),
    [user, token, loading, save, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong <AuthProvider>");
  return ctx;
}
