/**
 * Gọi API khi component mở, kèm trạng thái loading/error.
 *
 *   const { data, loading, error, reload } = useAsync(() => hubApi.list(), []);
 *
 * Tự tải lại định kỳ (dùng cho trang cần số liệu mới, ví dụ giám sát Hub – NFR cập nhật trong 3 giây):
 *
 *   const { data, lastLoadedAt } = useAsync(() => hubApi.list(), [], { refreshEveryMs: 3000 });
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, options: { refreshEveryMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
      setLastLoadedAt(new Date());
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    if (!options.refreshEveryMs) return;
    const timer = setInterval(() => void load(false), options.refreshEveryMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, options.refreshEveryMs]);

  return { data, loading, error, lastLoadedAt, reload: () => load(true) };
}
