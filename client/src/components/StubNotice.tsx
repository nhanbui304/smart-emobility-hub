/** Khung ghi chú cho trang chưa hiện thực: ai phụ trách, UC nào, cần làm gì. */
export function StubNotice({ owner, useCases, todo }: { owner: string; useCases: string; todo: string[] }) {
  return (
    <div className="rounded-xl2 border border-dashed border-amber-400/70 bg-amber-50/60 p-4 text-sm dark:border-amber-400/30 dark:bg-amber-500/5">
      <p className="font-semibold text-amber-900 dark:text-amber-200">
        TODO · {owner} · {useCases}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90 dark:text-amber-100/80">
        {todo.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
