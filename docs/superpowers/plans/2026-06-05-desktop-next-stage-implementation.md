# Desktop Next Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the `desktop/` cockpit from an MVP sidecar launcher into a more reliable local operations shell with preflight diagnostics, recovery actions, phase-aware tray behavior, and packaging documentation.

**Architecture:** Keep all runtime changes isolated to `desktop/`. Rust/Tauri owns launch validation, process lifecycle, native open/reveal operations, tray synchronization, and app-data paths. React renders diagnostics, recovery actions, health details, and calls Tauri commands through typed wrappers.

**Tech Stack:** React 18, TypeScript, Vite, Tauri 2, Rust, npm, existing Go `cli_LH` sidecar contract.

---

## File Structure

- Modify `desktop/src-tauri/src/sidecar.rs`: add launch preflight checks, port parsing/checking, exit watcher, reveal/open commands, and richer state metadata.
- Modify `desktop/src-tauri/src/lib.rs`: register new Tauri commands.
- Modify `desktop/src-tauri/src/tray.rs`: synchronize tray tooltip/menu behavior with sidecar state and add open/reveal actions.
- Modify `desktop/src/lib/sidecar.ts`: add frontend types/wrappers for preflight and native open/reveal commands.
- Modify `desktop/src/App.tsx`: load/run preflight checks, wire recovery actions, pass diagnostics to UI components.
- Modify `desktop/src/components/ConfigPanel.tsx`: show first-run/setup cues and inline launch-profile actions.
- Create `desktop/src/components/PreflightPanel.tsx`: render preflight diagnostics.
- Modify `desktop/src/components/ControlPanel.tsx`: show state metadata and actionable recovery suggestions.
- Modify `desktop/src/components/StatusPanel.tsx`: clarify health/status unavailable and parse-failure states.
- Modify `desktop/src/styles.css`: style diagnostics, recovery actions, and cockpit layout additions.
- Create `desktop/PACKAGING.md`: document local/CI native verification and Windows packaging strategy.
- Modify `desktop/README.md`: link packaging doc and next-stage diagnostics behavior.

---

### Task 1: Add Launch Preflight Types and Backend Validation

**Files:**
- Modify: `desktop/src-tauri/src/sidecar.rs`
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src/lib/sidecar.ts`

- [ ] **Step 1: Add Rust preflight structs in `desktop/src-tauri/src/sidecar.rs`**

Add these structs after `LogLine`:

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightCheck {
    pub id: String,
    pub label: String,
    pub severity: String,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightReport {
    pub can_start: bool,
    pub checks: Vec<PreflightCheck>,
}
```

- [ ] **Step 2: Add validation helper functions in `desktop/src-tauri/src/sidecar.rs`**

Add these functions near `normalize_settings`:

