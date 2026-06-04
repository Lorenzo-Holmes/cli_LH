# Tauri React Desktop Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `desktop/` Tauri 2 + React + TypeScript reference shell that controls a local `cli_LH` sidecar process.

**Architecture:** The desktop subtree is isolated from the Go core. React renders the cockpit UI and calls Tauri commands; Rust owns process lifecycle, settings persistence, tray actions, stdout/stderr capture, and sidecar state events. The Go core is consumed only through binary launch plus `/healthz` and `/statusz`.

**Tech Stack:** React 18, TypeScript, Vite, Tauri 2, Rust, npm, existing Go sidecar HTTP contract.

---

## File Structure

Create the following subtree:

- `desktop/package.json`
  - npm scripts and dependencies.
- `desktop/index.html`
  - Vite HTML entrypoint.
- `desktop/tsconfig.json`
  - TypeScript settings for browser React.
- `desktop/tsconfig.node.json`
  - TypeScript settings for Vite config.
- `desktop/vite.config.ts`
  - Vite React build config.
- `desktop/src/main.tsx`
  - React bootstrap.
- `desktop/src/App.tsx`
  - Top-level desktop dashboard state wiring.
- `desktop/src/styles.css`
  - Cockpit visual system and layout.
- `desktop/src/lib/sidecar.ts`
  - Tauri command wrappers, event subscriptions, and browser fallback mocks.
- `desktop/src/lib/status.ts`
  - `/healthz` and `/statusz` probe helpers and response types.
- `desktop/src/lib/storage.ts`
  - Frontend defaults and settings validation helpers.
- `desktop/src/components/Sidebar.tsx`
  - Left rail and phase indicator.
- `desktop/src/components/StatusPanel.tsx`
  - Health/status metadata cards.
- `desktop/src/components/ControlPanel.tsx`
  - Start/stop/restart controls.
- `desktop/src/components/ConfigPanel.tsx`
  - Settings form.
- `desktop/src/components/LogPanel.tsx`
  - stdout/stderr stream viewer.
- `desktop/src-tauri/Cargo.toml`
  - Rust package and Tauri dependencies.
- `desktop/src-tauri/build.rs`
  - Tauri build hook.
- `desktop/src-tauri/tauri.conf.json`
  - App, windows, tray, and build config.
- `desktop/src-tauri/src/main.rs`
  - Tauri application entrypoint and command registration.
- `desktop/src-tauri/src/sidecar.rs`
  - Sidecar process manager, settings, state, commands, and tests.
- `desktop/src-tauri/src/tray.rs`
  - Tray menu setup and event handling.
- `desktop/README.md`
  - Local development and Rust requirement notes.

The existing Go files should not be modified for this plan unless a later test proves a sidecar contract bug.

---

### Task 1: Scaffold Desktop Project Metadata

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/index.html`
- Create: `desktop/tsconfig.json`
- Create: `desktop/tsconfig.node.json`
- Create: `desktop/vite.config.ts`
- Create: `desktop/README.md`

- [ ] **Step 1: Create `desktop/package.json`**

```json
{
  "name": "cli-lh-desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.9.0",
    "@tauri-apps/plugin-dialog": "^2.4.0",
    "@tauri-apps/plugin-opener": "^2.5.0",
    "@vitejs/plugin-react": "^5.1.1",
    "vite": "^7.2.4",
    "typescript": "^5.9.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.25",
    "@types/react-dom": "^18.3.7"
  }
}
```

- [ ] **Step 2: Create `desktop/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>cli_LH Cockpit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `desktop/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `desktop/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `desktop/vite.config.ts`**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
```

- [ ] **Step 6: Create `desktop/README.md`**

Create the file with this Markdown content:

  # cli_LH Desktop Cockpit

  First-party reference desktop shell for controlling a local `cli_LH` sidecar.

  ## Responsibilities

  - React renders the control cockpit.
  - Tauri/Rust owns native process lifecycle and tray controls.
  - `cli_LH` remains the Go proxy core and is launched through `--config <path>`.

  ## Current Environment

  Frontend verification requires Node.js and npm:

  ```text
  npm install
  npm run typecheck
  npm run build
  ```

  Full Tauri verification additionally requires Rust and Cargo on PATH:

  ```text
  npm run tauri dev
  npm run tauri build
  ```

  If `rustc` and `cargo` are not available, the frontend build can still be verified.

- [ ] **Step 7: Install npm dependencies**

Run from repository root:

```text
cd desktop; npm install
```

Expected: `package-lock.json` is created and npm exits successfully.

- [ ] **Step 8: Commit scaffold metadata**

```text
git add desktop/package.json desktop/package-lock.json desktop/index.html desktop/tsconfig.json desktop/tsconfig.node.json desktop/vite.config.ts desktop/README.md
git commit -m "feat(desktop): scaffold tauri react project"
```

---

### Task 2: Add Frontend Types, Tauri Wrappers, and Probe Helpers

**Files:**
- Create: `desktop/src/lib/storage.ts`
- Create: `desktop/src/lib/status.ts`
- Create: `desktop/src/lib/sidecar.ts`

- [ ] **Step 1: Create `desktop/src/lib/storage.ts`**

```ts
export type DesktopSettings = {
  binaryPath: string;
  configPath: string;
  baseUrl: string;
  localModel: boolean;
  autoStart: boolean;
};

