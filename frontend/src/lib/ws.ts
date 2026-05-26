type Listener = (line: string) => void;

export class LogStream {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private errorListeners = new Set<(msg: string) => void>();
  private closed = false;

  constructor(private name: string) {}

  connect(): void {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/services/${encodeURIComponent(this.name)}/logs`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "line") {
          for (const cb of this.listeners) cb(data.line as string);
        } else if (data.type === "error") {
          for (const cb of this.errorListeners) cb(String(data.message ?? "error"));
        }
      } catch {
        /* ignore non-JSON frames */
      }
    };
    ws.onclose = () => {
      if (!this.closed) {
        setTimeout(() => this.connect(), 1500);
      }
    };
    ws.onerror = () => {
      /* close handler reconnects */
    };
  }

  onLine(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onError(cb: (msg: string) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}