```rust
fn check_file_path(id: &str, label: &str, value: &str, missing_message: &str, missing_suggestion: &str) -> PreflightCheck {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return PreflightCheck {
            id: id.to_string(),
            label: label.to_string(),
            severity: "error".to_string(),
            message: missing_message.to_string(),
            suggestion: Some(missing_suggestion.to_string()),
        };
    }

    let path = PathBuf::from(trimmed);
    if path.is_file() {
        return PreflightCheck {
            id: id.to_string(),
            label: label.to_string(),
            severity: "ok".to_string(),
            message: format!("{label} exists"),
            suggestion: None,
        };
    }

    PreflightCheck {
        id: id.to_string(),
        label: label.to_string(),
        severity: "error".to_string(),
        message: format!("{label} was not found at {trimmed}"),
        suggestion: Some(format!("Choose an existing {label} path or run Auto-detect.")),
    }
}

fn parse_base_url_host_port(base_url: &str) -> Result<(String, u16), String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let without_scheme = trimmed.strip_prefix("http://").or_else(|| trimmed.strip_prefix("https://"))
        .ok_or_else(|| "Base URL must start with http:// or https://".to_string())?;
    let authority = without_scheme.split('/').next().unwrap_or_default();
    let authority = authority.rsplit('@').next().unwrap_or(authority);

    let (host, port_text) = if authority.starts_with('[') {
        let end = authority.find(']').ok_or_else(|| "IPv6 host is missing closing bracket".to_string())?;
        let host = authority[1..end].to_string();
        let rest = &authority[end + 1..];
        let port = rest.strip_prefix(':').ok_or_else(|| "Base URL must include an explicit port".to_string())?;
        (host, port.to_string())
    } else {
        let (host, port) = authority.rsplit_once(':').ok_or_else(|| "Base URL must include an explicit port".to_string())?;
        (host.to_string(), port.to_string())
    };

    if host.trim().is_empty() {
        return Err("Base URL host is empty".to_string());
    }
    let port = port_text.parse::<u16>().map_err(|_| "Base URL port must be between 1 and 65535".to_string())?;
    Ok((host, port))
}

fn check_base_url(base_url: &str) -> PreflightCheck {
    match parse_base_url_host_port(base_url) {
        Ok((host, port)) => PreflightCheck {
            id: "baseUrl".to_string(),
            label: "Base URL".to_string(),
            severity: "ok".to_string(),
            message: format!("Base URL points to {host}:{port}"),
            suggestion: None,
        },
        Err(err) => PreflightCheck {
            id: "baseUrl".to_string(),
            label: "Base URL".to_string(),
            severity: "error".to_string(),
            message: err,
            suggestion: Some("Use a URL such as http://127.0.0.1:8317.".to_string()),
        },
    }
}

fn check_port_available(base_url: &str) -> PreflightCheck {
    let (host, port) = match parse_base_url_host_port(base_url) {
        Ok(parsed) => parsed,
        Err(err) => {
            return PreflightCheck {
                id: "port".to_string(),
                label: "Port".to_string(),
                severity: "warning".to_string(),
                message: format!("Port check skipped: {err}"),
                suggestion: Some("Fix the Base URL before starting the sidecar.".to_string()),
            };
        }
    };

    match std::net::TcpStream::connect((host.as_str(), port)) {
        Ok(_) => PreflightCheck {
            id: "port".to_string(),
            label: "Port".to_string(),
            severity: "warning".to_string(),
            message: format!("{host}:{port} is already accepting connections"),
            suggestion: Some("If cli_LH is already running, use Probe now. Otherwise stop the process using this port or change the configured port.".to_string()),
        },
        Err(_) => PreflightCheck {
            id: "port".to_string(),
            label: "Port".to_string(),
            severity: "ok".to_string(),
            message: format!("{host}:{port} appears available"),
            suggestion: None,
        },
    }
}

fn build_preflight_report(settings: DesktopSettings) -> PreflightReport {
    let normalized = normalize_settings(settings);
    let checks = vec![
        check_file_path(
            "binaryPath",
            "Binary",
            &normalized.binary_path,
            "cli_LH binary path is required",
            "Choose cli_LH.exe or run Auto-detect.",
        ),
        check_file_path(
            "configPath",
            "Config",
            &normalized.config_path,
            "config.yaml path is required",
            "Choose config.yaml or run Auto-detect.",
        ),
        check_base_url(&normalized.base_url),
        check_port_available(&normalized.base_url),
    ];
    let can_start = checks.iter().all(|check| check.severity != "error");
    PreflightReport { can_start, checks }
}
```

- [ ] **Step 3: Add `validate_launch_profile` command in `desktop/src-tauri/src/sidecar.rs`**

Add this command near `discover_launch_profile`:

```rust
#[tauri::command]
pub fn validate_launch_profile(settings: DesktopSettings) -> Result<PreflightReport, String> {
    Ok(build_preflight_report(settings))
}
```

- [ ] **Step 4: Use preflight in `SidecarManager::start`**

Replace the initial empty-path checks in `start` with:

