import { useMemo, useState } from "react";
import type { ServiceStatus } from "../lib/types";
import { ServiceCard } from "./ServiceCard";

interface Props {
  services: ServiceStatus[];
  loading: boolean;
  error: string | null;
  onSelect: (name: string) => void;
  onChange: () => void;
  showFilter: boolean;
  emptyHint?: string;
}

export function ServiceList({
  services,
  loading,
  error,
  onSelect,
  onChange,
  showFilter,
  emptyHint,
}: Props) {
  const [filter, setFilter] = useState("");
  const [hideInactive, setHideInactive] = useState(false);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return services.filter((s) => {
      if (hideInactive && s.active_state === "inactive") return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [services, filter, hideInactive]);

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      {showFilter && (
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or description…"
            className="flex-1 bg-ink-800 border border-ink-600 focus:border-accent rounded px-2 py-1.5 text-sm outline-none"
          />
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={hideInactive}
              onChange={(e) => setHideInactive(e.target.checked)}
              className="accent-accent"
            />
            hide inactive
          </label>
          <span className="text-xs text-zinc-500">
            {visible.length}/{services.length}
          </span>
        </div>
      )}

      {error && (
        <div className="bg-err/10 border border-err/40 text-err text-sm px-3 py-2 rounded">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto -mr-2 pr-2">
        {loading && services.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-8">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-8">
            {emptyHint ?? "No services."}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <ServiceCard
                key={s.name}
                svc={s}
                onSelect={onSelect}
                onChange={onChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
