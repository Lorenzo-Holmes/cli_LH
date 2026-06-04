# Desktop Next Stage Design

## Context

The repository now contains a first-party `desktop/` Tauri 2 + React shell for controlling a local `cli_LH` sidecar. The current shell can start, stop, and restart the Go binary, persist launch settings, browse for binary/config paths, auto-detect likely launch profiles, stream logs, update tray tooltip state, and run frontend plus Tauri checks in CI.

The next stage should turn the shell from a reference MVP into a more complete cockpit-style local control application while keeping the Go proxy core independent from desktop dependencies.

## Goals

1. Improve sidecar process reliability and lifecycle accuracy.
2. Close the core desktop product loop around setup, diagnostics, and recovery.
3. Make tray actions reflect the actual sidecar phase.
4. Define and document the packaging/distribution path.
5. Reserve a controlled extension point for custom follow-up cockpit capabilities.

## Non-Goals

- Do not copy code, assets, layouts, or branding from `cockpit-tools`.
- Do not move Tauri, React, Node, npm, Rust, or Cargo dependencies into the Go core.
- Do not rewrite the Go proxy service or provider runtime as part of this stage.
- Do not expose or persist provider secrets in frontend-local storage.
- Do not require management APIs beyond the existing safe local sidecar contract.
- Do not claim local native Tauri compilation passes when Rust/Cargo are unavailable.

## Recommended Execution Order

### Phase 1: Process Reliability

This phase should happen first because all later cockpit features depend on accurate lifecycle state.

Add validation and state handling around sidecar launch:

- Verify binary path is non-empty, exists, and is a file before spawning.
- Verify config path is non-empty, exists, and is a file before spawning.
- Detect likely port conflicts before launch using the configured `baseUrl` host/port.
- Track process exit in a background watcher and transition to `stopped` or `error` when the child exits unexpectedly.
- Prefer graceful termination where available, then force kill as a fallback.
- Keep `starting`, `ready`, `stopping`, `stopped`, and `error` transitions explicit and explainable in the UI log.

The Rust backend remains the authoritative owner of process lifecycle. React may probe HTTP readiness, but it should not invent irreversible process state without backend confirmation.

### Phase 2: Product Loop

After reliability is improved, add user-facing setup and recovery tools:

- A first-run/setup section that highlights required launch fields and offers auto-detect plus browse actions.
- Inline preflight diagnostics showing binary, config, base URL, and port status.
- Health detail display for `/healthz` and `/statusz`, including clear unavailable/parse-failure states.
- Error recovery suggestions derived from known failures:
  - missing binary
  - missing config
  - port already in use
  - spawn failure
  - readiness timeout
  - status endpoint unavailable
- Convenience actions:
  - open management page in browser when the sidecar is reachable
  - reveal selected config file
  - reveal selected binary parent directory

This is still a local operations cockpit, not a full account, billing, or quota dashboard.

### Phase 3: Tray Menu State

Improve tray behavior so it is useful without opening the main window:

- Keep tooltip synchronized with sidecar phase and key message.
- Disable or no-op `Start` when already starting/ready.
- Disable or no-op `Stop` when idle/stopped/error without a child.
- Keep `Restart` enabled only when a valid launch profile exists.
- Add menu actions for:
  - Show Window
  - Open UI / Management Page
  - Open Config Location
  - Open Logs or App Data Directory
  - Start Sidecar
  - Stop Sidecar
  - Restart Sidecar
  - Quit

Tauri menu item enablement should be synchronized from Rust state changes where the API supports it. If API support is uncertain, the fallback is to keep items enabled but enforce state-aware no-op behavior and log a clear message.

### Phase 4: Packaging and Distribution

Define how users get a working desktop app:

- Document local development prerequisites.
- Document CI native verification.
- Document expected release artifact shape.
- Decide whether `cli_LH` is:
  - bundled as a Tauri resource,
  - placed next to the desktop executable,
  - or selected by the user on first run.
- For the next implementation, prefer user-selected or side-by-side binary discovery because it avoids coupling desktop packaging to Go release artifacts before CI proves native bundling.
- Add a packaging document under `docs/` or `desktop/` describing Windows-oriented release steps.

Actual installer generation should be gated by Rust/Cargo availability in CI and should not be claimed as locally verified on this machine.

### Phase 5: Custom Extension Point

Reserve one explicitly scoped area for future cockpit features selected by the user. Candidate examples:

- request activity overview from existing safe APIs
- provider/model summary view
- config snapshot viewer
- OAuth/account action shortcuts
- compact floating status window

This phase should not begin until Phases 1-4 produce a stable local shell.

