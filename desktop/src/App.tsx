import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel";
import { ControlPanel } from "./components/ControlPanel";
import { LogPanel } from "./components/LogPanel";
import { ManagementSessionPanel } from "./components/ManagementSessionPanel";
import { ManagementSummaryPanel } from "./components/ManagementSummaryPanel";
import { NextActionsPanel } from "./components/NextActionsPanel";
import { PreflightPanel } from "./components/PreflightPanel";
import { ProfilePanel } from "./components/ProfilePanel";
import { ProviderSummaryPanel } from "./components/ProviderSummaryPanel";
import { RuntimeSummaryPanel } from "./components/RuntimeSummaryPanel";
import { SetupWizard } from "./components/SetupWizard";
import { Sidebar } from "./components/Sidebar";
import { StatusPanel } from "./components/StatusPanel";
import { clearLogs, deleteProfile, discoverLaunchProfile, exportLogs, getSettings, getSidecarState, listProfiles, openAppDataDir, openManagementPage, recommendAvailablePort, renameProfile, restartSidecar, revealBinaryPath, revealConfigPath, saveProfile, saveSettings, selectBinaryPath, selectConfigPath, startSidecar, stopSidecar, subscribeSidecarEvents, validateLaunchProfile, type LaunchProfile, type LogLine, type PreflightReport, type SidecarState } from "./lib/sidecar";
import { loadManagementSummary, type ManagementSessionState, type ManagementSummary } from "./lib/management";
import { probeSidecar, type ProbeResult } from "./lib/status";
import { defaultSettings, normalizeSettings, type DesktopSettings } from "./lib/storage";

