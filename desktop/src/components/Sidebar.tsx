import { Activity, Cpu, RadioTower } from "lucide-react";
import type { SidecarPhase } from "../lib/sidecar";

export function Sidebar({ phase }: { phase: SidecarPhase }) {
  return (
    <aside className="sidebar">
      <div className="brand-mark">
        <RadioTower size={24} />
        <div>
          <strong>cli_LH</strong>
          <span>desktop cockpit</span>
        </div>
      </div>
      <div className={`phase-pill phase-${phase}`}>
        <span className="phase-dot" />
        {phase.toUpperCase()}
      </div>
      <nav className="nav-stack" aria-label="Desktop sections">
        <a href="#overview"><Activity size={18} /> Overview</a>
        <a href="#settings"><Cpu size={18} /> Settings</a>
        <a href="#logs"><RadioTower size={18} /> Logs</a>
      </nav>
    </aside>
  );
}