## Architecture

```text
React Cockpit UI
  | invokes commands / listens to events
  v
Rust Tauri Backend
  | validates paths, checks port, owns child lifecycle, emits state/logs
  v
cli_LH Go Sidecar
  | localhost HTTP probes
  v
/healthz /statusz / management page when available
```

### Rust Backend Responsibilities

- Launch profile validation.
- Port conflict check from `baseUrl`.
- Child process start/stop/restart.
- Exit watcher and state transitions.
- Settings persistence.
- Tray menu state and native open/reveal operations.

### React Frontend Responsibilities

- Render cockpit state.
- Present preflight diagnostics and recovery suggestions.
- Call Tauri commands for privileged operations.
- Probe read-only HTTP endpoints for details.
- Avoid direct native filesystem/process operations.

### Go Core Responsibilities

- Continue exposing `cli_LH --config <path>` and optional `--local-model`.
- Continue exposing `/healthz` and `/statusz`.
- Stay independent from desktop dependencies.

## Data Model Additions

Add a preflight model shared between Rust and React:

```ts
type PreflightSeverity = "ok" | "warning" | "error";

type PreflightCheck = {
  id: string;
  label: string;
  severity: PreflightSeverity;
  message: string;
  suggestion?: string;
};

type PreflightReport = {
  canStart: boolean;
  checks: PreflightCheck[];
};
```

Add optional state metadata:

```ts
type SidecarState = {
  phase: SidecarPhase;
  pid?: number;
  message?: string;
  startedAt?: string;
  stoppedAt?: string;
  exitCode?: number;
};
```

## Command Surface Additions

Add Tauri commands as needed:

- `validate_launch_profile(settings) -> PreflightReport`
- `open_management_page(settings) -> ()`
- `reveal_config_path(settings) -> ()`
- `reveal_binary_path(settings) -> ()`
- `open_app_data_dir() -> ()`

Existing commands remain:

- `get_settings`
- `save_settings`
- `get_sidecar_state`
- `start_sidecar`
- `stop_sidecar`
- `restart_sidecar`
- `clear_logs`
- `discover_launch_profile`

## UI Changes

The single dashboard can remain, but it should gain clearer sections:

1. Control Panel
   - current phase
   - primary action
   - process metadata
   - known recovery suggestion
2. Launch Profile
   - binary/config/base URL/local model/auto-start
   - browse and auto-detect
   - save
3. Preflight Diagnostics
   - binary check
   - config check
   - base URL parse check
   - port availability check
4. Health Details
   - `/healthz` status
   - `/statusz` metadata
   - last probe timestamp
5. Logs
   - stdout/stderr/system logs
   - lifecycle state messages

## Error Handling

Errors should be structured enough for the UI to show a specific action:

- Missing binary: prompt Browse or Auto-detect.
- Binary not found: reveal parent if possible or browse again.
- Missing config: prompt Browse or Auto-detect.
- Config not found: reveal parent if possible or browse again.
- Invalid base URL: show expected `http://host:port` format.
- Port in use: suggest changing config/base URL or stopping the other process.
- Spawn failure: show OS error without leaking secrets.
- Unexpected exit: show exit code if available and keep recent logs visible.

## Testing and Verification

Frontend changes:

- `npm --prefix desktop run typecheck`
- `npm --prefix desktop run build`

Go isolation:

- `go build -o test-output ./cmd/server`, then remove `test-output`
- Run `go test ./...` when Go code changes or sidecar contract behavior is touched.

Native Tauri checks:

- Local `npm --prefix desktop run tauri:check` only when Rust/Cargo are installed.
- CI `.github/workflows/desktop-check.yml` remains the authoritative native check until local Rust/Cargo are available.

## Risks and Mitigations

- Tauri menu APIs may differ across platforms.
  - Mitigation: keep menu actions safe even if dynamic enablement is limited.
- Port conflict checks can race with process start.
  - Mitigation: use preflight as advisory and still handle spawn/readiness failure.
- Windows graceful stop behavior can be limited.
  - Mitigation: document fallback to force kill for this stage.
- Packaging may require CI-only validation.
  - Mitigation: document packaging path before claiming installer success.

## Acceptance Criteria

- Users can see why the sidecar cannot start before pressing Start.
- Missing binary/config and port conflicts produce actionable messages.
- Unexpected sidecar exits update UI/tray state without requiring manual refresh.
- Tray actions are phase-aware or safely no-op with clear logs.
- Packaging strategy is documented without falsely claiming local native validation.
- All desktop changes remain isolated under `desktop/` plus docs/CI files.
