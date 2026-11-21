// Owner: Bùi Quang Nhân – khung giao diện Operator (desktop, sidebar trái)
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BoltIcon, ChartIcon, GridIcon, LogoMark, LogoutIcon, TruckIcon } from "../components/Icons";
import { OnboardingTour, hasSeenTour, type TourStep } from "../components/OnboardingTour";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

interface PageTourConfig {
  storageKey: string;
  buttonLabel: string;
  steps: TourStep[];
}

function getOperatorPageTour(pathname: string, search: string): PageTourConfig {
  if (pathname.startsWith("/operator/charging-incidents")) {
    const isIncidents = new URLSearchParams(search).get("tab") === "incidents";
    if (isIncidents) {
      return {
        storageKey: "emobility_tour_op_incidents_v1",
        buttonLabel: "Hướng dẫn Xử lý sự cố",
        steps: [
          {
            ucTag: "UC11 · Xử lý sự cố",
            title: "Cách dùng trang Xử lý sự cố",
            content:
              "Trang này dùng để báo hỏng cổng sạc/chỗ đỗ/xe (khóa đặt mới), lập phương án xử lý và khôi phục tài nguyên sau khi sửa xong.",
          },
          {
            target: '[data-tour="uc11-create"]',
            ucTag: "UC11 · Bước 1",
            title: "Ghi nhận sự cố mới",
            content:
              "Khi phát hiện xe, chỗ đỗ hoặc cổng sạc lỗi, bấm nút này để chọn tài nguyên, mức độ ảnh hưởng và tự động khóa phân bổ mới.",
            placement: "right",
          },
          {
            target: '[data-tour="uc11-list"]',
            ucTag: "UC11 · Danh sách",
            title: "Chọn sự cố cần xử lý",
            content:
              "Lọc nhanh giữa sự cố Đang mở và Đã đóng, sau đó bấm vào một sự cố bất kỳ để mở khung xử lý chi tiết bên phải.",
            placement: "right",
          },
          {
            target: '[data-tour="uc11-detail"]',
            ucTag: "UC11 · Bước 2 & 3",
            title: "Lưu phương án → Xác minh & Đóng sự cố",
            content:
              "Ở khung bên phải: chọn phương án xử lý và bấm Lưu; khi kỹ thuật sửa xong thì nhập minh chứng, tích Đã khắc phục và bấm Đóng sự cố để mở lại tài nguyên.",
            placement: "left",
          },
        ],
      };
    }

    return {
      storageKey: "emobility_tour_op_charging_v1",
      buttonLabel: "Hướng dẫn Lịch sạc",
      steps: [
        {
          ucTag: "UC13 · Lịch sạc thông minh",
          title: "Cách dùng Lịch sạc thông minh (3 bước)",
          content:
            "Chức năng này tự động phân bổ cổng sạc & công suất kW cho xe tại Hub theo giới hạn điện lưới và thứ tự ưu tiên.",
        },
        {
          target: '[data-tour="uc13-hub-time"]',
          ucTag: "UC13 · Bước 1",
          title: "Chọn Hub & Khung giờ điều phối",
          content:
            "Chọn Mobility Hub cần chia lịch sạc, rồi bấm nhanh chip 2 giờ tới / Cao điểm 17h (hoặc chọn Tùy chỉnh để nhập giờ cụ thể).",
          placement: "right",
        },
        {
          target: '[data-tour="uc13-rules"]',
          ucTag: "UC13 · Bước 2",
          title: "Chọn quy tắc ưu tiên & Tạo đề xuất",
          content:
            "Chọn ưu tiên xe pin thấp (<25%), đến trước sạc trước (FIFO) hoặc thiếu pin nhiều nhất — rồi bấm nút Tạo đề xuất lịch sạc.",
          placement: "right",
        },
        {
          target: '[data-tour="uc13-result"]',
          ucTag: "UC13 · Bước 3",
          title: "Kiểm tra tải điện kW & Áp dụng lịch",
          content:
            "Xem thanh tải điện tổng so với giới hạn Hub (có thể chỉnh tay số kW từng dòng), bấm Kiểm tra hợp lệ rồi bấm Áp dụng lịch sạc để lưu.",
          placement: "left",
        },
      ],
    };
  }

  if (pathname.startsWith("/operator/simulation")) {
    return {
      storageKey: "emobility_tour_op_simulation_v1",
      buttonLabel: "Hướng dẫn What-if",
      steps: [
        {
          ucTag: "UC14 · Mô phỏng What-if",
          title: "Mô phỏng thử nghiệm — Không sửa dữ liệu thật",
          content:
            "Công cụ này chụp một bản sao độc lập của mạng lưới để bạn thử các kịch bản biến động trước khi quyết định điều phối thật.",
        },
        {
          target: '[data-tour="uc14-scenarios"]',
          ucTag: "UC14 · Bước 1",
          title: "Chọn 1 trong 4 kịch bản giả định",
          content:
            "Chọn Tăng nhu cầu giờ cao điểm, Đóng 1 Hub, Thêm cổng sạc hoặc Thêm xe điện — rồi chọn Hub muốn áp dụng giả định.",
          placement: "right",
        },
        {
          target: '[data-tour="uc14-run"]',
          ucTag: "UC14 · Bước 2",
          title: "Kéo thanh tham số & Chạy mô phỏng",
          content:
            "Kéo thanh trượt để chọn mức tăng (vd 2.0x nhu cầu, +2 cổng sạc...), sau đó bấm Chạy mô phỏng ngay (hệ thống tự tạo bản chụp nếu chưa có).",
          placement: "right",
        },
        {
          target: '[data-tour="uc14-results"]',
          ucTag: "UC14 · Bước 3",
          title: "Đọc kết quả Trước/Sau & Áp dụng đề xuất",
          content:
            "So sánh 3 chỉ số (Xe thiếu hụt, Chờ TB, Hub quá tải) giữa hiện tại và kịch bản. Bấm Áp dụng → trên thẻ đề xuất để nhảy thẳng sang UC12 hoặc UC13.",
          placement: "left",
        },
      ],
    };
  }

  if (pathname.startsWith("/operator/redistribution")) {
    return {
      storageKey: "emobility_tour_op_redistribution_v1",
      buttonLabel: "Hướng dẫn Điều chuyển",
      steps: [
        {
          ucTag: "UC12 · Điều chuyển xe",
          title: "Cân bằng đội xe giữa các Mobility Hub",
          content:
            "Chức năng này chuyển xe từ Hub dư sang Hub thiếu và giữ trước sức chứa tiếp nhận tại Hub đích.",
        },
        {
          target: '[data-tour="uc12-scope"]',
          ucTag: "UC12 · Bước 1 & 2",
          title: "Chọn Hub nguồn, Hub đích & Xem phương án",
          content:
            "Chọn Hub nguồn, Hub đích và giờ dự kiến tiếp nhận (ETA), bấm Xem phương án để kiểm tra sức chứa rồi tích chọn các xe cần chuyển.",
          placement: "bottom",
        },
        {
          target: '[data-tour="uc12-orders"]',
          ucTag: "UC12 · Bước 3",
          title: "Theo dõi xuất phát, tiếp nhận & Đóng lệnh",
          content:
            "Sau khi tạo lệnh, lần lượt bấm Đã rời Hub nguồn → Đã tới Hub đích cho từng xe, rồi bấm Đóng lệnh (hoặc hủy các xe chưa xuất phát).",
          placement: "top",
        },
      ],
    };
  }

  return {
    storageKey: "emobility_tour_op_monitoring_v1",
    buttonLabel: "Hướng dẫn Giám sát",
    steps: [
      {
        ucTag: "UC10 · Giám sát mạng lưới",
        title: "Theo dõi toàn mạng lưới 5 Hub thời gian thực",
        content:
          "Trang này tự cập nhật mỗi 3 giây để phát hiện sớm Hub thiếu xe, sắp đầy hoặc có thiết bị lỗi.",
      },
      {
        target: '[data-tour="op-kpi"]',
        ucTag: "UC10 · Chỉ số KPI",
        title: "4 chỉ số tổng quan toàn mạng lưới",
        content:
          "Xem nhanh tổng xe sẵn sàng, chỗ đỗ trống, cổng sạc rảnh và số cảnh báo đang mở. Thẻ Cảnh báo sẽ đổi màu vàng khi có bất thường.",
        placement: "bottom",
      },
      {
        target: '[data-tour="op-map"]',
        ucTag: "UC10 · Bản đồ sự cố",
        title: "Bấm pin màu vàng trên bản đồ để xem sự cố",
        content:
          "Hub nào có cảnh báo sẽ hiện pin màu vàng. Bấm trực tiếp vào pin đó để xem chi tiết lỗi ngay ở khung bên phải.",
        placement: "bottom",
      },
      {
        target: '[data-tour="op-inspector"]',
        ucTag: "UC10 · Xem nhanh",
        title: "Xem nhanh cảnh báo & Chuyển xử lý 1 chạm",
        content:
          "Khung này hiện cảnh báo, sự cố đang mở và xe bảo trì của Hub vừa bấm — kèm nút nhảy thẳng sang Xử lý sự cố (UC11) hoặc Điều chuyển xe (UC12).",
        placement: "left",
      },
    ],
  };
}

