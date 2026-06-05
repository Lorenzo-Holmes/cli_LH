import { ShieldCheck } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function ManagementSummaryPanel({ probe }: { probe?: ProbeResult }) {
  const management = probe?.status?.management;
  const available = management?.available === true;

  const items = [
    { label: "Management API", value: enabledText(management?.available) },
    { label: "Local password", value: enabledText(management?.localPasswordAvailable) },
    { label: "Remote access", value: enabledText(management?.remoteManagementAllowed) },
    { label: "Control panel", value: enabledText(management?.controlPanelEnabled) },
    { label: "Panel auto-update", value: enabledText(management?.autoUpdatePanelEnabled) },
    { label: "Usage stats", value: enabledText(management?.usageStatisticsEnabled) },
    { label: "Request log", value: enabledText(management?.requestLogEnabled) },
    { label: "File logging", value: enabledText(management?.loggingToFileEnabled) },
    { label: "WebSocket auth", value: enabledText(management?.websocketAuthEnabled) },
    { label: "TLS", value: enabledText(management?.tlsEnabled) },
  ];

  return (
    <section className="panel summary-panel">
      <div className="panel-heading">
        <span>Management</span>
        <strong>{available ? "available" : "locked"}</strong>
      </div>
      <div className={`summary-card ${available ? "summary-ok" : "summary-muted"}`}>
        <ShieldCheck />
        <div>
          <strong>{available ? "Local control is configured" : "Management key not configured"}</strong>
          <p>Only safe booleans are shown. Passwords and management keys stay hidden.</p>
        </div>
      </div>
      <div className="metadata-grid compact">
        {items.map((item) => (
          <FragmentRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  );
}

function enabledText(value?: boolean) {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
}