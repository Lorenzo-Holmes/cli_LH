import { AlertTriangle, CheckCircle2, CircleHelp, ClipboardList, PlugZap, Settings2, ShieldQuestion, Wrench } from "lucide-react";
import { buildTroubleshootingGuide, type TroubleshootingStep } from "../lib/troubleshooting";
import type { PreflightReport, SidecarState } from "../lib/sidecar";
import type { ProbeResult } from "../lib/status";
import type { DesktopSettings } from "../lib/storage";

type TroubleshootingGuidePanelProps = {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
  onSetup: () => void;
  onRecheck: () => void;
};

export function TroubleshootingGuidePanel(props: TroubleshootingGuidePanelProps) {
  const guide = buildTroubleshootingGuide(props);

  return (
    <section className="panel troubleshooting-panel">
      <div className="panel-heading">
        <span>Troubleshooting</span>
        <strong>guided fixes</strong>
      </div>
      <div className="summary-card hero-summary summary-muted">
        <CircleHelp />
        <div>
          <strong>{guide.headline}</strong>
          <p>{guide.detail}</p>
          <div className="button-row troubleshooting-actions">
            <button onClick={props.onSetup}>Open setup wizard</button>
            <button onClick={props.onRecheck}>Recheck status</button>
          </div>
        </div>
      </div>
      <div className="troubleshooting-list">
        {guide.steps.map((step) => (
          <TroubleshootingCard step={step} key={step.id} />
        ))}
      </div>
    </section>
  );
}

function TroubleshootingCard({ step }: { step: TroubleshootingStep }) {
  return (
    <article className={`troubleshooting-card troubleshoot-${step.tone}`}>
      {iconFor(step.id, step.tone)}
      <div>
        <strong>{step.title}</strong>
        <dl>
          <dt>Symptom</dt>
          <dd>{step.symptom}</dd>
          <dt>Check</dt>
          <dd>{step.check}</dd>
          <dt>Safe fix</dt>
          <dd>{step.fix}</dd>
        </dl>
      </div>
    </article>
  );
}

function iconFor(id: string, tone: TroubleshootingStep["tone"]) {
  if (tone === "ok") return <CheckCircle2 />;
  if (id === "paths") return <Settings2 />;
  if (id === "preflight") return <ClipboardList />;
  if (id === "port") return <PlugZap />;
  if (id === "management") return <ShieldQuestion />;
  if (tone === "critical") return <AlertTriangle />;
  return <Wrench />;
}
