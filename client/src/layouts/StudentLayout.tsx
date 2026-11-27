// Owner: Bùi Quang Nhân – khung giao diện Student (responsive)
// Điện thoại: một cột, thanh tab dưới đáy như app. Máy tính (từ md trở lên): thanh menu ngang trên cùng tinh gọn.
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BikeIcon, HomeIcon, LogoMark, RouteIcon, SettingsIcon } from "../components/Icons";
import { OnboardingTour, hasSeenTour, type TourStep } from "../components/OnboardingTour";
import { useAuth } from "../context/AuthContext";

interface PageTourConfig {
  storageKey: string;
  buttonLabel: string;
  steps: TourStep[];
}

function getStudentPageTour(pathname: string): PageTourConfig {
  if (pathname.includes("/reserve")) {
    return {
      storageKey: "emobility_tour_st_reserve_v1",
      buttonLabel: "Hướng dẫn Đặt xe",
      steps: [
        {
          ucTag: "UC02 · Đặt xe dùng chung",
          title: "Chọn & Giữ xe trước 30 phút",
          content:
            "Danh sách chỉ hiện các xe đang sẵn sàng với mức pin ≥ 30% tại Hub này, kèm biển số và ước tính quãng đường đi được.",
        },
        {
          target: '[data-tour="st-reserve-list"]',
          ucTag: "UC02 · Chọn xe",
          title: "Bấm Chọn xe → Xác nhận đặt xe",
          content:
            "Chọn 1 chiếc xe phù hợp để xem lại thông tin và hạn giữ xe 30 phút, rồi bấm Xác nhận đặt xe. Hệ thống chống đặt trùng tự động.",
          placement: "top",
        },
      ],
    };
  }

  if (pathname.startsWith("/student/trips")) {
    return {
      storageKey: "emobility_tour_st_trips_v1",
      buttonLabel: "Hướng dẫn Chuyến đi",
      steps: [
        {
          ucTag: "UC03 · UC04 · UC05",
          title: "Quản lý toàn bộ hành trình thuê xe",
          content:
            "Trang Chuyến đi gom gọn 3 thao tác: Hủy đặt xe còn hạn (UC03), Mở khóa nhận xe (UC04) và Trả xe về Hub đích (UC05).",
        },
        {
          target: '[data-tour="st-trip-booking"]',
          ucTag: "UC03 & UC04",
          title: "Xe đã đặt: Hủy đặt hoặc Mở khóa nhận xe",
          content:
            "Khi đang giữ xe, đối chiếu đúng biển số và bấm Mở khóa nhận xe để bắt đầu chuyến đi (hoặc bấm Hủy đặt xe để giải phóng xe ngay).",
          placement: "bottom",
        },
        {
          target: '[data-tour="st-trip-return"]',
          ucTag: "UC05 · Trả xe",
          title: "Trả xe về bất kỳ Hub nào còn chỗ trống",
          content:
            "Khi đang trong chuyến đi, chọn Hub đích → bấm Chuẩn bị trả xe để giữ 1 ô đỗ trống → bấm Xác nhận trả xe & khóa xe.",
          placement: "top",
        },
      ],
    };
  }

  if (pathname.startsWith("/student/my-vehicle")) {
    return {
      storageKey: "emobility_tour_st_vehicle_v1",
      buttonLabel: "Hướng dẫn Xe cá nhân",
      steps: [
        {
          ucTag: "Hồ sơ xe · UC06 – UC09",
          title: "Quản lý xe cá nhân, chỗ đỗ & lịch sạc",
          content:
            "Đăng ký/cập nhật xe điện cá nhân ở góc trên bên phải và sử dụng trọn bộ tiện ích đỗ xe, sạc xe tại 5 Mobility Hub ĐHQG-HCM.",
        },
        {
          target: '[data-tour="st-vehicle-manage-btn"]',
          ucTag: "Hồ sơ phương tiện",
          title: "Quản lý danh sách xe điện cá nhân",
          content:
            "Bấm để mở khung thêm xe mới, cập nhật biển số/chuẩn đầu cắm hoặc xóa phương tiện không còn sử dụng.",
          placement: "bottom",
        },
        {
          target: '[data-tour="st-parking"]',
          ucTag: "UC06 · Đặt chỗ đỗ",
          title: "Giữ tạm & Xác nhận chỗ đỗ xe",
          content:
            "Chọn xe cá nhân, Hub và khung giờ → Tìm vị trí trống → Giữ chỗ tạm (30 phút) → Xác nhận đặt chỗ (chỉ dùng ô đỗ thường, không trùng ô sạc).",
          placement: "bottom",
        },
        {
          target: '[data-tour="st-charge-schedule"]',
          ucTag: "UC08 · Đặt lịch sạc",
          title: "Đặt lịch sạc trước theo khung giờ",
          content:
            "Chọn Hub, khung giờ tương lai và % pin mong muốn để hệ thống tìm cổng sạc tương thích đầu cắm rồi xác nhận giữ lịch.",
          placement: "top",
        },
        {
          target: '[data-tour="st-charge-manage"]',
          ucTag: "UC09 · Quản lý lịch sạc",
          title: "Đổi khung giờ hoặc Hủy lịch sạc",
          content:
            "Xem các lịch sạc đã xác nhận của bạn, bấm Đổi lịch để chuyển sang khung giờ khác hoặc Hủy lịch khi thay đổi kế hoạch.",
          placement: "top",
        },
        {
          target: '[data-tour="st-charge-now-link"]',
          ucTag: "UC07 · Sạc ngay",
          title: "Cần sạc gấp ngay lập tức?",
          content:
            "Bấm vào đây để chuyển sang màn hình Yêu cầu sạc ngay tại Hub (nhận cổng liền hoặc vào hàng đợi ưu tiên pin thấp).",
          placement: "top",
        },
      ],
    };
  }

  if (pathname.startsWith("/student/charging-request")) {
    return {
      storageKey: "emobility_tour_st_charge_now_v1",
      buttonLabel: "Hướng dẫn Sạc ngay",
      steps: [
        {
          ucTag: "UC07 · Sạc ngay",
          title: "Yêu cầu sạc tức thời hoặc vào hàng đợi",
          content:
            "Dùng khi bạn đang ở Hub và muốn cắm sạc ngay mà không cần đặt lịch từ hôm trước.",
        },
        {
          target: '[data-tour="st-uc07-form"]',
          ucTag: "UC07 · Bước 1 & 2",
          title: "Kiểm tra cổng trống & Xác nhận",
          content:
            "Chọn Hub, xe và % pin hiện tại → bấm Kiểm tra khả năng sạc ngay. Nếu có cổng trống sẽ nhận cổng ngay; nếu đầy cổng sẽ vào hàng đợi có thời gian chờ ước tính.",
          placement: "bottom",
        },
        {
          target: '[data-tour="st-uc07-list"]',
          ucTag: "UC07 · Theo dõi",
          title: "Theo dõi hoặc Hủy yêu cầu sạc",
          content:
            "Xem trạng thái cổng đã cấp / vị trí hàng đợi tại đây và bấm Hủy nếu không còn nhu cầu.",
          placement: "top",
        },
      ],
    };
  }

  if (pathname.startsWith("/student/reservations")) {
    return {
      storageKey: "emobility_tour_st_myres_v1",
      buttonLabel: "Hướng dẫn Đặt chỗ",
      steps: [
        {
          target: '[data-tour="st-myres"]',
          ucTag: "View My Reservations",
          title: "Tất cả lượt đặt còn hiệu lực của bạn",
          content:
            "Theo dõi tập trung 3 nhóm: Đặt xe dùng chung, Đặt chỗ đỗ và Lịch sạc cá nhân — tự động làm mới mỗi 3 giây.",
          placement: "top",
        },
      ],
    };
  }

  if (pathname.startsWith("/student/settings")) {
    return {
      storageKey: "emobility_tour_st_settings_v1",
      buttonLabel: "Hướng dẫn Cài đặt",
      steps: [
        {
          target: '[data-tour="st-theme"]',
          ucTag: "Customize Interface",
          title: "Chuyển giao diện Sáng / Tối",
          content:
            "Chọn chế độ Sáng, Tối hoặc Theo hệ thống. Lựa chọn được lưu trực tiếp lên tài khoản trên server.",
          placement: "bottom",
        },
      ],
    };
  }

  return {
    storageKey: "emobility_tour_st_home_v1",
    buttonLabel: "Hướng dẫn Khám phá Hub",
    steps: [
      {
        ucTag: "View Hub Status · UC01",
        title: "Chào mừng đến Smart E-Mobility Hub",
        content:
          "Trang chủ giúp bạn xem trạng thái 5 Hub ĐHQG-HCM theo thời gian thực (3s/lần) và tìm nhanh xe/chỗ đỗ/cổng sạc phù hợp.",
      },
      {
        target: '[data-tour="st-home-modes"]',
        ucTag: "2 Nhóm nhu cầu",
        title: "Xe dùng chung (Thuê xe) & Xe cá nhân (Đỗ · Sạc)",
        content:
          "Chuyển đổi rõ ràng giữa nhu cầu Thuê xe dùng chung và nhóm tiện ích Xe cá nhân (Đỗ xe, Sạc xe) để bản đồ và thẻ Hub hiển thị đúng tài nguyên.",
        placement: "bottom",
      },
      {
        target: '[data-tour="st-home-map"]',
        ucTag: "Bản đồ trực tiếp",
        title: "Bấm vào pin Hub trên bản đồ ĐHQG-HCM",
        content:
          "Bấm vào bất kỳ Hub nào (Ga Metro, ĐH Bách Khoa, Thư viện TT, ĐH KHTN, KTX Khu B) để xem chi tiết tài nguyên ở cột bên phải.",
        placement: "bottom",
      },
      {
        target: '[data-tour="st-home-hubcard"]',
        ucTag: "Đặt nhanh",
        title: "Chọn thẳng xe pin cao hoặc tiện ích xe cá nhân",
        content:
          "Ở chế độ Thuê xe, chọn ngay 1 xe trong top 3 pin cao (UC02). Ở chế độ Đỗ xe / Sạc xe, xem xe cá nhân của bạn kèm số chỗ đỗ và cổng sạc rảnh để thao tác ngay.",
        placement: "left",
      },
      {
        target: '[data-tour="st-home-search"]',
        ucTag: "UC01 · Tìm phương án",
        title: "Bộ lọc Tìm phương án phù hợp",
        content:
          "Lọc chính xác theo loại xe (Xe đạp điện / Xe máy điện) và mức pin tối thiểu để chọn phương án tốt nhất.",
        placement: "top",
      },
    ],
  };
}