```rust
let settings = normalize_settings(settings);
let preflight = build_preflight_report(settings.clone());
if !preflight.can_start {
    let message = preflight.checks.iter()
        .find(|check| check.severity == "error")
        .map(|check| check.message.clone())
        .unwrap_or_else(|| "launch profile is not ready".to_string());
    return Err(message);
}
```

- [ ] **Step 5: Register the command in `desktop/src-tauri/src/lib.rs`**

Add `validate_launch_profile` to the imported commands and to `tauri::generate_handler![...]`.

- [ ] **Step 6: Add TypeScript types and wrapper in `desktop/src/lib/sidecar.ts`**

Add:

```ts
export type PreflightSeverity = "ok" | "warning" | "error";

export type PreflightCheck = {
  id: string;
  label: string;
  severity: PreflightSeverity;
  message: string;
  suggestion?: string;
};

export type PreflightReport = {
  canStart: boolean;
  checks: PreflightCheck[];
};

export async function validateLaunchProfile(settings: DesktopSettings): Promise<PreflightReport> {
  if (!isTauriRuntime()) {
    const normalized = normalizeSettings(settings);
    const checks: PreflightCheck[] = [
      {
        id: "binaryPath",
        label: "Binary",
        severity: normalized.binaryPath ? "warning" : "error",
        message: normalized.binaryPath ? "Browser preview cannot verify local binary paths" : "cli_LH binary path is required",
        suggestion: "Run inside Tauri to verify the file path.",
      },
      {
        id: "configPath",
        label: "Config",
        severity: normalized.configPath ? "warning" : "error",
        message: normalized.configPath ? "Browser preview cannot verify local config paths" : "config.yaml path is required",
        suggestion: "Run inside Tauri to verify the file path.",
      },
      {
        id: "baseUrl",
        label: "Base URL",
        severity: normalized.baseUrl.startsWith("http") ? "ok" : "error",
        message: normalized.baseUrl.startsWith("http") ? `Base URL is ${normalized.baseUrl}` : "Base URL must start with http:// or https://",
        suggestion: "Use a URL such as http://127.0.0.1:8317.",
      },
    ];
    return { canStart: checks.every((check) => check.severity !== "error"), checks };
  }
  return invoke<PreflightReport>("validate_launch_profile", { settings: normalizeSettings(settings) });
}
```

- [ ] **Step 7: Run available verification**

Run: `npm --prefix desktop run typecheck`

Expected: TypeScript exits 0.

- [ ] **Step 8: Commit Task 1**

Run:

```text
git add desktop/src-tauri/src/sidecar.rs desktop/src-tauri/src/lib.rs desktop/src/lib/sidecar.ts
git commit -m "feat(desktop): add launch preflight validation"
```

---

### Task 2: Render Preflight Diagnostics in the React UI

**Files:**
- Create: `desktop/src/components/PreflightPanel.tsx`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/styles.css`

- [ ] **Step 1: Create `desktop/src/components/PreflightPanel.tsx`**

```tsx
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { PreflightReport, PreflightSeverity } from "../lib/sidecar";

type PreflightPanelProps = {
  report?: PreflightReport;
  onRefresh: () => void;
};

function iconFor(severity: PreflightSeverity) {
  if (severity === "ok") return <CheckCircle2 size={16} />;
  if (severity === "warning") return <AlertTriangle size={16} />;
  return <Info size={16} />;
}

