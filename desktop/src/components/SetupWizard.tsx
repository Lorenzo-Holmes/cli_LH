import { CheckCircle2, Rocket, Wand2, X } from "lucide-react";
import type { PreflightReport } from "../lib/sidecar";
import type { DesktopSettings } from "../lib/storage";

export function SetupWizard({
  open,
  settings,
  preflight,
  onClose,
  onDiscover,
  onRecommendPort,
  onSave,
  onStart,
}: {
  open: boolean;
  settings: DesktopSettings;
  preflight?: PreflightReport;
  onClose: () => void;
  onDiscover: () => void;
  onRecommendPort: () => void;
  onSave: () => void;
  onStart: () => void;
}) {
  if (!open) return null;

  const hasPaths = Boolean(settings.binaryPath && settings.configPath);
  const canStart = Boolean(preflight?.canStart);
  const blockedChecks = preflight?.checks.filter((check) => check.severity !== "ok") ?? [];

  return (
    <div className="wizard-backdrop" role="dialog" aria-modal="true" aria-label="First run setup wizard">
      <section className="wizard-card">
        <div className="wizard-heading">
          <div>
            <p>FIRST RUN</p>
            <h2>Set up cli_LH Cockpit</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close setup wizard"><X size={16} /></button>
        </div>
        <div className="wizard-steps">
          <div className={`wizard-step ${hasPaths ? "done" : "active"}`}>
            <CheckCircle2 size={18} />
            <div>
              <strong>Find launch files</strong>
              <p>Auto-detect or browse for `cli_LH` and `config.yaml` in the launch profile panel.</p>
            </div>
          </div>
          <div className={`wizard-step ${canStart ? "done" : "active"}`}>
            <CheckCircle2 size={18} />
            <div>
              <strong>Pass preflight</strong>
              <p>Resolve missing files and port conflicts before starting the sidecar.</p>
            </div>
          </div>
          <div className="wizard-step">
            <Rocket size={18} />
            <div>
              <strong>Start sidecar</strong>
              <p>Save the launch profile and start the Go service from the cockpit.</p>
            </div>
          </div>
        </div>
        {blockedChecks.length > 0 && (
          <div className="wizard-issues">
            {blockedChecks.map((check) => (
              <p key={check.id}><strong>{check.label}:</strong> {check.message}</p>
            ))}
          </div>
        )}
        <div className="panel-actions wizard-actions">
          <button type="button" onClick={onDiscover}><Wand2 size={15} /> Auto-detect</button>
          <button type="button" onClick={onRecommendPort}>Suggest port</button>
          <button type="button" onClick={onSave}>Save</button>
          <button type="button" className="primary" disabled={!canStart} onClick={onStart}><Rocket size={15} /> Start</button>
        </div>
      </section>
    </div>
  );
}