export default function App() {
  const [settings, setSettings] = useState<DesktopSettings>(defaultSettings);
  const [state, setState] = useState<SidecarState>({ phase: "idle" });
  const [probe, setProbe] = useState<ProbeResult>();
  const [preflight, setPreflight] = useState<PreflightReport>();
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [profiles, setProfiles] = useState<LaunchProfile[]>([]);
  const [managementKey, setManagementKey] = useState("");
  const [managementSessionState, setManagementSessionState] = useState<ManagementSessionState>("signed-out");
  const [managementSummary, setManagementSummary] = useState<ManagementSummary>();
  const [managementError, setManagementError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);

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
      if (!cancelled) {
        const normalized = normalizeSettings(loaded);
        setSettings(normalized);
        setWizardOpen(!normalized.binaryPath || !normalized.configPath);
      }
    });
    void getSidecarState().then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    void listProfiles().then((loaded) => {
      if (!cancelled) setProfiles(loaded);
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

  useEffect(() => {
    if (autoStartAttempted || !settings.autoStart || !preflight?.canStart) return;
    if (state.phase !== "idle" && state.phase !== "stopped") return;
    setAutoStartAttempted(true);
    pushLog({ source: "system", message: "Auto start is enabled; starting sidecar", timestamp: new Date().toISOString() });
    void runAction(() => startSidecar(normalizedSettings));
  }, [autoStartAttempted, normalizedSettings, preflight?.canStart, pushLog, settings.autoStart, state.phase]);

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

  async function suggestAvailablePort() {
    try {
      const recommended = await recommendAvailablePort(normalizedSettings);
      setSettings(recommended);
      pushLog({ source: "system", message: `Suggested available base URL: ${recommended.baseUrl}`, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    }
  }

  async function exportVisibleLogs(lines: LogLine[]) {
    try {
      const path = await exportLogs(lines);
      pushLog({ source: "system", message: `Exported ${lines.length} log lines to ${path}`, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    }
  }

  async function saveCurrentProfile(name: string) {
    try {
      const saved = await saveProfile(name, normalizedSettings);
      setProfiles(saved);
      pushLog({ source: "system", message: `Saved profile: ${name.trim()}`, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    }
  }

  async function renameCurrentProfile(oldName: string, newName: string) {
    try {
      const saved = await renameProfile(oldName, newName);
      setProfiles(saved);
      pushLog({ source: "system", message: `Renamed profile: ${oldName} -> ${newName.trim()}`, timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog({ source: "system", message, timestamp: new Date().toISOString() });
    }
  }

  async function deleteCurrentProfile(name: string) {
    try {
      const saved = await deleteProfile(name);
      setProfiles(saved);
      pushLog({ source: "system", message: `Deleted profile: ${name}`, timestamp: new Date().toISOString() });
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

  async function verifyManagementSession() {
    const key = managementKey.trim();
    if (!key) return;
    setManagementSessionState("checking");
    setManagementError(undefined);
    try {
      const summary = await loadManagementSummary(normalizedSettings.baseUrl, key);
      setManagementSummary(summary);
      setManagementSessionState("signed-in");
      pushLog({ source: "system", message: "Management read-only session verified", timestamp: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setManagementSummary(undefined);
      setManagementSessionState("error");
      setManagementError(message);
      pushLog({ source: "system", message: `Management session check failed: ${message}`, timestamp: new Date().toISOString() });
    }
  }

  function clearManagementSession() {
    setManagementKey("");
    setManagementSummary(undefined);
    setManagementError(undefined);
    setManagementSessionState("signed-out");
    pushLog({ source: "system", message: "Management session cleared", timestamp: new Date().toISOString() });
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
          <button onClick={() => setWizardOpen(true)}>Setup wizard</button>
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
          <NextActionsPanel
            settings={normalizedSettings}
            state={state}
            preflight={preflight}
            probe={probe}
            onSetup={() => setWizardOpen(true)}
            onStart={() => void runAction(() => startSidecar(normalizedSettings))}
            onProbe={() => void refreshProbe()}
            onOpenManagement={() => void runUtilityAction(() => openManagementPage(normalizedSettings), "Opened management UI")}
          />
          <StatusPanel probe={probe} />
          <ProviderSummaryPanel probe={probe} />
          <ManagementSummaryPanel probe={probe} />
          <ManagementSessionPanel
            keyValue={managementKey}
            sessionState={managementSessionState}
            summary={managementSummary}
            error={managementError}
            probe={probe}
            onKeyChange={setManagementKey}
            onVerify={() => void verifyManagementSession()}
            onLogout={clearManagementSession}
          />
          <RuntimeSummaryPanel probe={probe} />
          <ConfigPanel
            settings={settings}
            onChange={setSettings}
            onSelectBinary={() => void chooseBinaryPath()}
            onSelectConfig={() => void chooseConfigPath()}
            onDiscover={() => void autoDiscoverProfile()}
            onRecommendPort={() => void suggestAvailablePort()}
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
          <ProfilePanel
            profiles={profiles}
            settings={normalizedSettings}
            onApply={(next) => setSettings(normalizeSettings(next))}
            onSave={(name) => void saveCurrentProfile(name)}
            onRename={(oldName, newName) => void renameCurrentProfile(oldName, newName)}
            onDelete={(name) => void deleteCurrentProfile(name)}
          />
          <PreflightPanel report={preflight} onRefresh={() => void refreshPreflight()} />
          <LogPanel logs={logs} onClear={() => {
            setLogs([]);
            void clearLogs();
          }} onExport={(visibleLogs) => void exportVisibleLogs(visibleLogs)} />
        </div>
      </main>
      <SetupWizard
        open={wizardOpen}
        settings={normalizedSettings}
        preflight={preflight}
        onClose={() => setWizardOpen(false)}
        onDiscover={() => void autoDiscoverProfile()}
        onRecommendPort={() => void suggestAvailablePort()}
        onSave={() => void runAction(async () => {
          const saved = await saveSettings(normalizedSettings);
          setSettings(saved);
          return { ...state, message: "Settings saved" };
        })}
        onStart={() => void runAction(() => startSidecar(normalizedSettings))}
      />
    </div>
  );
}
