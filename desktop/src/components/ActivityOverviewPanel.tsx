import { Activity, Clock3, FileText, ListChecks, RadioTower, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { buildActivityOverview, type ActivityOverviewItem } from "../lib/activityOverview";
import type { SidecarState } from "../lib/sidecar";
import type { ProbeResult } from "../lib/status";

type ActivityOverviewPanelProps = {
  state: SidecarState;
  probe?: ProbeResult;
};

export function ActivityOverviewPanel({ state, probe }: ActivityOverviewPanelProps) {
  const overview = buildActivityOverview(state, probe);

  return (
    <section className="panel activity-overview-panel">
      <div className="panel-heading">
        <span>Activity Overview</span>
        <strong>safe signals</strong>
      </div>
      <div className="summary-card hero-summary summary-muted">
        <Activity />
        <div>
          <strong>{overview.headline}</strong>
          <p>{overview.detail}</p>
        </div>
      </div>
      <div className="activity-grid">
        {overview.items.map((item) => (
          <ActivityCard item={item} key={item.label} />
        ))}
      </div>
    </section>
  );
}

function ActivityCard({ item }: { item: ActivityOverviewItem }) {
  return (
    <article className={`activity-card activity-${item.tone}`}>
      {iconFor(item.label)}
      <div>
        <span>{item.label}</span>
        <strong>{item.value}</strong>
        <p>{item.detail}</p>
      </div>
    </article>
  );
}

function iconFor(label: string): ReactNode {
  if (label === "Process phase") return <RadioTower />;
  if (label === "Last probe") return <Clock3 />;
  if (label === "Usage statistics") return <ListChecks />;
  if (label === "Request logging") return <ShieldAlert />;
  return <FileText />;
}
