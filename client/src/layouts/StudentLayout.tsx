// Owner: Bùi Quang Nhân – khung giao diện Student (responsive)
// Điện thoại: một cột, thanh tab dưới đáy như app. Máy tính (từ md trở lên): thanh menu ngang trên cùng, nội dung rộng.
import { NavLink, Outlet } from "react-router-dom";
import { BikeIcon, HomeIcon, LogoMark, RouteIcon, SettingsIcon } from "../components/Icons";
import { useAuth } from "../context/AuthContext";

const tabs = [
  { to: "/student", label: "Trang chủ", icon: HomeIcon, end: true },
  { to: "/student/trips", label: "Chuyến đi", icon: RouteIcon, end: false },
  { to: "/student/my-vehicle", label: "Xe của tôi", icon: BikeIcon, end: false },
  { to: "/student/settings", label: "Cài đặt", icon: SettingsIcon, end: false },
];

export function StudentLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      {/* Máy tính: thanh menu ngang */}
      <header className="sticky top-0 z-20 hidden border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-panel-dark/95 md:block">
        <div className="mx-auto flex max-w-5xl items-center gap-8 px-6 py-3">
          <NavLink to="/student" className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 rounded-lg" />
            <div className="leading-tight">
              <p className="text-sm font-bold">Smart E-Mobility</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Khu đô thị ĐHQG-HCM</p>
            </div>
          </NavLink>
          <nav aria-label="Điều hướng chính" className="flex flex-1 gap-1">
            {tabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-lime/70 text-brand-dark dark:bg-lime/15 dark:text-lime"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{user.fullName}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{user.email}</p>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex min-h-screen max-w-md flex-col sm:border-x sm:border-neutral-200 sm:dark:border-white/5 md:min-h-0 md:max-w-5xl md:border-x-0">
        <main className="flex-1 px-4 pb-28 pt-6 md:px-6 md:pb-12 md:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Điện thoại: thanh tab dưới đáy */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-panel-dark/95 md:hidden"
      >
        <ul className="grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition ${
                    isActive
                      ? "text-brand dark:text-lime"
                      : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`rounded-full px-4 py-1 transition ${isActive ? "bg-lime/70 dark:bg-lime/15" : ""}`}
                    >
                      <Icon />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
