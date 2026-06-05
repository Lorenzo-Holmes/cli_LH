import { AlertTriangle, CheckCircle2, FileText, Info } from "lucide-react";
import { buildSafeConfigOverview, type SafeConfigNote, type SafeConfigOverviewInput } from "../lib/safeConfigOverview";

export function SafeConfigOverviewPanel(props: SafeConfigOverviewInput) {
  const overview = buildSafeConfigOverview(props);

  return (
    <section className="panel safe-config-panel">
      <div className="panel-heading">
        <span>Safe Config Overview</span>
        <strong>read-only</strong>
      </div>
      <div className="safe-config-grid">
        {overview.sections.map((section) => (
          <div className="safe-config-section" key={section.title}>
            <div className="safe-config-section-title">
              <FileText size={18} />
              <strong>{section.title}</strong>
            </div>
            <dl>
              {section.items.map((item) => (
                <div className={`safe-config-item ${item.tone ? `safe-config-${item.tone}` : ""}`} key={`${section.title}-${item.label}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="safe-config-notes">
        {overview.notes.map((note) => (
          <SafeConfigNoteCard note={note} key={note.title} />
        ))}
      </div>
    </section>
  );
}

function SafeConfigNoteCard({ note }: { note: SafeConfigNote }) {
  const Icon = note.tone === "ok" ? CheckCircle2 : note.tone === "critical" ? AlertTriangle : Info;
  return (
    <div className={`safe-config-note safe-config-note-${note.tone}`}>
      <Icon size={18} />
      <div>
        <strong>{note.title}</strong>
        <p>{note.detail}</p>
      </div>
    </div>
  );
}
