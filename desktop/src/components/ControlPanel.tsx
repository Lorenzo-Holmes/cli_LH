import { Play, RotateCcw, Square } from "lucide-react";
import type { DesktopSettings } from "../lib/storage";
import type { SidecarState } from "../lib/sidecar";

export function ControlPanel({
  settings,
  state,
  busy,
  onStart,
  onStop,
  onRestart,
}: {
  settings: DesktopSettings;
  state: SidecarState;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  const missingPaths = settings.binaryPath.trim() === "" || settings.configPath.trim() === "";
  return (
    <section className="panel control-panel" id="overview">
      <div className="panel-heading">
        <span>Sidecar Control</span>
        <strong>{state.pid ? `PID ${state.pid}` : "NO PROCESS"}</strong>
      </div>
      <div className="hero-gauge">
        <div className={`gauge-ring phase-${state.phase}`}>
          <span>{state.phase}</span>
        </div>
        <p>{state.message ?? "Ready to control the local cli_LH sidecar."}</p>
      </div>
      {missingPaths && <div className="inline-warning">Set both binary path and config path before starting.</div>}
      <div className="button-row">
        <button className="primary" onClick={onStart} disabled={busy || missingPaths}>
          <Play size={16} /> Start
        </button>
        <button onClick={onStop} disabled={busy || state.phase === "idle" || state.phase === "stopped"}>
          <Square size={16} /> Stop
        </button>
        <button onClick={onRestart} disabled={busy || missingPaths}>
          <RotateCcw size={16} /> Restart
        </button>
      </div>
    </section>
  );
}
