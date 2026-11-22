// Hướng dẫn tương tác lần đầu (kiểu Intro.js) — thuần React + Tailwind, không thêm dependency,
// hỗ trợ spotlight ôm phần tử [data-tour="..."], điều hướng bàn phím, Light/Dark mode và lưu localStorage.
import { useCallback, useEffect, useState } from "react";

export interface TourStep {
  /** CSS selector tới phần tử cần highlight (vd: '[data-tour="op-map"]'). Bỏ trống để hiện thẻ chào ở giữa màn hình. */
  target?: string;
  /** Nhãn Use Case liên quan (vd: "UC10 · Giám sát") */
  ucTag?: string;
  title: string;
  content: string;
  placement?: "bottom" | "top" | "right" | "left";
}

interface OnboardingTourProps {
  storageKey: string;
  steps: TourStep[];
  /** Cho phép mở lại tour từ nút "Hướng dẫn" bên ngoài */
  open: boolean;
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export function OnboardingTour({ storageKey, steps, open, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    setStepIndex(0);
  }, [storageKey, open]);

  const step = steps[stepIndex];

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore storage quota/privacy mode errors
    }
    setStepIndex(0);
    onClose();
  }, [onClose, storageKey]);

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [finish, stepIndex, steps.length]);

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Đo vị trí phần tử mục tiêu mỗi khi đổi bước hoặc resize/scroll
  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (!open || !step?.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setTargetRect(null);
      return;
    }
    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [open, step?.target]);

  useEffect(() => {
    if (!open) return;
    if (step?.target) {
      const el = document.querySelector<HTMLElement>(step.target);
      el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
    const timer = window.setTimeout(measure, 180);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step?.target, measure]);

  // Hỗ trợ phím tắt: Esc (đóng), mũi tên phải (tiếp), mũi tên trái (lùi)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, finish, next, prev]);

  if (!open || !step) return null;

  // Tính vị trí popover thông minh không tràn viền màn hình
  const cardWidth = Math.min(360, viewport.w - 32);
  const estimatedHeight = 220;
  let cardStyle: React.CSSProperties;

  if (!targetRect) {
    cardStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: cardWidth,
    };
  } else {
    const pref = step.placement ?? "bottom";
    let top = targetRect.top + targetRect.height + 16;
    let left = targetRect.left;

    if (pref === "right" && targetRect.left + targetRect.width + cardWidth + 24 < viewport.w) {
      left = targetRect.left + targetRect.width + 18;
      top = targetRect.top;
    } else if (pref === "left" && targetRect.left - cardWidth - 24 > 0) {
      left = targetRect.left - cardWidth - 18;
      top = targetRect.top;
    } else if (pref === "top" || targetRect.top + targetRect.height + estimatedHeight + 24 > viewport.h) {
      top = Math.max(16, targetRect.top - estimatedHeight - 16);
    }

    left = Math.max(16, Math.min(left, viewport.w - cardWidth - 16));
    top = Math.max(16, Math.min(top, viewport.h - estimatedHeight - 16));

    cardStyle = { top, left, width: cardWidth };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Hướng dẫn bước ${stepIndex + 1}: ${step.title}`}
      className="fixed inset-0 z-[1000]"
    >
      {/* Lớp phủ tối (click ra ngoài để bỏ qua) */}
      {!targetRect ? (
        <div
          onClick={finish}
          className="fixed inset-0 bg-neutral-950/65 backdrop-blur-[1px] transition-opacity"
        />
      ) : (
        <>
          <div onClick={finish} className="fixed inset-0" />
          {/* Khung spotlight đục lỗ sáng bằng box-shadow lớn quanh phần tử mục tiêu */}
          <div
            style={{
              top: Math.max(4, targetRect.top - PAD),
              left: Math.max(4, targetRect.left - PAD),
              width: targetRect.width + PAD * 2,
              height: targetRect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(8, 18, 14, 0.68)",
            }}
            className="pointer-events-none fixed rounded-2xl ring-2 ring-lime transition-all duration-200"
          />
        </>
      )}

      {/* Thẻ Tooltip hướng dẫn */}
      <div
        style={cardStyle}
        className="fixed z-[1001] rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-2xl transition-all duration-200 dark:border-white/15 dark:bg-[#121e19] dark:text-neutral-100"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {step.ucTag && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-lime/20 dark:text-lime">
                {step.ucTag}
              </span>
            )}
            <span className="text-[11px] font-semibold tabular-nums text-neutral-400">
              {stepIndex + 1} / {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={finish}
            className="cursor-pointer rounded-lg px-2 py-0.5 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Đóng hướng dẫn"
          >
            ✕
          </button>
        </div>

        <h3 className="mt-2.5 text-base font-bold leading-snug">{step.title}</h3>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          {step.content}
        </p>

        {/* Thanh tiến trình chấm tròn */}
        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStepIndex(idx)}
              aria-label={`Chuyển tới bước ${idx + 1}`}
              className={`h-1.5 cursor-pointer rounded-full transition-all ${
                idx === stepIndex
                  ? "w-6 bg-brand dark:bg-lime"
                  : "w-1.5 bg-neutral-200 hover:bg-neutral-300 dark:bg-white/15"
              }`}
            />
          ))}
        </div>

        {/* Nút điều hướng */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={finish}
            className="cursor-pointer text-xs font-medium text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Bỏ qua
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={prev}
                className="cursor-pointer rounded-xl border border-neutral-200 px-3 py-1.5 text-xs font-semibold transition hover:bg-neutral-50 dark:border-white/15 dark:hover:bg-white/5"
              >
                Quay lại
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="cursor-pointer rounded-xl bg-brand px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-light dark:bg-lime dark:text-brand-dark"
            >
              {stepIndex === steps.length - 1 ? "Bắt đầu dùng" : "Tiếp theo →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kiểm tra xem người dùng đã từng xem tour chưa */
export function hasSeenTour(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}
