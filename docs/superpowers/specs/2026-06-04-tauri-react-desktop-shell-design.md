# Tauri React Desktop Shell Design

## Context

`cli_LH` is currently a Go proxy core with a documented sidecar contract. The previous contract intentionally kept desktop shells outside this repository. The product direction has now changed: this repository will include a first-party reference desktop shell while keeping the Go core independent from Node.js, React, Rust, and Tauri.

This design supersedes the previous repository-scope non-goal only for the new `desktop/` subtree. It does not merge desktop concerns into `cmd/server`, `internal/api`, `internal/runtime`, or the Go SDK.

## Goal

Create a first-party `desktop/` application, similar in shape to cockpit-style control panels, that provides a native desktop UI, tray controls, and process lifecycle management for the local `cli_LH` sidecar.

## Non-Goals

- Do not copy code, UI assets, branding, layouts, or implementation details from `cockpit-tools`.
- Do not make the Go core depend on Tauri, React, Node.js, npm, Rust, or Cargo.
- Do not replace the existing CLI, TUI, SDK, HTTP APIs, or Go service startup paths.
- Do not require the desktop app to enable unauthenticated management APIs.
- Do not implement full account/quota dashboards in the first version.
- Do not store provider secrets in frontend local storage.

## Product Shape

The desktop shell is a local control cockpit for `cli_LH`:

- Start, stop, and restart the sidecar process.
- Select the `cli_LH` binary path.
- Select the `config.yaml` path.
- Optionally pass `--local-model`.
- Probe `/healthz` and `/statusz`.
- Display safe status metadata.
- Stream child stdout and stderr into a log console.
- Expose tray actions for show, start, stop, restart, and quit.

The first version is intentionally a sidecar lifecycle and observability cockpit. Account management, quota analytics, OAuth UI wrappers, config editors, and request dashboards can be added later after the lifecycle foundation is stable.

## Repository Layout

```text
desktop/
  package.json
  package-lock.json
  index.html
  tsconfig.json
  vite.config.ts
  src/
    main.tsx
    App.tsx
    styles.css
    components/
      ControlPanel.tsx
      ConfigPanel.tsx
      LogPanel.tsx
      Sidebar.tsx
      StatusPanel.tsx
    lib/
      sidecar.ts
      status.ts
      storage.ts
  src-tauri/
    Cargo.toml
    build.rs
    tauri.conf.json
    src/
      main.rs
      sidecar.rs
      tray.rs
```

The subtree is self-contained. Running Go tests should not require Node, npm, Rust, or Tauri. Running desktop commands should happen from `desktop/`.

## Architecture

```text
React UI
  |
  | Tauri invoke + events
  v
Rust Tauri backend
  |
  | child process launch, stdout/stderr capture, graceful/forced stop
  v
cli_LH binary
  |
  | localhost HTTP probes
  v
/healthz and /statusz
```

### React Frontend

The React app owns presentation and user interaction:

- Render service state.
- Render settings fields.
- Send commands through Tauri `invoke`.
- Subscribe to Tauri events for state and logs.
- Probe HTTP endpoints only for read-only health/status display.
- Persist non-secret UI preferences through Tauri-backed settings commands.

The frontend must not spawn processes directly. It should treat Rust commands as the privileged boundary.

### Rust Tauri Backend

The Rust backend owns native process lifecycle:

- Keep one sidecar child process at a time.
- Start `cli_LH` with explicit arguments.
- Capture stdout/stderr line output.
- Emit process state changes and log lines to the frontend.
- Stop gracefully first where supported; force kill if needed.
- Provide tray menu actions.
- Persist shell settings under the app config directory.

The backend does not parse provider secrets. It only stores shell settings such as binary path, config path, base URL, and local-model flag.

### Go Core

The Go core remains unchanged by the desktop shell except through the existing public sidecar contract:

- `cli_LH --config <path>` starts the service.
- `--local-model` may be passed when requested.
- `/healthz` reports liveness.
- `/statusz` reports safe machine-readable metadata.
- stdout/stderr are captured by the shell.

## State Model

The desktop shell maintains a shell-side lifecycle state:

```ts
type SidecarPhase =
  | "idle"
  | "starting"
  | "ready"
  | "stopping"
  | "stopped"
  | "error";
```

`/statusz.status` currently reports core readiness, normally `ready`. Other lifecycle states belong to the shell until the Go core explicitly adds them.

