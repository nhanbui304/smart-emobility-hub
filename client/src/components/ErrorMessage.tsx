import { ApiError } from "../api/client";

/** Hiển thị lỗi API thân thiện. Lỗi NOT_IMPLEMENTED hiển thị nhẹ nhàng hơn. */
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  const apiErr = error instanceof ApiError ? error : null;
  const notImpl = apiErr?.code === "NOT_IMPLEMENTED";
  const message = apiErr?.message ?? (error instanceof Error ? error.message : "Đã có lỗi xảy ra.");

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
        notImpl
          ? "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
          : "bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300"
      }`}
    >
      <div>
        <p className="font-semibold">{notImpl ? "Chức năng đang được hiện thực" : "Không thực hiện được"}</p>
        <p className="mt-0.5 opacity-90">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Thử lại
        </button>
      )}
    </div>
  );
}
