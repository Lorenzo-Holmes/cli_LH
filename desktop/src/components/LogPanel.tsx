import { Trash2 } from "lucide-react";
import type { LogLine } from "../lib/sidecar";

export function LogPanel({ logs, onClear }: { logs: LogLine[]; onClear: () => void }) {
  return (
    <section className="panel log-panel" id="logs">
      <div className="panel-heading">
        <span>Process Stream</span>
        <button onClick={onClear}><Trash2 size={15} /> Clear</button>
      </div>
      <div className="log-stream">
        {logs.length === 0 ? (
          <p className="log-empty">No sidecar output yet.</p>
        ) : (
          logs.map((line, index) => (
            <div className={`log-line log-${line.source}`} key={`${line.timestamp}-${index}`}>
              <time>{new Date(line.timestamp).toLocaleTimeString()}</time>
              <span>{line.source}</span>
              <code>{line.message}</code>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