## Tauri Commands

The initial backend command surface:

- `get_settings() -> DesktopSettings`
- `save_settings(settings: DesktopSettings) -> DesktopSettings`
- `get_sidecar_state() -> SidecarState`
- `start_sidecar(settings: DesktopSettings) -> SidecarState`
- `stop_sidecar() -> SidecarState`
- `restart_sidecar(settings: DesktopSettings) -> SidecarState`
- `clear_logs() -> ()`

## Tauri Events

The backend emits:

- `sidecar://state` with `SidecarState`
- `sidecar://stdout` with `LogLine`
- `sidecar://stderr` with `LogLine`
- `sidecar://error` with `LogLine`

## Settings

```ts
type DesktopSettings = {
  binaryPath: string;
  configPath: string;
  baseUrl: string;
  localModel: boolean;
  autoStart: boolean;
};
```

Defaults:

- `binaryPath`: empty, user must select or type path.
- `configPath`: empty, user must select or type path.
- `baseUrl`: `http://127.0.0.1:8317`.
- `localModel`: `false`.
- `autoStart`: `false`.

## UI Design Direction

The visual direction is an industrial cockpit console rather than a generic admin dashboard:

- Deep graphite background.
- Amber, cyan, and green signal accents.
- Dense but readable status cards.
- Monospace telemetry for logs and endpoints.
- Large primary service-state indicator.
- Left rail for sections.
- Main center panel for status and controls.
- Right panel for live logs.

The UI should feel like a process control room: calm, technical, and operational. It should avoid generic purple gradients, generic SaaS cards, and decorative elements unrelated to sidecar operations.

## First Version Screens

Single-window MVP:

1. Left rail
   - App title
   - Service state
   - Navigation placeholders: Overview, Settings, Logs
2. Overview
   - Main readiness indicator
   - Start/Stop/Restart buttons
   - Sidecar metadata from `/statusz`
   - Provider summary counts
3. Settings
   - Binary path
   - Config path
   - Base URL
   - Local model toggle
   - Auto-start toggle
4. Logs
   - stdout/stderr stream
   - timestamps
   - source labels
   - clear button

The MVP may render all sections in one responsive dashboard before adding real navigation.

## Tray Behavior

Tray menu items:

- Show Window
- Start Sidecar
- Stop Sidecar
- Restart Sidecar
- Quit

Quit should stop the sidecar before exiting when possible. If graceful stop fails, the backend may force kill the child process.

## Error Handling

- Missing binary path: return a typed error and show an inline UI message.
- Missing config path: return a typed error and show an inline UI message.
- Process start failure: emit `sidecar://error` and set state to `error`.
- `/healthz` failure while process is running: show `starting` or `error` depending on timeout.
- `/statusz` parse failure: keep process state but mark status metadata unavailable.
- Stop failure: show error and leave state based on actual child status.

## Security

- Bind to localhost by default through `config.yaml`.
- Do not display raw tokens or API keys in logs intentionally.
- Do not persist provider secrets in the desktop settings file.
- Treat `config.yaml` and auth directories as sensitive user-selected files.
- Do not enable remote management by default.
- Do not assume management APIs are available.

## Build and Verification

Current local environment has Node/npm/npx but does not have `rustc` or `cargo` on PATH. Therefore the first implementation phase must support partial verification:

- `npm install`
- `npm run typecheck`
- `npm run build`

Full Tauri verification requires Rust:

- `npm run tauri dev`
- `npm run tauri build`

Go verification remains independent:

- `go test ./...`
- `go build -o test-output ./cmd/server`

## Rollout Plan

1. Commit this design.
2. Commit an implementation plan.
3. Add `desktop/` scaffold and frontend-only build verification.
4. Add Tauri backend commands and tray code.
5. Validate frontend build in the current environment.
6. Document Rust installation requirement for full desktop builds.

## Acceptance Criteria

- A `desktop/` subproject exists and is isolated from Go core builds.
- The React UI can be typechecked and built with npm.
- The UI exposes service settings, controls, status, and logs.
- The Tauri backend defines sidecar lifecycle commands.
- The backend starts `cli_LH --config <path>` and optionally `--local-model`.
- stdout/stderr are emitted to the UI.
- Tray actions are defined.
- Go tests continue to pass without Node/Rust dependencies.
- The implementation does not copy `cockpit-tools` code or assets.
