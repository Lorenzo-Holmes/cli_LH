import { BookOpenCheck, CheckCircle2, Copy, Link2, PlugZap } from "lucide-react";
import { buildApiUsageGuide } from "../lib/apiUsageGuide";
import type { SidecarState } from "../lib/sidecar";
import type { ProbeResult } from "../lib/status";
import type { DesktopSettings } from "../lib/storage";

type ApiUsageGuidePanelProps = {
  settings: DesktopSettings;
  state: SidecarState;
  probe?: ProbeResult;
  onCopy: (value: string, label: string) => void;
};

export function ApiUsageGuidePanel({ settings, state, probe, onCopy }: ApiUsageGuidePanelProps) {
  const guide = buildApiUsageGuide(settings, state.phase, probe);

  return (
    <section className="panel api-usage-panel">
      <div className="panel-heading">
        <span>API Usage Guide</span>
        <strong>{guide.readinessLabel}</strong>
      </div>
      <div className={`summary-card hero-summary ${guide.ready ? "summary-ok" : "summary-muted"}`}>
        {guide.ready ? <CheckCircle2 /> : <PlugZap />}
        <div>
          <strong>{guide.ready ? "Local API is ready for client tools" : "Start the sidecar before using client tools"}</strong>
          <p>
            Most compatible clients need the Base URL below. Keep API keys in the client tool or config file;
            this panel only shows local endpoints.
          </p>
        </div>
      </div>
      <div className="copy-row">
        <code>{guide.baseUrl}</code>
        <button type="button" onClick={() => onCopy(guide.baseUrl, "Base URL")}>
          <Copy size={15} /> Copy Base URL
        </button>
      </div>
      <div className="api-endpoint-list">
        {guide.endpoints.map((endpoint) => {
          const url = `${guide.baseUrl}${endpoint.path}`;
          return (
            <article className="api-endpoint-card" key={endpoint.path}>
              <Link2 />
              <div>
                <strong>{endpoint.label}</strong>
                <code>{url}</code>
                <p>{endpoint.description}</p>
              </div>
              <button type="button" onClick={() => onCopy(url, endpoint.label)}>
                <Copy size={15} /> Copy
              </button>
            </article>
          );
        })}
      </div>
      <div className="inline-note">
        <BookOpenCheck size={16} />
        <span>Beginner tip: if a client asks for “API Base URL”, paste the Base URL. If it asks for a full endpoint, paste the matching URL above.</span>
      </div>
    </section>
  );
}
