import { Download, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { LogLine } from "../lib/sidecar";

export function LogPanel({ logs, onClear, onExport }: { logs: LogLine[]; onClear: () => void; onExport: (logs: LogLine[]) => void }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | LogLine["source"]>("all");
  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((line) => {
      const sourceMatches = source === "all" || line.source === source;
      const queryMatches = needle === "" || line.message.toLowerCase().includes(needle) || line.source.includes(needle);
      return sourceMatches && queryMatches;
    });
  }, [logs, query, source]);

  return (
    <section className="panel log-panel" id="logs">
      <div className="panel-heading">
        <span>Process Stream</span>
        <div className="panel-actions">
          <button onClick={() => onExport(filteredLogs)}><Download size={15} /> Export</button>
          <button onClick={onClear}><Trash2 size={15} /> Clear</button>
        </div>
      </div>
      <div className="log-toolbar">
        <label className="log-search">
          <Search size={15} />
          <input value={query} placeholder="Search logs" onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select value={source} onChange={(event) => setSource(event.target.value as "all" | LogLine["source"])}>
          <option value="all">All sources</option>
          <option value="stdout">stdout</option>
          <option value="stderr">stderr</option>
          <option value="system">system</option>
        </select>
      </div>
      <div className="log-stream">
        {filteredLogs.length === 0 ? (
          <p className="log-empty">No sidecar output yet.</p>
        ) : (
          filteredLogs.map((line, index) => (
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