export function PreflightPanel({ report, onRefresh }: PreflightPanelProps) {
  return (
    <section className="panel preflight-panel">
      <div className="panel-heading">
        <div>
          <p>SETUP PREFLIGHT</p>
          <h2>Launch readiness</h2>
        </div>
        <button onClick={onRefresh}>Recheck</button>
      </div>
      {!report ? (
        <p className="muted">Run preflight to check binary, config, base URL, and port readiness.</p>
      ) : (
        <div className="preflight-list">
          {report.checks.map((check) => (
            <article className={`preflight-check ${check.severity}`} key={check.id}>
              <span className="preflight-icon">{iconFor(check.severity)}</span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.message}</p>
                {check.suggestion ? <small>{check.suggestion}</small> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire preflight state in `desktop/src/App.tsx`**

Import `PreflightPanel`, `validateLaunchProfile`, and `type PreflightReport`. Add state:

```ts
const [preflight, setPreflight] = useState<PreflightReport>();
```

Add function:

```ts
const refreshPreflight = useCallback(async () => {
  const result = await validateLaunchProfile(normalizedSettings);
  setPreflight(result);
}, [normalizedSettings]);
```

Add effect:

```ts
useEffect(() => {
  void refreshPreflight();
}, [refreshPreflight]);
```

Render `<PreflightPanel report={preflight} onRefresh={() => void refreshPreflight()} />` in the dashboard grid after `ConfigPanel`.

- [ ] **Step 3: Add styles in `desktop/src/styles.css`**

Add:

```css
.preflight-panel {
  grid-column: span 2;
}

.preflight-list {
  display: grid;
  gap: 0.75rem;
}

.preflight-check {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  padding: 0.85rem;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.58);
}

.preflight-check.ok {
  border-color: rgba(34, 197, 94, 0.35);
}

.preflight-check.warning {
  border-color: rgba(245, 158, 11, 0.45);
}

.preflight-check.error {
  border-color: rgba(248, 113, 113, 0.5);
}

.preflight-icon {
  color: var(--accent-cyan);
  margin-top: 0.15rem;
}

.preflight-check.ok .preflight-icon {
  color: var(--accent-green);
}

.preflight-check.warning .preflight-icon,
.preflight-check.error .preflight-icon {
  color: var(--accent-amber);
}

.preflight-check p {
  margin: 0.2rem 0;
}

.preflight-check small {
  color: var(--text-muted);
}
```

- [ ] **Step 4: Run verification**

Run:

```text
npm --prefix desktop run typecheck
npm --prefix desktop run build
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit Task 2**

Run:

```text
git add desktop/src/App.tsx desktop/src/components/PreflightPanel.tsx desktop/src/styles.css
git commit -m "feat(desktop): show launch preflight diagnostics"
```

---

### Task 3: Add Native Recovery/Open Actions

**Files:**
- Modify: `desktop/src-tauri/src/sidecar.rs`
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src/lib/sidecar.ts`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/components/ConfigPanel.tsx`

- [ ] **Step 1: Add native open/reveal commands in `desktop/src-tauri/src/sidecar.rs`**

Add:

```rust
fn open_path(app: &AppHandle, path: PathBuf) -> Result<(), String> {
    app.opener().open_path(path.to_string_lossy().to_string(), None::<&str>)
        .map_err(|err| format!("open path: {err}"))
}

#[tauri::command]
pub fn open_management_page(app: AppHandle, settings: DesktopSettings) -> Result<(), String> {
    let normalized = normalize_settings(settings);
    app.opener().open_url(normalized.base_url, None::<&str>)
        .map_err(|err| format!("open management page: {err}"))
}

#[tauri::command]
pub fn reveal_config_path(app: AppHandle, settings: DesktopSettings) -> Result<(), String> {
    let normalized = normalize_settings(settings);
    let path = PathBuf::from(normalized.config_path);
    let target = if path.is_file() { path.parent().map(|parent| parent.to_path_buf()).unwrap_or(path) } else { path };
    open_path(&app, target)
}

#[tauri::command]
pub fn reveal_binary_path(app: AppHandle, settings: DesktopSettings) -> Result<(), String> {
    let normalized = normalize_settings(settings);
    let path = PathBuf::from(normalized.binary_path);
    let target = if path.is_file() { path.parent().map(|parent| parent.to_path_buf()).unwrap_or(path) } else { path };
    open_path(&app, target)
}

#[tauri::command]
pub fn open_app_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|err| format!("resolve app config dir: {err}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|err| format!("create app config dir: {err}"))?;
    }
    open_path(&app, dir)
}
```

- [ ] **Step 2: Register commands in `desktop/src-tauri/src/lib.rs`**

Add imports and handler entries for:

- `open_management_page`
- `reveal_config_path`
- `reveal_binary_path`
- `open_app_data_dir`

- [ ] **Step 3: Add wrappers in `desktop/src/lib/sidecar.ts`**

Add:

```ts
export async function openManagementPage(settings: DesktopSettings): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(normalizeSettings(settings).baseUrl, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke("open_management_page", { settings: normalizeSettings(settings) });
}

export async function revealConfigPath(settings: DesktopSettings): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("reveal_config_path", { settings: normalizeSettings(settings) });
}

export async function revealBinaryPath(settings: DesktopSettings): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("reveal_binary_path", { settings: normalizeSettings(settings) });
}

export async function openAppDataDir(): Promise<void> {
  if (!isTauriRuntime()) return;
  return invoke("open_app_data_dir");
}
```

- [ ] **Step 4: Wire actions in `desktop/src/App.tsx` and `ConfigPanel.tsx`**

Pass callbacks to `ConfigPanel`:

- `onOpenManagement`
- `onRevealConfig`
- `onRevealBinary`
- `onOpenAppData`

Render buttons in `ConfigPanel` actions area:

- `Open UI`
- `Reveal binary`
- `Reveal config`
- `Open app data`

- [ ] **Step 5: Run verification**

Run:

```text
npm --prefix desktop run typecheck
npm --prefix desktop run build
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit Task 3**

Run:

```text
git add desktop/src-tauri/src/sidecar.rs desktop/src-tauri/src/lib.rs desktop/src/lib/sidecar.ts desktop/src/App.tsx desktop/src/components/ConfigPanel.tsx
git commit -m "feat(desktop): add recovery open actions"
```

---

### Task 4: Track Unexpected Sidecar Exit

**Files:**
- Modify: `desktop/src-tauri/src/sidecar.rs`
- Modify: `desktop/src/lib/sidecar.ts`

- [ ] **Step 1: Add `exit_code` to Rust state**

Add `pub exit_code: Option<i32>` to `SidecarStateSnapshot` and set it to `None` in default/start/stop states.

- [ ] **Step 2: Change `SidecarManager.child` to store shared child**

Change:

```rust
child: Mutex<Option<Child>>,
```

to:

```rust
child: std::sync::Arc<Mutex<Option<Child>>>,
```

Update `new()` accordingly.

- [ ] **Step 3: Spawn an exit watcher after child is stored**

After storing the child in `start`, spawn a thread that periodically locks the child, calls `try_wait()`, and when it sees an exit status, clears the child and emits a `stopped` or `error` state with `exit_code`.

Use this exact behavior:

- exit code `0`: phase `stopped`, message `sidecar exited`
- non-zero or signal: phase `error`, message `sidecar exited unexpectedly`
- emit a system log line with the exit code

- [ ] **Step 4: Update frontend state type in `desktop/src/lib/sidecar.ts`**

Add:

```ts
exitCode?: number;
```

to `SidecarState`.

- [ ] **Step 5: Display exit code in `ControlPanel.tsx`**

If `state.exitCode !== undefined`, render a metadata row with label `Exit code`.

- [ ] **Step 6: Run verification**

Run:

```text
npm --prefix desktop run typecheck
npm --prefix desktop run build
```

Expected: both commands exit 0.

If Rust/Cargo are available, run:

```text
npm --prefix desktop run tauri:check
```

Expected: exits 0. If Rust/Cargo are unavailable, record that CI will validate Rust.

- [ ] **Step 7: Commit Task 4**

Run:

```text
git add desktop/src-tauri/src/sidecar.rs desktop/src/lib/sidecar.ts desktop/src/components/ControlPanel.tsx
git commit -m "feat(desktop): track sidecar process exits"
```

---

### Task 5: Make Tray Actions Phase-Aware

**Files:**
- Modify: `desktop/src-tauri/src/tray.rs`
- Modify: `desktop/src-tauri/src/sidecar.rs`

- [ ] **Step 1: Add safe phase predicates in `tray.rs`**

Add helpers:

```rust
fn can_start(phase: &str) -> bool {
    matches!(phase, "idle" | "stopped" | "error")
}

fn can_stop(phase: &str) -> bool {
    matches!(phase, "starting" | "ready")
}

fn can_restart(phase: &str) -> bool {
    matches!(phase, "ready" | "error" | "stopped")
}
```

- [ ] **Step 2: Update `sync_tray_state` tooltip and menu items**

Keep tooltip format:

```rust
cli_LH Cockpit: {phase}
```

If Tauri exposes menu item lookup in the current API, set enabled state for `start`, `stop`, and `restart` using the helpers. If the API is unavailable locally, do not force a compile-unknown implementation; keep action handlers state-aware in Step 3.

- [ ] **Step 3: Guard tray action handlers**

Before `start`, `stop`, and `restart` actions call the manager, inspect `manager.current_state()` and no-op when the phase is not allowed. Emit `sidecar://tray-action` with messages like `start-disabled`, `stop-disabled`, or `restart-disabled`.

- [ ] **Step 4: Add Open UI and Open App Data menu entries**

Add menu items:

- `open-ui`: opens saved `baseUrl` through `open_management_page`
- `open-app-data`: opens app config dir through `open_app_data_dir`

- [ ] **Step 5: Run verification**

Run:

```text
npm --prefix desktop run typecheck
npm --prefix desktop run build
```

If Rust/Cargo are available, run `npm --prefix desktop run tauri:check`; otherwise rely on CI for Rust validation.

- [ ] **Step 6: Commit Task 5**

Run:

```text
git add desktop/src-tauri/src/tray.rs desktop/src-tauri/src/sidecar.rs
git commit -m "feat(desktop): make tray actions phase aware"
```

---

### Task 6: Document Packaging and Distribution Strategy

**Files:**
- Create: `desktop/PACKAGING.md`
- Modify: `desktop/README.md`

- [ ] **Step 1: Create `desktop/PACKAGING.md`**

Include these sections:

- Current verification levels
- Local Windows prerequisites
- CI native verification
- Recommended binary placement for next release
- Tauri bundle commands
- What is not yet locally verified

State that the next release should prefer side-by-side or user-selected `cli_LH.exe` until bundled-resource packaging is validated in CI.

- [ ] **Step 2: Link from `desktop/README.md`**

Add a `Packaging` section linking `PACKAGING.md`.

- [ ] **Step 3: Run docs verification**

Run:

```text
git diff --check
```

Expected: exits 0.

- [ ] **Step 4: Commit Task 6**

Run:

```text
git add desktop/PACKAGING.md desktop/README.md
git commit -m "docs(desktop): document packaging strategy"
```

---

### Task 7: Final Verification and Push

**Files:**
- All changed files from Tasks 1-6.

- [ ] **Step 1: Run frontend checks**

Run:

```text
npm --prefix desktop run typecheck
npm --prefix desktop run build
```

Expected: both commands exit 0.

- [ ] **Step 2: Run Go isolation build**

Run:

```text
go build -o test-output ./cmd/server
Remove-Item test-output
```

Expected: build exits 0 and `test-output` is removed.

- [ ] **Step 3: Run Go tests if Go files changed**

Run `go test ./...` only if this plan changes Go files outside `desktop/`. Expected: exits 0.

- [ ] **Step 4: Run native Tauri check when possible**

Run:

```text
rustc --version
cargo --version
npm --prefix desktop run tauri:check
```

Expected if Rust/Cargo are installed: all exit 0.

Expected on the current machine if Rust/Cargo are still unavailable: record that native check is CI-only and do not claim local native success.

- [ ] **Step 5: Push main**

Run:

```text
git push
git status --short
```

Expected: push succeeds and working tree is clean.