const items = [
  { to: "/operator/monitoring", label: "Giám sát mạng lưới", icon: GridIcon, tourId: "op-nav-monitoring" },
  { to: "/operator/charging-incidents", label: "Lịch sạc và sự cố", icon: BoltIcon, tourId: "op-nav-charging" },
  { to: "/operator/simulation", label: "Mô phỏng What-if", icon: ChartIcon, tourId: "op-nav-simulation" },
];

export function OperatorLayout() {
  const { user, logout } = useAuth();
  const { resolved, setPreference } = useTheme();
  const location = useLocation();
  const currentTour = getOperatorPageTour(location.pathname, location.search);
  const [tourOpen, setTourOpen] = useState(false);

  // Tự mở đúng hướng dẫn của từng trang/tab ngay lần đầu Operator truy cập (chỉ trên desktop >= 768px)
  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    setTourOpen(isDesktop && !hasSeenTour(currentTour.storageKey));
  }, [currentTour.storageKey]);

  return (
    <>
      {/* Điện thoại (< 768px): thông báo rõ bảng điều phối Operator chỉ dành cho máy tính */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-10 text-center dark:bg-surface-dark md:hidden">
        <div className="w-full max-w-sm space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-panel-dark">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand">
            <LogoMark className="h-8 w-8" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold">Bảng điều phối chỉ hỗ trợ máy tính</h1>
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Giao diện <strong>Operator</strong> (bản đồ giám sát, lịch sạc, xử lý sự cố và mô phỏng What-if) được thiết kế cho màn hình máy tính. Trên điện thoại, vui lòng dùng tài khoản <strong>Sinh viên</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-lime transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark"
          >
            <LogoutIcon className="h-4 w-4" /> Đăng xuất để đổi tài khoản
          </button>
        </div>
      </div>

      {/* Máy tính (>= 768px): giao diện điều phối đầy đủ */}
      <div className="hidden min-h-screen md:flex">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-brand text-white">
        <div className="flex items-center gap-3 px-5 py-6">
          <LogoMark className="h-9 w-9 rounded-lg ring-1 ring-white/10" />
          <div className="leading-tight">
            <p className="text-sm font-bold">Smart E-Mobility</p>
            <p className="text-xs text-white/60">Bảng điều phối</p>
          </div>
        </div>

        <nav aria-label="Điều hướng Operator" className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon, tourId }) => (
            <NavLink
              key={to}
              to={to}
              data-tour={tourId}
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
            data-tour="op-nav-redistribution"
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

        <div className="space-y-2.5 border-t border-white/10 p-4 text-sm">
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-lime/30 bg-lime/10 px-2.5 py-1.5 text-xs font-semibold text-lime transition hover:bg-lime/20"
          >
            <span>?</span> {currentTour.buttonLabel}
          </button>
          <div>
            <p className="font-semibold">{user?.fullName}</p>
            <p className="truncate text-xs text-white/60">{user?.email}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void setPreference(resolved === "DARK" ? "LIGHT" : "DARK")}
              className="flex-1 cursor-pointer rounded-lg bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"
            >
              {resolved === "DARK" ? "Giao diện sáng" : "Giao diện tối"}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex cursor-pointer items-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-xs hover:bg-white/20"
            >
              <LogoutIcon className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8">
        <Outlet />
      </main>

      <OnboardingTour
        storageKey={currentTour.storageKey}
        steps={currentTour.steps}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
      />
      </div>
    </>
  );
}
