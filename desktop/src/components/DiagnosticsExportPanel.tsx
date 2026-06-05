import { Download, FileWarning, ShieldCheck } from "lucide-react";
import { buildDiagnosticsSummary, type DiagnosticsReportInput } from "../lib/diagnosticsExport";

type DiagnosticsExportPanelProps = DiagnosticsReportInput & {
  onExport: () => void;
};

export function DiagnosticsExportPanel(props: DiagnosticsExportPanelProps) {
  const summary = buildDiagnosticsSummary(props);

  return (
    <section className="panel diagnostics-export-panel">
      <div className="panel-heading">
        <span>Diagnostics Export</span>
        <strong>safe report</strong>
      </div>
      <div className="summary-card hero-summary summary-ok">
        <ShieldCheck />
        <div>
          <strong>{summary.headline}</strong>
          <p>{summary.detail}</p>
          <div className="diagnostics-facts">
            <span>{summary.warnings} preflight warnings</span>
            <span>{summary.logLines} recent log lines</span>
          </div>
          <div className="button-row diagnostics-actions">
            <button className="primary" onClick={props.onExport}><Download size={15} /> Export safe report</button>
          </div>
        </div>
      </div>
      <div className="inline-note diagnostics-boundary">
        <FileWarning size={16} />
        <span>
          The report uses visible status, counts, booleans, and redacted recent logs only. It excludes keys, OAuth tokens, management passwords, request bodies, prompts, responses, auth files, and full config contents.
        </span>
      </div>
    </section>
  );
}
