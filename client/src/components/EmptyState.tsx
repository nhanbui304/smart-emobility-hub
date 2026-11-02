import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl2 border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
