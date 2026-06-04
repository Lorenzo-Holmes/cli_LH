import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel";
import { ControlPanel } from "./components/ControlPanel";
import { LogPanel } from "./components/LogPanel";
import { PreflightPanel } from "./components/PreflightPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusPanel } from "./components/StatusPanel";
import { clearLogs, discoverLaunchProfile, getSettings, getSidecarState, openAppDataDir, openManagementPage, restartSidecar, revealBinaryPath, revealConfigPath, saveSettings, selectBinaryPath, selectConfigPath, startSidecar, stopSidecar, subscribeSidecarEvents, validateLaunchProfile, type LogLine, type PreflightReport, type SidecarState } from "./lib/sidecar";
import { probeSidecar, type ProbeResult } from "./lib/status";
import { defaultSettings, normalizeSettings, type DesktopSettings } from "./lib/storage";

export default function App() {
  const [settings, setSettings] = useState<DesktopSettings>(defaultSettings);
  const [state, setState] = useState<SidecarState>({ phase: "idle" });
  const [probe, setProbe] = useState<ProbeResult>();
  const [preflight, setPreflight] = useState<PreflightReport>();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);

  const normalizedSettings = useMemo(() => normalizeSettings(settings), [settings]);

  const pushLog = useCallback((line: LogLine) => {
    setLogs((current) => [...current.slice(-300), line]);
  }, []);

  const refreshProbe = useCallback(async () => {
    const result = await probeSidecar(normalizedSettings.baseUrl);
    setProbe(result);
    if (result.ok && state.phase === "starting") {
      setState((current) => ({ ...current, phase: "ready", message: "HTTP probes report ready" }));
    }
  }, [normalizedSettings.baseUrl, state.phase]);

  const refreshPreflight = useCallback(async () => {
    const result = await validateLaunchProfile(normalizedSettings);
    setPreflight(result);
  }, [normalizedSettings]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void)[] = [];

    void getSettings().then((loaded) => {
      if (!cancelled) setSettings(normalizeSettings(loaded));
    });
    void getSidecarState().then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    void subscribeSidecarEvents({ onState: setState, onLog: pushLog }).then((handlers) => {
      unlisten = handlers;
    });

    return () => {
      cancelled = true;
      unlisten.forEach((handler) => handler());
    };
  }, [pushLog]);

  useEffect(() => {
    void refreshProbe();
    const timer = window.setInterval(() => void refreshProbe(), 2500);
    return () => window.clearInterval(timer);
  }, [refreshProbe]);

  useEffect(() => {
    void refreshPreflight();
  }, [refreshPreflight]);

  async function runAction(action: () => Promise<SidecarState>) {
    setBusy(true);
    try {
      const next = await action();
      setState(next);
      pushLog({ source: "system", message: next.message ?? `state=${next.phase}`, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ phase: "error", message });
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    } finally {
      setBusy(false);
    }
  }

  async function chooseBinaryPath() {
    const selected = await selectBinaryPath();
    if (selected) {
      setSettings((current) => normalizeSettings({ ...current, binaryPath: selected }));
    }
  }

  async function chooseConfigPath() {
    const selected = await selectConfigPath();
    if (selected) {
      setSettings((current) => normalizeSettings({ ...current, configPath: selected }));
    }
  }

  async function autoDiscoverProfile() {
    try {
      const discovered = await discoverLaunchProfile();
      setSettings((current) => normalizeSettings({ ...current, ...discovered }));
      pushLog({ source: "system", message: "Launch profile auto-detection completed", timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    }
  }

  async function runUtilityAction(action: () => Promise<void>, successMessage: string) {
    try {
      await action();
      pushLog({ source: "system", message: successMessage, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    }
  }

  return (
    <div className="app-shell">
      <Sidebar phase={state.phase} />
      <main className="dashboard">
        <header className="topbar">
          <div>
            <p>LOCAL SIDECAR CONTROL</p>
            <h1>Operational cockpit for cli_LH</h1>
          </div>
          <button onClick={() => void refreshProbe()}>Probe now</button>
        </header>
        <div className="dashboard-grid">
          <ControlPanel
            settings={normalizedSettings}
            state={state}
            busy={busy}
            onStart={() => void runAction(() => startSidecar(normalizedSettings))}
            onStop={() => void runAction(stopSidecar)}
            onRestart={() => void runAction(() => restartSidecar(normalizedSettings))}
          />
          <StatusPanel probe={probe} />
          <ConfigPanel
            settings={settings}
            onChange={setSettings}
            onSelectBinary={() => void chooseBinaryPath()}
            onSelectConfig={() => void chooseConfigPath()}
            onDiscover={() => void autoDiscoverProfile()}
            onOpenManagement={() => void runUtilityAction(() => openManagementPage(normalizedSettings), "Opened management UI")}
            onRevealBinary={() => void runUtilityAction(() => revealBinaryPath(normalizedSettings), "Revealed binary path")}
            onRevealConfig={() => void runUtilityAction(() => revealConfigPath(normalizedSettings), "Revealed config path")}
            onOpenAppData={() => void runUtilityAction(openAppDataDir, "Opened app data directory")}
            onSave={() => void runAction(async () => {
              const saved = await saveSettings(normalizedSettings);
              setSettings(saved);
              return { ...state, message: "Settings saved" };
            })}
          />
          <PreflightPanel report={preflight} onRefresh={() => void refreshPreflight()} />
          <LogPanel logs={logs} onClear={() => {
            setLogs([]);
            void clearLogs();
          }} />
        </div>
      </main>
    </div>
  );
}
