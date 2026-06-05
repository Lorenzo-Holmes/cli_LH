import { Gauge, ShieldCheck, TimerReset } from "lucide-react";
import type { ReactNode } from "react";
import type { ProbeResult } from "../lib/status";

export function StatusPanel({ probe }: { probe?: ProbeResult }) {
  const status = probe?.status;
  return (
    <section className="panel status-panel">
      <div className="panel-heading">
        <span>Telemetry</span>
        <strong>{probe ? `${probe.latencyMs}ms` : "not checked"}</strong>
      </div>
      <div className="status-grid">
        <Metric icon={<Gauge />} label="Core" value={status?.status ?? "offline"} />
        <Metric icon={<TimerReset />} label="Checked" value={probe?.checkedAt ? new Date(probe.checkedAt).toLocaleTimeString() : "never"} />
        <Metric icon={<ShieldCheck />} label="Service" value={status?.service ?? "cli_LH"} />
      </div>
      {probe?.error && <div className="inline-error">{probe.error}</div>}
      <div className="metadata-grid">
        <span>Host</span><strong>{status?.server?.host ?? "-"}</strong>
        <span>Port</span><strong>{status?.server?.port ?? "-"}</strong>
        <span>Config</span><strong title={status?.server?.configPath}>{status?.server?.configPath ?? "-"}</strong>
        <span>Auth dir</span><strong title={status?.server?.authDir}>{status?.server?.authDir ?? "-"}</strong>
        <span>Gemini keys</span><strong>{status?.providers?.geminiApiKeys ?? 0}</strong>
        <span>Codex keys</span><strong>{status?.providers?.codexApiKeys ?? 0}</strong>
        <span>Claude keys</span><strong>{status?.providers?.claudeApiKeys ?? 0}</strong>
        <span>OpenAI compat</span><strong>{status?.providers?.openaiCompatibilityEntries ?? 0}</strong>
        <span>Management API</span><strong>{yesNo(status?.management?.available)}</strong>
        <span>Control panel</span><strong>{yesNo(status?.management?.controlPanelEnabled)}</strong>
        <span>Usage stats</span><strong>{yesNo(status?.management?.usageStatisticsEnabled)}</strong>
        <span>Request log</span><strong>{yesNo(status?.management?.requestLogEnabled)}</strong>
        <span>WebSocket auth</span><strong>{yesNo(status?.management?.websocketAuthEnabled)}</strong>
        <span>TLS</span><strong>{yesNo(status?.management?.tlsEnabled)}</strong>
      </div>
    </section>
  );
}

function yesNo(value?: boolean) {
  if (value === undefined) return "-";
  return value ? "Yes" : "No";
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
