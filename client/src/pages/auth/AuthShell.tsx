import type { ReactNode } from "react";
import { LogoMark } from "../../components/Icons";

/** Khung chung cho trang Đăng nhập / Đăng ký. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-xl2 bg-brand p-6 text-white">
          <LogoMark className="h-10 w-10 rounded-lg ring-1 ring-white/10" />
          <p className="mt-6 text-xs font-medium uppercase tracking-wider text-lime">Smart E-Mobility Hub</p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
