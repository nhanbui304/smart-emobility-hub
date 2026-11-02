// Owner: Bùi Quang Nhân – khung giao diện Student (mobile-first)
import { NavLink, Outlet } from "react-router-dom";
import { BikeIcon, HomeIcon, RouteIcon, SettingsIcon } from "../components/Icons";

const tabs = [
  { to: "/student", label: "Trang chủ", icon: HomeIcon, end: true },
  { to: "/student/trips", label: "Chuyến đi", icon: RouteIcon, end: false },
  { to: "/student/my-vehicle", label: "Xe của tôi", icon: BikeIcon, end: false },
  { to: "/student/settings", label: "Cài đặt", icon: SettingsIcon, end: false },
];

export function StudentLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-surface dark:bg-surface-dark sm:border-x sm:border-neutral-200 sm:dark:border-white/5">
      <main className="flex-1 px-4 pb-28 pt-6">
        <Outlet />
      </main>

      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-panel-dark/95"
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
