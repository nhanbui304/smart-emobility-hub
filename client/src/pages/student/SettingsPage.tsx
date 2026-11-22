// Owner: Bùi Quang Nhân – Customize Interface Mode, Sign Out
import type { ThemePreference } from "../../types";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const OPTIONS: Array<{ value: ThemePreference; label: string; hint: string }> = [
  { value: "LIGHT", label: "Sáng", hint: "Luôn dùng giao diện sáng" },
  { value: "DARK", label: "Tối", hint: "Luôn dùng giao diện tối" },
  { value: "SYSTEM", label: "Theo hệ thống", hint: "Tự đổi theo thiết bị" },
];

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();

  return (
    <div className="space-y-5">
      <PageHeader title="Cài đặt" />

      <Card>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Tài khoản</p>
        <p className="mt-1 font-semibold">{user?.fullName}</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{user?.email}</p>
      </Card>

      <section data-tour="st-theme" aria-labelledby="theme-heading">
        <h2 id="theme-heading" className="mb-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          Giao diện
        </h2>
        <Card className="divide-y divide-neutral-100 p-0 dark:divide-white/5" role="radiogroup">
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center justify-between px-5 py-4">
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{o.hint}</span>
              </span>
              <input
                type="radio"
                name="theme"
                className="h-5 w-5 accent-brand dark:accent-lime"
                checked={preference === o.value}
                onChange={() => void setPreference(o.value)}
              />
            </label>
          ))}
        </Card>
      </section>

      <Button variant="outline" fullWidth onClick={() => void logout()}>
        Đăng xuất
      </Button>
    </div>
  );
}
