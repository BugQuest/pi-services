import { useCallback, useEffect, useState } from "react";
import type { ServiceStatus } from "./lib/types";
import { listAll, listCurated } from "./lib/api";
import { ServiceList } from "./components/ServiceList";
import { LogViewer } from "./components/LogViewer";

type Tab = "custom" | "all";

const REFRESH_MS = 4000;

export default function App() {
  const [tab, setTab] = useState<Tab>("custom");
  const [curated, setCurated] = useState<ServiceStatus[]>([]);
  const [all, setAll] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      if (tab === "custom") {
        const data = await listCurated();
        setCurated(data);
      } else {
        const data = await listAll();
        setAll(data);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  // Initial + tab change.
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Polling.
  useEffect(() => {
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-ink-700 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-accent font-mono text-sm font-semibold tracking-wider">
            ▣ pi-services
          </div>
          <div className="text-xs text-zinc-500">systemd dashboard</div>
        </div>
        <nav className="flex items-center gap-1">
          {(["custom", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded border ${
                tab === t
                  ? "border-accent text-accent bg-accent/10"
                  : "border-ink-600 text-zinc-400 hover:border-accent hover:text-accent"
              }`}
            >
              {t === "custom" ? "Custom" : "All units"}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-4 overflow-hidden">
        <ServiceList
          services={tab === "custom" ? curated : all}
          loading={loading}
          error={error}
          onSelect={(name) => setSelected(name)}
          onChange={refresh}
          showFilter={tab === "all"}
          emptyHint={
            tab === "custom"
              ? "Drop a symlink into /etc/pi-services/enabled/ to track a service here."
              : "No service units."
          }
        />
      </main>

      {selected && <LogViewer name={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
