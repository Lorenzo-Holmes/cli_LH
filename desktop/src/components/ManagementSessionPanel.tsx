import { Lock, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Fragment } from "react";
import type { ManagementSessionState, ManagementSummary } from "../lib/management";
import type { ProbeResult } from "../lib/status";

type ManagementSessionPanelProps = {
  keyValue: string;
  sessionState: ManagementSessionState;
  summary?: ManagementSummary;
  error?: string;
  probe?: ProbeResult;
  onKeyChange: (value: string) => void;
  onVerify: () => void;
  onLogout: () => void;
};

export function ManagementSessionPanel({
  keyValue,
  sessionState,
  summary,
  error,
  probe,
  onKeyChange,
  onVerify,
  onLogout,
}: ManagementSessionPanelProps) {
  const available = probe?.status?.management?.available === true;
  const lockedReason = available ? "Enter the management key to unlock read-only details." : "Management is not configured on the sidecar yet.";

  return (
    <section className="panel management-session-panel">
      <div className="panel-heading">
        <span>Management Session</span>
        <strong>{labelFor(sessionState)}</strong>
      </div>
      <div className="summary-card hero-summary">
        {sessionState === "signed-in" ? <ShieldCheck /> : <Lock />}
        <div>
          <strong>{sessionState === "signed-in" ? "Read-only management unlocked" : "Management is locked"}</strong>
          <p>{sessionState === "signed-in" ? "The key is kept only in desktop memory and is not saved to settings." : lockedReason}</p>
        </div>
      </div>
      <div className="management-login-row">
        <input
          type="password"
          value={keyValue}
          placeholder="Management key"
          disabled={!available || sessionState === "checking"}
          onChange={(event) => onKeyChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onVerify();
          }}
        />
        <button type="button" disabled={!available || !keyValue.trim() || sessionState === "checking"} onClick={onVerify}>
          <RefreshCw size={15} /> {sessionState === "signed-in" ? "Refresh" : "Verify"}
        </button>
        <button type="button" disabled={sessionState === "signed-out" && !keyValue} onClick={onLogout}>
          <LogOut size={15} /> Clear
        </button>
      </div>
      {error ? <div className="inline-error">{error}</div> : null}
      {summary ? <ManagementSafeSummary summary={summary} /> : null}
    </section>
  );
}

function ManagementSafeSummary({ summary }: { summary: ManagementSummary }) {
  const rows = [
    ["Debug", enabledText(summary.debug)],
    ["Logging to file", enabledText(summary.loggingToFile)],
    ["Usage statistics", enabledText(summary.usageStatistics)],
    ["WebSocket auth", enabledText(summary.websocketAuth)],
    ["Proxy URL", summary.proxyUrlConfigured ? "Configured" : "Not configured"],
    ["Checked", new Date(summary.checkedAt).toLocaleTimeString()],
  ];

  return (
    <div className="metadata-grid management-safe-grid">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <div>{label}</div>
          <strong>{value}</strong>
        </Fragment>
      ))}
    </div>
  );
}

function enabledText(value?: boolean) {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}

function labelFor(state: ManagementSessionState) {
  if (state === "checking") return "checking";
  if (state === "signed-in") return "unlocked";
  if (state === "error") return "attention";
  return "locked";
}