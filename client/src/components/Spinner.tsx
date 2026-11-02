export function Spinner({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-neutral-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent dark:border-lime dark:border-t-transparent" />
      {label}
    </div>
  );
}
