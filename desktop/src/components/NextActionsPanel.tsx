import { ArrowRight, ClipboardCheck, PlayCircle, Radar, ScrollText, Settings2, ShieldCheck } from "lucide-react";
import { buildNextActions, type NextActionKind } from "../lib/nextActions";
import type { PreflightReport, SidecarState } from "../lib/sidecar";
import type { ProbeResult } from "../lib/status";
import type { DesktopSettings } from "../lib/storage";

type NextActionsPanelProps = {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
  onSetup: () => void;
  onStart: () => void;
  onProbe: () => void;
  onOpenManagement: () => void;
};

export function NextActionsPanel(props: NextActionsPanelProps) {
  const actions = buildNextActions({
    settings: props.settings,
    state: props.state,
    preflight: props.preflight,
    probe: props.probe,
  });

  return (
    <section className="panel next-actions-panel">
      <div className="panel-heading">
        <span>Next actions</span>
        <strong>beginner guide</strong>
      </div>
      <div className="next-action-list">
        {actions.map((action) => (
          <article className={`next-action-card action-${action.priority}`} key={`${action.kind}-${action.title}`}>
            {iconFor(action.kind)}
            <div>
              <strong>{action.title}</strong>
              <p>{action.detail}</p>
              <button onClick={() => runAction(action.kind, props)}>
                {action.cta}
                <ArrowRight />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function runAction(kind: NextActionKind, props: NextActionsPanelProps) {
  if (kind === "setup" || kind === "preflight") {
    props.onSetup();
    return;
  }
  if (kind === "start") {
    props.onStart();
    return;
  }
  if (kind === "probe") {
    props.onProbe();
    return;
  }
  if (kind === "management") {
    props.onOpenManagement();
    return;
  }
  props.onProbe();
}

function iconFor(kind: NextActionKind) {
  if (kind === "setup") return <Settings2 />;
  if (kind === "preflight") return <ClipboardCheck />;
  if (kind === "start") return <PlayCircle />;
  if (kind === "management") return <ShieldCheck />;
  if (kind === "logs") return <ScrollText />;
  return <Radar />;
}