export const defaultSettings: DesktopSettings = {
  binaryPath: "",
  configPath: "",
  baseUrl: "http://127.0.0.1:8317",
  localModel: false,
  autoStart: false,
};

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return defaultSettings.baseUrl;
  }
  return trimmed.replace(/\/+$/, "");
}

export function normalizeSettings(settings: DesktopSettings): DesktopSettings {
  return {
    binaryPath: settings.binaryPath.trim(),
    configPath: settings.configPath.trim(),
    baseUrl: normalizeBaseUrl(settings.baseUrl),
    localModel: settings.localModel,
    autoStart: settings.autoStart,
  };
}
```

- [ ] **Step 2: Create `desktop/src/lib/status.ts`**

```ts
export type SidecarStatusResponse = {
  status: string;
  service: string;
  build?: {
    version?: string;
    commit?: string;
    buildDate?: string;
  };
  server?: {
    host?: string;
    port?: number;
    configPath?: string;
    authDir?: string;
  };
  runtime?: {
    tuiMode?: boolean;
    standalone?: boolean;
    localModel?: boolean;
  };
  providers?: {
    geminiApiKeys?: number;
    codexApiKeys?: number;
    claudeApiKeys?: number;
    openaiCompatibilityEntries?: number;
    vertexApiKeys?: number;
    oauthModelAliases?: number;
    homeEnabled?: boolean;
  };
};

export type ProbeResult = {
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  status?: SidecarStatusResponse;
  error?: string;
};

