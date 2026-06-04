import type { DesktopSettings } from "../lib/storage";

export function ConfigPanel({
  settings,
  onChange,
  onSave,
}: {
  settings: DesktopSettings;
  onChange: (settings: DesktopSettings) => void;
  onSave: () => void;
}) {
  return (
    <section className="panel" id="settings">
      <div className="panel-heading">
        <span>Launch Profile</span>
        <button onClick={onSave}>Save</button>
      </div>
      <label className="field">
        <span>cli_LH binary</span>
        <input
          value={settings.binaryPath}
          placeholder="C:\\path\\to\\cli_LH.exe"
          onChange={(event) => onChange({ ...settings, binaryPath: event.target.value })}
        />
      </label>
      <label className="field">
        <span>config.yaml</span>
        <input
          value={settings.configPath}
          placeholder="C:\\path\\to\\config.yaml"
          onChange={(event) => onChange({ ...settings, configPath: event.target.value })}
        />
      </label>
      <label className="field">
        <span>base URL</span>
        <input value={settings.baseUrl} onChange={(event) => onChange({ ...settings, baseUrl: event.target.value })} />
      </label>
      <div className="toggle-grid">
        <label><input type="checkbox" checked={settings.localModel} onChange={(event) => onChange({ ...settings, localModel: event.target.checked })} /> Local model</label>
        <label><input type="checkbox" checked={settings.autoStart} onChange={(event) => onChange({ ...settings, autoStart: event.target.checked })} /> Auto start</label>
      </div>
    </section>
  );
}
