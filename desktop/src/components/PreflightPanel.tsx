import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { PreflightReport, PreflightSeverity } from "../lib/sidecar";

type PreflightPanelProps = {
  report?: PreflightReport;
  onRefresh: () => void;
};

function iconFor(severity: PreflightSeverity) {
  if (severity === "ok") return <CheckCircle2 size={16} />;
  if (severity === "warning") return <AlertTriangle size={16} />;
  return <Info size={16} />;
}

export function PreflightPanel({ report, onRefresh }: PreflightPanelProps) {
  return (
    <section className="panel preflight-panel">
      <div className="panel-heading">
        <div>
          <p>SETUP PREFLIGHT</p>
          <h2>Launch readiness</h2>
        </div>
        <button onClick={onRefresh}>Recheck</button>
      </div>
      {!report ? (
        <p className="muted">Run preflight to check binary, config, base URL, and port readiness.</p>
      ) : (
        <div className="preflight-list">
          {report.checks.map((check) => (
            <article className={`preflight-check ${check.severity}`} key={check.id}>
              <span className="preflight-icon">{iconFor(check.severity)}</span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.message}</p>
                {check.suggestion ? <small>{check.suggestion}</small> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