const tabs = [
  { to: "/student", label: "Khám phá Hub", icon: HomeIcon, end: true, tourId: "st-nav-home" },
  { to: "/student/trips", label: "Chuyến đi", icon: RouteIcon, end: false, tourId: "st-nav-trips" },
  { to: "/student/my-vehicle", label: "Xe của tôi", icon: BikeIcon, end: false, tourId: "st-nav-vehicle" },
  { to: "/student/settings", label: "Cài đặt", icon: SettingsIcon, end: false, tourId: "st-nav-settings" },
];

function initialsOf(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1]?.charAt(0).toUpperCase() || "U";
}

export function StudentLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const currentTour = getStudentPageTour(location.pathname);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    setTourOpen(!hasSeenTour(currentTour.storageKey));
  }, [currentTour.storageKey]);

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      {/* Máy tính: thanh menu ngang nổi tinh gọn */}
      <header className="sticky top-0 z-30 hidden border-b border-neutral-200/80 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-panel-dark/90 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <NavLink to="/student" className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 rounded-xl shadow-xs" />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">Smart E-Mobility</p>
              <p className="text-[11px] font-medium text-emerald-700 dark:text-lime">Khu đô thị ĐHQG-HCM</p>
            </div>
          </NavLink>

          <nav aria-label="Điều hướng chính" className="flex items-center gap-1 rounded-full bg-surface p-1 dark:bg-white/5">
            {tabs.map(({ to, label, icon: Icon, end, tourId }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                data-tour={tourId}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand text-lime shadow-xs dark:bg-lime dark:text-brand-dark"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {user && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTourOpen(true)}
                className="cursor-pointer rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:border-white/15 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                ? {currentTour.buttonLabel}
              </button>
              <div className="text-right leading-tight">
                <p className="text-xs font-semibold">{user.fullName}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Sinh viên ĐHQG</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-lime dark:bg-lime dark:text-brand-dark">
                {initialsOf(user.fullName)}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex min-h-screen max-w-md flex-col sm:border-x sm:border-neutral-200 sm:dark:border-white/5 md:min-h-0 md:max-w-6xl md:border-x-0">
        <main className="flex-1 px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-6">
          <Outlet />
        </main>
      </div>

      {/* Điện thoại: nút nhỏ mở lại hướng dẫn trang hiện tại */}
      <button
        type="button"
        onClick={() => setTourOpen(true)}
        aria-label={currentTour.buttonLabel}
        title={currentTour.buttonLabel}
        className="fixed bottom-20 right-4 z-30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-brand/20 bg-brand text-sm font-bold text-lime shadow-lg transition hover:bg-brand-light dark:border-lime/30 dark:bg-lime dark:text-brand-dark md:hidden"
      >
        ?
      </button>

      {/* Điện thoại: thanh tab dưới đáy */}
      <nav
        aria-label="Điều hướng chính"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-panel-dark/95 md:hidden"
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

      <OnboardingTour
        storageKey={currentTour.storageKey}
        steps={currentTour.steps}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </div>
  );
}
