import { ExternalLink, FolderOpen, Wand2 } from "lucide-react";
import type { DesktopSettings } from "../lib/storage";

export function ConfigPanel({
  settings,
  onChange,
  onSave,
  onSelectBinary,
  onSelectConfig,
  onDiscover,
  onOpenManagement,
  onRevealBinary,
  onRevealConfig,
  onOpenAppData,
}: {
  settings: DesktopSettings;
  onChange: (settings: DesktopSettings) => void;
  onSave: () => void;
  onSelectBinary: () => void;
  onSelectConfig: () => void;
  onDiscover: () => void;
  onOpenManagement: () => void;
  onRevealBinary: () => void;
  onRevealConfig: () => void;
  onOpenAppData: () => void;
}) {
  return (
    <section className="panel" id="settings">
      <div className="panel-heading">
        <span>Launch Profile</span>
        <div className="panel-actions">
          <button onClick={onDiscover}><Wand2 size={15} /> Auto-detect</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
      <label className="field">
        <span>cli_LH binary</span>
        <div className="field-row">
          <input
            value={settings.binaryPath}
            placeholder="C:\\path\\to\\cli_LH.exe"
            onChange={(event) => onChange({ ...settings, binaryPath: event.target.value })}
          />
          <button type="button" onClick={onSelectBinary}><FolderOpen size={15} /> Browse</button>
        </div>
      </label>
      <label className="field">
        <span>config.yaml</span>
        <div className="field-row">
          <input
            value={settings.configPath}
            placeholder="C:\\path\\to\\config.yaml"
            onChange={(event) => onChange({ ...settings, configPath: event.target.value })}
          />
          <button type="button" onClick={onSelectConfig}><FolderOpen size={15} /> Browse</button>
        </div>
      </label>
      <label className="field">
        <span>base URL</span>
        <input value={settings.baseUrl} onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })} />
      </label>
      <div className="toggle-grid">
        <label><input type="checkbox" checked={settings.localModel} onChange={(event) => onChange({ ...settings, localModel: event.target.checked })} /> Local model</label>
        <label><input type="checkbox" checked={settings.autoStart} onChange={(event) => onChange({ ...settings, autoStart: event.target.checked })} /> Auto start</label>
      </div>
      <div className="panel-actions recovery-actions">
        <button type="button" onClick={onOpenManagement}><ExternalLink size={15} /> Open UI</button>
        <button type="button" onClick={onRevealBinary}><FolderOpen size={15} /> Reveal binary</button>
        <button type="button" onClick={onRevealConfig}><FolderOpen size={15} /> Reveal config</button>
        <button type="button" onClick={onOpenAppData}><FolderOpen size={15} /> App data</button>
      </div>
    </section>
  );
}
