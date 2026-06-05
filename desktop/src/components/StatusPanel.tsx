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
    </section>
  );
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
