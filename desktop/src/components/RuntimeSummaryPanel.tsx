import { ServerCog } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function RuntimeSummaryPanel({ probe }: { probe?: ProbeResult }) {
  const status = probe?.status;
  const server = status?.server;
  const runtime = status?.runtime;

  return (
    <section className="panel runtime-panel">
      <div className="panel-heading">
        <span>Runtime</span>
        <strong>{server?.port ? `:${server.port}` : "unknown"}</strong>
      </div>
      <div className="summary-card hero-summary">
        <ServerCog />
        <div>
          <strong>{server?.host || server?.port ? "Go sidecar endpoint detected" : "Waiting for sidecar status"}</strong>
          <p>These paths and flags describe where the local engine is running.</p>
        </div>
      </div>
      <div className="metadata-grid runtime-grid">
        <span>Host</span><strong>{server?.host || "all interfaces"}</strong>
        <span>Port</span><strong>{server?.port ?? "-"}</strong>
        <span>Config</span><strong title={server?.configPath}>{server?.configPath ?? "-"}</strong>
        <span>Auth dir</span><strong title={server?.authDir}>{server?.authDir ?? "-"}</strong>
        <span>TUI mode</span><strong>{enabledText(runtime?.tuiMode)}</strong>
        <span>Standalone</span><strong>{enabledText(runtime?.standalone)}</strong>
        <span>Local model</span><strong>{enabledText(runtime?.localModel)}</strong>
      </div>
    </section>
  );
}

function enabledText(value?: boolean) {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}