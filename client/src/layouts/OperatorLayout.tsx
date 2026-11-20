// Owner: Bùi Quang Nhân – khung giao diện Operator (desktop, sidebar trái)
import { NavLink, Outlet } from "react-router-dom";
import { BoltIcon, ChartIcon, GridIcon, LogoMark, LogoutIcon, TruckIcon } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const items = [
  { to: "/operator/monitoring", label: "Giám sát mạng lưới", icon: GridIcon },
  { to: "/operator/charging-incidents", label: "Lịch sạc và sự cố", icon: BoltIcon },
  { to: "/operator/simulation", label: "Mô phỏng What-if", icon: ChartIcon },
];

export function OperatorLayout() {
  const { user, logout } = useAuth();
  const { resolved, setPreference } = useTheme();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-brand text-white">
        <div className="flex items-center gap-3 px-5 py-6">
          <LogoMark className="h-9 w-9 ring-1 ring-white/10 rounded-lg" />
          <div className="leading-tight">
            <p className="text-sm font-bold">Smart E-Mobility</p>
            <p className="text-xs text-white/60">Bảng điều phối</p>
          </div>
        </div>

        <nav aria-label="Điều hướng Operator" className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-lime text-brand-dark" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/operator/redistribution"
            className={({ isActive }) =>
              `mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive ? "bg-lime text-brand-dark" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <TruckIcon className="h-5 w-5" />
            Điều chuyển xe
          </NavLink>
        </nav>

        <div className="border-t border-white/10 p-4 text-sm">
          <p className="font-semibold">{user?.fullName}</p>
          <p className="truncate text-xs text-white/60">{user?.email}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void setPreference(resolved === "DARK" ? "LIGHT" : "DARK")}
              className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"
            >
              {resolved === "DARK" ? "Giao diện sáng" : "Giao diện tối"}
            </button>
            <button
              onClick={() => void logout()}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"
            >
              <LogoutIcon className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
