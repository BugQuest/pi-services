import { useEffect, useRef, useState } from "react";
import { getHistory } from "../lib/api";
import { LogStream } from "../lib/ws";

interface Props {
  name: string;
  onClose: () => void;
}

const HISTORY_LIMIT = 500;
const BUFFER_LIMIT = 2000;

export function LogViewer({ name, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Load history once on open.
  useEffect(() => {
    let alive = true;
    setHistoryLoading(true);
    setError(null);
    getHistory(name, HISTORY_LIMIT)
      .then((hist) => {
        if (!alive) return;
        setLines(hist);
      })
      .catch((e) => {
        if (alive) setError(String(e));
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [name]);

  // Live tail.
  useEffect(() => {
    const stream = new LogStream(name);
    const offLine = stream.onLine((line) => {
      if (pausedRef.current) return;
      setLines((prev) => {
        const next = [...prev, line];
        if (next.length > BUFFER_LIMIT) next.splice(0, next.length - BUFFER_LIMIT);
        return next;
      });
    });
    const offErr = stream.onError((msg) => setError(msg));
    stream.connect();
    return () => {
      offLine();
      offErr();
      stream.close();
    };
  }, [name]);

  // Auto-scroll to bottom whenever new lines arrive (and user hasn't disabled).
  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  // Detect manual scroll-up → disable auto-scroll.
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    setAutoScroll(atBottom);
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-ink-800 border border-ink-600 rounded-lg w-full max-w-5xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-ink-600">
          <div className="flex items-center gap-3 min-w-0">
            <div className="font-mono text-sm truncate">{name}</div>
            {historyLoading && <span className="text-xs text-zinc-500">loading history…</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaused((v) => !v)}
              className={`text-xs px-2 py-1 rounded border ${paused ? "border-warn text-warn" : "border-ink-600 text-zinc-400 hover:border-accent hover:text-accent"}`}
            >
              {paused ? "▶ resume" : "⏸ pause"}
            </button>
            <button
              onClick={() => setLines([])}
              className="text-xs px-2 py-1 rounded border border-ink-600 text-zinc-400 hover:border-accent hover:text-accent"
            >
              clear
            </button>
            <button
              onClick={() => setAutoScroll(true)}
              disabled={autoScroll}
              className="text-xs px-2 py-1 rounded border border-ink-600 text-zinc-400 hover:border-accent hover:text-accent disabled:opacity-40"
            >
              ↓ tail
            </button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1 rounded border border-ink-600 text-zinc-400 hover:border-err hover:text-err"
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-err/10 border-b border-err/40 text-err text-xs px-4 py-1.5">
            {error}
          </div>
        )}

        <div
          ref={containerRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed px-3 py-2 text-zinc-300 whitespace-pre"
        >
          {lines.length === 0 && !historyLoading ? (
            <div className="text-zinc-500">No log entries.</div>
          ) : (
            lines.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>

        <div className="px-4 py-1.5 border-t border-ink-600 text-[11px] text-zinc-500 flex justify-between">
          <span>{lines.length} line{lines.length === 1 ? "" : "s"}</span>
          <span>{autoScroll ? "auto-scrolling" : "scroll paused"}</span>
        </div>
      </div>
    </div>
  );
}
