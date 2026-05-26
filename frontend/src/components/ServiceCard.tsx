import { useState } from "react";
import type { Action, ServiceStatus } from "../lib/types";
import { doAction } from "../lib/api";

interface Props {
  svc: ServiceStatus;
  onSelect: (name: string) => void;
  onChange: () => void;          // ask parent to refresh statuses
}

const STATE_COLORS: Record<string, string> = {
  active: "bg-ok/20 text-ok border-ok/40",
  activating: "bg-warn/20 text-warn border-warn/40",
  reloading: "bg-warn/20 text-warn border-warn/40",
  deactivating: "bg-warn/20 text-warn border-warn/40",
  inactive: "bg-idle/20 text-zinc-400 border-idle/30",
  failed: "bg-err/20 text-err border-err/40",
};

function badge(state: string): string {
  return STATE_COLORS[state] ?? "bg-ink-600 text-zinc-300 border-ink-500";
}

function relTime(iso: string): string {
  if (!iso) return "—";
  // systemd gives "Wed 2026-05-21 09:13:02 UTC" form
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const ms = Date.now() - d.getTime();
  if (ms < 0) return iso;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function ServiceCard({ svc, onSelect, onChange }: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fire = async (a: Action) => {
    setBusy(a);
    setErr(null);
    try {
      const r = await doAction(svc.name, a);
      if (!r.ok) setErr(r.message);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
      onChange();
    }
  };

  return (
    <div className="bg-ink-800 border border-ink-600 rounded-lg p-3 flex flex-col gap-2 hover:border-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onSelect(svc.name)}
          className="text-left flex-1 min-w-0"
        >
          <div className="font-mono text-sm text-zinc-100 truncate">{svc.name}</div>
          <div className="text-xs text-zinc-500 truncate">
            {svc.description || svc.fragment_path || "—"}
          </div>
        </button>
        <span
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${badge(svc.active_state)} whitespace-nowrap`}
          title={`${svc.active_state} / ${svc.sub_state}`}
        >
          {svc.active_state}
        </span>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-500">
        <span>
          {svc.sub_state} · {svc.unit_file_state}
        </span>
        <span>{svc.main_pid > 0 ? `pid ${svc.main_pid}` : relTime(svc.active_enter_ts)}</span>
      </div>

      <div className="flex gap-1">
        <button
          disabled={busy !== null}
          onClick={() => fire("start")}
          className="flex-1 text-xs py-1 rounded border border-ink-600 hover:border-ok hover:text-ok disabled:opacity-50"
        >
          {busy === "start" ? "…" : "start"}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => fire("stop")}
          className="flex-1 text-xs py-1 rounded border border-ink-600 hover:border-err hover:text-err disabled:opacity-50"
        >
          {busy === "stop" ? "…" : "stop"}
        </button>
        <button
          disabled={busy !== null}
          onClick={() => fire("restart")}
          className="flex-1 text-xs py-1 rounded border border-ink-600 hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {busy === "restart" ? "…" : "restart"}
        </button>
        <button
          onClick={() => onSelect(svc.name)}
          className="flex-1 text-xs py-1 rounded border border-ink-600 hover:border-accent hover:text-accent"
        >
          logs
        </button>
      </div>

      {err && <div className="text-[11px] text-err truncate" title={err}>{err}</div>}
    </div>
  );
}
