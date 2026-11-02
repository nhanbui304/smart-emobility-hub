// Owner: Bùi Quang Nhân – Customize Interface Mode
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ThemePreference } from "@hub/shared";
import { authApi } from "../api/auth";
import { useAuth } from "./AuthContext";

const THEME_KEY = "hub.theme";

interface ThemeState {
  preference: ThemePreference;
  /** Giao diện thực tế đang áp dụng (SYSTEM được quy về LIGHT/DARK). */
  resolved: "LIGHT" | "DARK";
  setPreference: (pref: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeState | null>(null);

function systemPrefersDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function readStored(): ThemePreference {
  const v = localStorage.getItem(THEME_KEY);
  return v === "LIGHT" || v === "DARK" || v === "SYSTEM" ? v : ThemePreference.SYSTEM;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [preference, setPref] = useState<ThemePreference>(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Theo dõi thay đổi giao diện của hệ điều hành
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Đăng nhập xong: dùng lựa chọn đã lưu trên server
  useEffect(() => {
    if (user) {
      setPref(user.themePreference);
      localStorage.setItem(THEME_KEY, user.themePreference);
    }
  }, [user]);

  const resolved: "LIGHT" | "DARK" =
    preference === ThemePreference.SYSTEM ? (systemDark ? "DARK" : "LIGHT") : preference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "DARK");
  }, [resolved]);

  const setPreference = useCallback(
    async (pref: ThemePreference) => {
      setPref(pref);
      localStorage.setItem(THEME_KEY, pref);
      if (user) setUser(await authApi.updateTheme(pref));
    },
    [user, setUser],
  );

  return <ThemeContext.Provider value={{ preference, resolved, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme phải dùng bên trong <ThemeProvider>");
  return ctx;
}
