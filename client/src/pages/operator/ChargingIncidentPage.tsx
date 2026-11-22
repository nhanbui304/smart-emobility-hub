// Owner: Ngô Minh Triết (UC11 Handle Operational Incident), Nguyễn Hoàng Nhân (UC13 Manage Smart Charging Schedule)
import { useSearchParams } from "react-router-dom";
import { incidentApi } from "../../api/incident";
import { useAsync } from "../../hooks/useAsync";
import { IncidentManagementPanel } from "./IncidentManagementPanel";
import { SmartChargingPanel } from "./SmartChargingPanel";

type ActiveTab = "charging" | "incidents";

export function ChargingIncidentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: ActiveTab = searchParams.get("tab") === "incidents" ? "incidents" : "charging";

  const { data: incidentOverview, reload: reloadIncidentOverview } = useAsync(() => incidentApi.listOverview(), [], {
    refreshEveryMs: 10000,
  });
  const openCount = (incidentOverview?.incidents ?? []).filter((i) => i.status !== "CLOSED").length;

  const switchTab = (tab: ActiveTab) => {
    setSearchParams(tab === "incidents" ? { tab: "incidents" } : {}, { replace: true });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Lịch sạc &amp; Sự cố</h1>

        {/* Segmented Control tách hẳn 2 nghiệp vụ thay vì nhồi 2 cột chật chội */}
        <div
          role="tablist"
          aria-label="Chọn chức năng điều phối"
          className="inline-flex rounded-2xl border border-neutral-200 bg-neutral-100/90 p-1 dark:border-white/10 dark:bg-white/5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "charging"}
            onClick={() => switchTab("charging")}
            className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "charging"
                ? "bg-brand text-white shadow-sm dark:bg-lime dark:text-brand-dark"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            }`}
          >
            Lịch sạc thông minh
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "incidents"}
            onClick={() => switchTab("incidents")}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              activeTab === "incidents"
                ? "bg-brand text-white shadow-sm dark:bg-lime dark:text-brand-dark"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            }`}
          >
            <span>Xử lý sự cố</span>
            {openCount > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeTab === "incidents"
                    ? "bg-lime text-brand-dark dark:bg-brand dark:text-lime"
                    : "bg-amber-200 text-amber-900 dark:bg-amber-400/25 dark:text-amber-200"
                }`}
              >
                {openCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {activeTab === "charging" ? (
        <SmartChargingPanel />
      ) : (
        <IncidentManagementPanel onChanged={() => void reloadIncidentOverview()} />
      )}
    </div>
  );
}