export async function probeSidecar(baseUrl: string): Promise<ProbeResult> {
  const started = performance.now();
  const checkedAt = new Date().toISOString();
  const root = baseUrl.replace(/\/+$/, "");

  try {
    const health = await fetch(`${root}/healthz`, { method: "GET" });
    if (!health.ok) {
      return {
        ok: false,
        checkedAt,
        latencyMs: Math.round(performance.now() - started),
        error: `/healthz returned ${health.status}`,
      };
    }

    const statusResponse = await fetch(`${root}/statusz`, { method: "GET" });
    if (!statusResponse.ok) {
      return {
        ok: false,
        checkedAt,
        latencyMs: Math.round(performance.now() - started),
        error: `/statusz returned ${statusResponse.status}`,
      };
    }

    const status = (await statusResponse.json()) as SidecarStatusResponse;
    return {
      ok: status.status === "ready",
      checkedAt,
      latencyMs: Math.round(performance.now() - started),
      status,
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

- [ ] **Step 3: Create `desktop/src/lib/sidecar.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { defaultSettings, type DesktopSettings } from "./storage";

export type SidecarPhase = "idle" | "starting" | "ready" | "stopping" | "stopped" | "error";

export type SidecarState = {
  phase: SidecarPhase;
  pid?: number;
  message?: string;
  startedAt?: string;
  stoppedAt?: string;
};

export type LogLine = {
  source: "stdout" | "stderr" | "system";
  message: string;
  timestamp: string;
};

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getSettings(): Promise<DesktopSettings> {
  if (!inTauri()) {
    return defaultSettings;
  }
  return invoke<DesktopSettings>("get_settings");
}

export async function saveSettings(settings: DesktopSettings): Promise<DesktopSettings> {
  if (!inTauri()) {
    return settings;
  }
  return invoke<DesktopSettings>("save_settings", { settings });
}

export async function getSidecarState(): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "idle", message: "Browser preview mode" };
  }
  return invoke<SidecarState>("get_sidecar_state");
}

export async function startSidecar(settings: DesktopSettings): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "starting", message: "Start is available inside Tauri" };
  }
  return invoke<SidecarState>("start_sidecar", { settings });
}

export async function stopSidecar(): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "stopped", message: "Stop is available inside Tauri" };
  }
  return invoke<SidecarState>("stop_sidecar");
}

export async function restartSidecar(settings: DesktopSettings): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "starting", message: "Restart is available inside Tauri" };
  }
  return invoke<SidecarState>("restart_sidecar", { settings });
}

export async function clearLogs(): Promise<void> {
  if (!inTauri()) {
    return;
  }
  await invoke("clear_logs");
}

export async function subscribeSidecarEvents(handlers: {
  onState: (state: SidecarState) => void;
  onLog: (line: LogLine) => void;
}): Promise<UnlistenFn[]> {
  if (!inTauri()) {
    return [];
  }

  const unlistenState = await listen<SidecarState>("sidecar://state", (event) => handlers.onState(event.payload));
  const unlistenStdout = await listen<LogLine>("sidecar://stdout", (event) => handlers.onLog(event.payload));
  const unlistenStderr = await listen<LogLine>("sidecar://stderr", (event) => handlers.onLog(event.payload));
  const unlistenError = await listen<LogLine>("sidecar://error", (event) => handlers.onLog(event.payload));
  return [unlistenState, unlistenStdout, unlistenStderr, unlistenError];
}
```

- [ ] **Step 4: Typecheck helper files**

Run:

```text
cd desktop; npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit frontend foundation**

```text
git add desktop/src/lib/storage.ts desktop/src/lib/status.ts desktop/src/lib/sidecar.ts
git commit -m "feat(desktop): add sidecar frontend contracts"
```

---

### Task 3: Build React Cockpit UI

**Files:**
- Create: `desktop/src/main.tsx`
- Create: `desktop/src/App.tsx`
- Create: `desktop/src/components/Sidebar.tsx`
- Create: `desktop/src/components/StatusPanel.tsx`
- Create: `desktop/src/components/ControlPanel.tsx`
- Create: `desktop/src/components/ConfigPanel.tsx`
- Create: `desktop/src/components/LogPanel.tsx`
- Create: `desktop/src/styles.css`

- [ ] **Step 1: Create `desktop/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Create `desktop/src/components/Sidebar.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `desktop/src/components/ControlPanel.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `desktop/src/components/ConfigPanel.tsx`**

```tsx
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
```

- [ ] **Step 5: Create `desktop/src/components/StatusPanel.tsx`**

```tsx
import { Gauge, ShieldCheck, TimerReset } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function StatusPanel({ probe }: { probe?: ProbeResult }) {
  const status = probe?.status;
  return (
    <section className="panel status-panel">
      <div className="panel-heading">
        <span>Telemetry</span>
        <strong>{probe ? `${probe.latencyMs}ms` : "not checked"}</strong>
      </div>
      <div className="status-grid">
        <Metric icon={<Gauge />} label="Core" value={status?.status ?? "offline"} />
        <Metric icon={<TimerReset />} label="Checked" value={probe?.checkedAt ? new Date(probe.checkedAt).toLocaleTimeString() : "never"} />
        <Metric icon={<ShieldCheck />} label="Service" value={status?.service ?? "cli_LH"} />
      </div>
      {probe?.error && <div className="inline-error">{probe.error}</div>}
      <div className="metadata-grid">
        <span>Host</span><strong>{status?.server?.host ?? "-"}</strong>
        <span>Port</span><strong>{status?.server?.port ?? "-"}</strong>
        <span>Config</span><strong title={status?.server?.configPath}>{status?.server?.configPath ?? "-"}</strong>
        <span>Auth dir</span><strong title={status?.server?.authDir}>{status?.server?.authDir ?? "-"}</strong>
        <span>Gemini keys</span><strong>{status?.providers?.geminiApiKeys ?? 0}</strong>
        <span>Codex keys</span><strong>{status?.providers?.codexApiKeys ?? 0}</strong>
        <span>Claude keys</span><strong>{status?.providers?.claudeApiKeys ?? 0}</strong>
        <span>OpenAI compat</span><strong>{status?.providers?.openaiCompatibilityEntries ?? 0}</strong>
      </div>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
```

- [ ] **Step 6: Create `desktop/src/components/LogPanel.tsx`**

```tsx
import { Trash2 } from "lucide-react";
import type { LogLine } from "../lib/sidecar";

export function LogPanel({ logs, onClear }: { logs: LogLine[]; onClear: () => void }) {
  return (
    <section className="panel log-panel" id="logs">
      <div className="panel-heading">
        <span>Process Stream</span>
        <button onClick={onClear}><Trash2 size={15} /> Clear</button>
      </div>
      <div className="log-stream">
        {logs.length === 0 ? (
          <p className="log-empty">No sidecar output yet.</p>
        ) : (
          logs.map((line, index) => (
            <div className={`log-line log-${line.source}`} key={`${line.timestamp}-${index}`}>
              <time>{new Date(line.timestamp).toLocaleTimeString()}</time>
              <span>{line.source}</span>
              <code>{line.message}</code>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Create `desktop/src/App.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfigPanel } from "./components/ConfigPanel";
import { ControlPanel } from "./components/ControlPanel";
import { LogPanel } from "./components/LogPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusPanel } from "./components/StatusPanel";
import { clearLogs, getSettings, getSidecarState, restartSidecar, saveSettings, startSidecar, stopSidecar, subscribeSidecarEvents, type LogLine, type SidecarState } from "./lib/sidecar";
import { probeSidecar, type ProbeResult } from "./lib/status";
import { defaultSettings, normalizeSettings, type DesktopSettings } from "./lib/storage";

export default function App() {
  const [settings, setSettings] = useState<DesktopSettings>(defaultSettings);
  const [state, setState] = useState<SidecarState>({ phase: "idle" });
  const [probe, setProbe] = useState<ProbeResult>();
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

  useEffect(() => {
    let cancelled = false;
    void getSettings().then((loaded) => {
      if (!cancelled) setSettings(normalizeSettings(loaded));
    });
    void getSidecarState().then((loaded) => {
      if (!cancelled) setState(loaded);
    });
    void subscribeSidecarEvents({ onState: setState, onLog: pushLog });
    return () => {
      cancelled = true;
    };
  }, [pushLog]);

  useEffect(() => {
    void refreshProbe();
    const timer = window.setInterval(() => void refreshProbe(), 2500);
    return () => window.clearInterval(timer);
  }, [refreshProbe]);

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
          <ConfigPanel settings={settings} onChange={setSettings} onSave={() => void runAction(async () => {
            const saved = await saveSettings(normalizedSettings);
            setSettings(saved);
            return { ...state, message: "Settings saved" };
          })} />
          <LogPanel logs={logs} onClear={() => {
            setLogs([]);
            void clearLogs();
          }} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Create `desktop/src/styles.css`**

Use a complete CSS file defining:

```css
:root {
  color: #edf7f4;
  background: #080d0f;
  font-family: "Bahnschrift", "Segoe UI", sans-serif;
  --bg: #080d0f;
  --panel: rgba(15, 24, 27, 0.86);
  --panel-strong: rgba(22, 36, 40, 0.94);
  --line: rgba(153, 255, 224, 0.14);
  --text-muted: #8aa5a0;
  --cyan: #3ee8ff;
  --green: #7dff9d;
  --amber: #ffbd4a;
  --red: #ff5f6d;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 960px; min-height: 100vh; background: radial-gradient(circle at top right, rgba(62, 232, 255, 0.12), transparent 32%), var(--bg); }
button, input { font: inherit; }
button { border: 1px solid var(--line); background: rgba(255,255,255,0.04); color: #edf7f4; border-radius: 12px; padding: 10px 14px; cursor: pointer; display: inline-flex; gap: 8px; align-items: center; }
button:hover:not(:disabled) { border-color: var(--cyan); box-shadow: 0 0 24px rgba(62,232,255,0.14); }
button:disabled { opacity: 0.45; cursor: not-allowed; }
button.primary { background: linear-gradient(135deg, rgba(62,232,255,0.22), rgba(125,255,157,0.16)); border-color: rgba(62,232,255,0.55); }
input { width: 100%; border: 1px solid var(--line); background: rgba(4,9,10,0.72); color: #edf7f4; border-radius: 12px; padding: 11px 12px; outline: none; }
input:focus { border-color: var(--cyan); }
.app-shell { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; }
.sidebar { border-right: 1px solid var(--line); padding: 26px 20px; background: rgba(5,10,12,0.78); display: flex; flex-direction: column; gap: 28px; }
.brand-mark { display: flex; gap: 12px; align-items: center; }
.brand-mark strong { display: block; font-size: 24px; letter-spacing: 0.08em; }
.brand-mark span, .topbar p, .panel-heading span, .field span { color: var(--text-muted); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
.phase-pill { border: 1px solid var(--line); border-radius: 999px; padding: 10px 12px; display: flex; gap: 8px; align-items: center; width: fit-content; }
.phase-dot { width: 9px; height: 9px; border-radius: 999px; background: var(--text-muted); }
.phase-ready .phase-dot, .phase-ready.gauge-ring { border-color: var(--green); color: var(--green); }
.phase-starting .phase-dot, .phase-starting.gauge-ring { border-color: var(--amber); color: var(--amber); }
.phase-error .phase-dot, .phase-error.gauge-ring { border-color: var(--red); color: var(--red); }
.nav-stack { display: grid; gap: 10px; }
.nav-stack a { color: #d7e7e3; text-decoration: none; display: flex; gap: 10px; align-items: center; padding: 12px; border-radius: 14px; border: 1px solid transparent; }
.nav-stack a:hover { border-color: var(--line); background: rgba(255,255,255,0.04); }
.dashboard { padding: 26px; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
.topbar h1 { margin: 4px 0 0; font-size: 34px; letter-spacing: -0.04em; }
.dashboard-grid { display: grid; grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr); gap: 18px; align-items: start; }
.panel { border: 1px solid var(--line); background: linear-gradient(180deg, var(--panel), rgba(7,13,15,0.88)); border-radius: 24px; padding: 20px; box-shadow: 0 18px 60px rgba(0,0,0,0.24); }
.panel-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.control-panel { min-height: 360px; }
.hero-gauge { display: grid; place-items: center; gap: 16px; text-align: center; padding: 18px 0; }
.gauge-ring { width: 180px; height: 180px; border: 2px solid var(--line); border-radius: 999px; display: grid; place-items: center; text-transform: uppercase; letter-spacing: 0.16em; background: radial-gradient(circle, rgba(255,255,255,0.08), transparent 65%); }
.button-row { display: flex; gap: 10px; flex-wrap: wrap; }
.inline-warning, .inline-error { border-radius: 14px; padding: 12px; margin: 12px 0; }
.inline-warning { color: var(--amber); background: rgba(255,189,74,0.08); border: 1px solid rgba(255,189,74,0.18); }
.inline-error { color: var(--red); background: rgba(255,95,109,0.08); border: 1px solid rgba(255,95,109,0.18); }
.status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.metric-card { border: 1px solid var(--line); border-radius: 18px; padding: 14px; display: grid; gap: 8px; background: rgba(255,255,255,0.035); }
.metric-card svg { color: var(--cyan); width: 20px; }
.metric-card span { color: var(--text-muted); font-size: 12px; }
.metric-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.metadata-grid { margin-top: 16px; display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 13px; }
.metadata-grid span { color: var(--text-muted); }
.metadata-grid strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field { display: grid; gap: 8px; margin-bottom: 14px; }
.toggle-grid { display: flex; gap: 16px; color: #c7d8d4; }
.log-panel { grid-column: 1 / -1; }
.log-stream { height: 320px; overflow: auto; border-radius: 16px; background: rgba(0,0,0,0.28); padding: 12px; font-family: "Cascadia Mono", Consolas, monospace; }
.log-empty { color: var(--text-muted); }
.log-line { display: grid; grid-template-columns: 88px 72px 1fr; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.log-line time { color: var(--text-muted); }
.log-line span { color: var(--cyan); text-transform: uppercase; }
.log-stderr span, .log-error span { color: var(--red); }
.log-line code { white-space: pre-wrap; color: #dff4ef; }
@media (max-width: 1120px) { .app-shell { grid-template-columns: 1fr; } .sidebar { position: static; } .dashboard-grid { grid-template-columns: 1fr; } body { min-width: 0; } }
```

- [ ] **Step 9: Build frontend**

Run:

```text
cd desktop; npm run build
```

Expected: PASS and `desktop/dist/` is generated.

- [ ] **Step 10: Commit React UI**

```text
git add desktop/src/main.tsx desktop/src/App.tsx desktop/src/styles.css desktop/src/components desktop/src/lib
git commit -m "feat(desktop): build cockpit dashboard UI"
```

---

### Task 4: Add Tauri Backend Process Manager

**Files:**
- Create: `desktop/src-tauri/Cargo.toml`
- Create: `desktop/src-tauri/build.rs`
- Create: `desktop/src-tauri/tauri.conf.json`
- Create: `desktop/src-tauri/src/main.rs`
- Create: `desktop/src-tauri/src/sidecar.rs`
- Create: `desktop/src-tauri/src/tray.rs`

- [ ] **Step 1: Create `desktop/src-tauri/Cargo.toml`**

```toml
[package]
name = "cli-lh-desktop"
version = "0.1.0"
description = "Desktop cockpit for cli_LH"
edition = "2021"

[lib]
name = "cli_lh_desktop_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-dialog = "2"
tauri-plugin-opener = "2"
```

- [ ] **Step 2: Create `desktop/src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 3: Create `desktop/src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "cli_LH Cockpit",
  "version": "0.1.0",
  "identifier": "com.cli-lh.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "cli_LH Cockpit",
        "width": 1280,
        "height": 820,
        "minWidth": 980,
        "minHeight": 680,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

- [ ] **Step 4: Create `desktop/src-tauri/src/sidecar.rs`**

```rust
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub binary_path: String,
    pub config_path: String,
    pub base_url: String,
    pub local_model: bool,
    pub auto_start: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            binary_path: String::new(),
            config_path: String::new(),
            base_url: "http://127.0.0.1:8317".to_string(),
            local_model: false,
            auto_start: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStateSnapshot {
    pub phase: String,
    pub pid: Option<u32>,
    pub message: Option<String>,
    pub started_at: Option<String>,
    pub stopped_at: Option<String>,
}

impl Default for SidecarStateSnapshot {
    fn default() -> Self {
        Self {
            phase: "idle".to_string(),
            pid: None,
            message: None,
            started_at: None,
            stopped_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LogLine {
    pub source: String,
    pub message: String,
    pub timestamp: String,
}

pub struct SidecarManager {
    child: Mutex<Option<Child>>,
    state: Mutex<SidecarStateSnapshot>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            state: Mutex::new(SidecarStateSnapshot::default()),
        }
    }

    fn set_state(&self, app: &AppHandle, state: SidecarStateSnapshot) -> Result<SidecarStateSnapshot, String> {
        let mut guard = self.state.lock().map_err(|_| "state lock poisoned".to_string())?;
        *guard = state.clone();
        let _ = app.emit("sidecar://state", state.clone());
        Ok(state)
    }

    fn emit_log(app: &AppHandle, source: &str, message: impl Into<String>) {
        let line = LogLine {
            source: source.to_string(),
            message: message.into(),
            timestamp: now_string(),
        };
        let event = match source {
            "stdout" => "sidecar://stdout",
            "stderr" => "sidecar://stderr",
            _ => "sidecar://error",
        };
        let _ = app.emit(event, line);
    }
}

#[tauri::command]
pub fn get_sidecar_state(manager: State<'_, SidecarManager>) -> Result<SidecarStateSnapshot, String> {
    manager.state.lock().map(|state| state.clone()).map_err(|_| "state lock poisoned".to_string())
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<DesktopSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(DesktopSettings::default());
    }
    let raw = fs::read_to_string(path).map_err(|err| format!("read settings: {err}"))?;
    serde_json::from_str(&raw).map_err(|err| format!("parse settings: {err}"))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: DesktopSettings) -> Result<DesktopSettings, String> {
    let normalized = normalize_settings(settings);
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("create settings dir: {err}"))?;
    }
    let raw = serde_json::to_string_pretty(&normalized).map_err(|err| format!("serialize settings: {err}"))?;
    fs::write(path, raw).map_err(|err| format!("write settings: {err}"))?;
    Ok(normalized)
}

#[tauri::command]
pub fn start_sidecar(app: AppHandle, manager: State<'_, SidecarManager>, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
    let settings = normalize_settings(settings);
    if settings.binary_path.is_empty() {
        return Err("cli_LH binary path is required".to_string());
    }
    if settings.config_path.is_empty() {
        return Err("config.yaml path is required".to_string());
    }

    {
        let child_guard = manager.child.lock().map_err(|_| "child lock poisoned".to_string())?;
        if child_guard.is_some() {
            return manager.state.lock().map(|state| state.clone()).map_err(|_| "state lock poisoned".to_string());
        }
    }

    manager.set_state(&app, SidecarStateSnapshot {
        phase: "starting".to_string(),
        message: Some("launching cli_LH".to_string()),
        started_at: Some(now_string()),
        ..SidecarStateSnapshot::default()
    })?;

    let mut command = Command::new(&settings.binary_path);
    command.arg("--config").arg(&settings.config_path);
    if settings.local_model {
        command.arg("--local-model");
    }
    command.stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::null());

    let mut child = command.spawn().map_err(|err| format!("start sidecar: {err}"))?;
    let pid = child.id();

    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                SidecarManager::emit_log(&app_clone, "stdout", line);
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                SidecarManager::emit_log(&app_clone, "stderr", line);
            }
        });
    }

    let mut child_guard = manager.child.lock().map_err(|_| "child lock poisoned".to_string())?;
    *child_guard = Some(child);

    manager.set_state(&app, SidecarStateSnapshot {
        phase: "starting".to_string(),
        pid: Some(pid),
        message: Some("process started; waiting for HTTP readiness".to_string()),
        started_at: Some(now_string()),
        stopped_at: None,
    })
}

#[tauri::command]
pub fn stop_sidecar(app: AppHandle, manager: State<'_, SidecarManager>) -> Result<SidecarStateSnapshot, String> {
    manager.set_state(&app, SidecarStateSnapshot {
        phase: "stopping".to_string(),
        message: Some("stopping sidecar".to_string()),
        ..manager.state.lock().map_err(|_| "state lock poisoned".to_string())?.clone()
    })?;

    let mut child_guard = manager.child.lock().map_err(|_| "child lock poisoned".to_string())?;
    if let Some(mut child) = child_guard.take() {
        child.kill().map_err(|err| format!("stop sidecar: {err}"))?;
        let _ = child.wait();
    }

    manager.set_state(&app, SidecarStateSnapshot {
        phase: "stopped".to_string(),
        pid: None,
        message: Some("sidecar stopped".to_string()),
        started_at: None,
        stopped_at: Some(now_string()),
    })
}

#[tauri::command]
pub fn restart_sidecar(app: AppHandle, manager: State<'_, SidecarManager>, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
    let _ = stop_sidecar(app.clone(), manager.clone());
    start_sidecar(app, manager, settings)
}

#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    Ok(())
}

fn normalize_settings(mut settings: DesktopSettings) -> DesktopSettings {
    settings.binary_path = settings.binary_path.trim().to_string();
    settings.config_path = settings.config_path.trim().to_string();
    settings.base_url = settings.base_url.trim().trim_end_matches('/').to_string();
    if settings.base_url.is_empty() {
        settings.base_url = "http://127.0.0.1:8317".to_string();
    }
    settings
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| format!("resolve app config dir: {err}"))?;
    Ok(dir.join("settings.json"))
}

fn now_string() -> String {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or_default();
    millis.to_string()
}
```

- [ ] **Step 5: Create `desktop/src-tauri/src/tray.rs`**

```rust
use tauri::{menu::{Menu, MenuItem}, tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent}, App, Manager};

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start Sidecar", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop Sidecar", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart Sidecar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &start, &stop, &restart, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {
                let _ = app.emit("sidecar://tray-action", event.id.as_ref());
            }
        })
        .build(app)?;

    Ok(())
}
```

- [ ] **Step 6: Create `desktop/src-tauri/src/main.rs`**

```rust
mod sidecar;
mod tray;

use sidecar::{clear_logs, get_settings, get_sidecar_state, restart_sidecar, save_settings, start_sidecar, stop_sidecar, SidecarManager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SidecarManager::new())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_sidecar_state,
            start_sidecar,
            stop_sidecar,
            restart_sidecar,
            clear_logs
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running cli_LH desktop cockpit");
}

fn main() {
    run();
}
```

- [ ] **Step 7: Check Rust availability**

Run:

```text
rustc --version
cargo --version
```

Expected in the current environment: commands may fail because Rust is not installed or not on PATH.

- [ ] **Step 8: If Rust is available, run Tauri checks**

Run:

```text
cd desktop/src-tauri; cargo check
```

Expected when Rust is installed: PASS.

- [ ] **Step 9: Commit Tauri backend**

```text
git add desktop/src-tauri
git commit -m "feat(desktop): add tauri sidecar manager"
```

---

### Task 5: Final Desktop Verification and Documentation

**Files:**
- Modify: `desktop/README.md`
- No Go code changes expected.

- [ ] **Step 1: Run frontend verification**

Run:

```text
cd desktop; npm run typecheck; npm run build
```

Expected: PASS.

- [ ] **Step 2: Run Go verification**

Run from repository root:

```text
go test ./...
go build -o test-output ./cmd/server
Remove-Item test-output -ErrorAction SilentlyContinue
```

Expected: PASS.

- [ ] **Step 3: Update `desktop/README.md` with verification status**

Append this Markdown content:

  ## Verification

  Frontend-only verification:

  ```text
  npm run typecheck
  npm run build
  ```

  Go core verification from repository root:

  ```text
  go test ./...
  go build -o test-output ./cmd/server
  ```

  Full Tauri verification requires Rust/Cargo:

  ```text
  cargo check
  npm run tauri dev
  ```

- [ ] **Step 4: Commit documentation update**

```text
git add desktop/README.md
git commit -m "docs(desktop): document verification workflow"
```

- [ ] **Step 5: Final status check**

Run:

```text
git status --short
git log -5 --oneline
```

Expected: clean working tree and recent desktop commits visible.

---

## Self-Review

- Spec coverage:
  - `desktop/` isolated project: Tasks 1-4.
  - React cockpit UI: Task 3.
  - Tauri commands and events: Tasks 2 and 4.
  - Sidecar lifecycle management: Task 4.
  - Tray actions: Task 4.
  - Node-only partial verification: Tasks 1, 3, 5.
  - Rust requirement documentation: Tasks 1 and 5.
  - Go independence: Task 5.
- Placeholder scan:
  - The plan contains no incomplete `TBD` or vague implementation-only steps.
- Type consistency:
  - `DesktopSettings`, `SidecarState`, `LogLine`, and command names match between TypeScript and Rust sections.
- Scope:
  - The plan intentionally stops at lifecycle/status/logs and does not include account dashboards or quota analytics.
