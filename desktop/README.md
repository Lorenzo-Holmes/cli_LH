# cli_LH Desktop Cockpit

First-party reference desktop shell for controlling a local `cli_LH` sidecar.

Packaging and release guidance is documented in [`PACKAGING.md`](./PACKAGING.md).

## Beginner Mental Model

The desktop app is split into three simple parts:

- **React UI** is what the user sees: setup, buttons, status cards, logs, and diagnostics.
- **Tauri/Rust backend** performs local desktop actions: save settings, start or stop the sidecar process, update the tray menu, and reveal files.
- **Go cli_LH sidecar** is the proxy engine. It serves `/healthz`, `/statusz`, and the compatible model APIs.

This separation keeps the proxy usable from the command line while still allowing a beginner-friendly desktop program.

The complete product roadmap is documented in [`../docs/superpowers/specs/2026-06-05-complete-program-roadmap-design.md`](../docs/superpowers/specs/2026-06-05-complete-program-roadmap-design.md).

## Health and Status Endpoints

The desktop app checks two safe HTTP endpoints on the local Go sidecar:

- `/healthz` answers one simple question: is the process alive enough to answer HTTP?
- `/statusz` answers a richer question: what safe runtime, provider-count, and management-capability information can the UI show?

`/statusz` intentionally reports counts and booleans instead of secrets. For example, it can say that the Management API is available or that request logging is enabled, but it must not return management passwords, API keys, OAuth tokens, or provider credentials.

## Read-Only Dashboard Panels

The Stage 3 dashboard starts as read-only on purpose:

- **Telemetry** answers whether the local Go sidecar is responding.
- **Providers** summarizes configured provider entries by count, without showing keys.
- **Management** summarizes enabled local control features, without showing passwords.
- **Runtime** shows where the sidecar is running and which launch modes are active.

This is safer for beginners than starting with editable settings. First learn what the engine is doing; then later stages can add controlled editing where it is safe.

## Next Actions Guide

The cockpit includes a small **Next actions** panel near the top of the dashboard. It reads the same local state that the rest of the UI already has:

- launch settings,
- preflight checks,
- sidecar process phase,
- safe `/healthz` and `/statusz` probe results.

It then recommends the next safe step, such as opening the setup wizard, fixing preflight checks, starting the sidecar, probing readiness, opening management, or inspecting logs. This teaches the normal operating loop without automatically changing settings or exposing secrets.

## Management Session Panel

The **Management Session** panel is an intentionally small read-only bridge into authenticated management endpoints.

- The management key is kept only in React memory.
- The key is not saved into desktop settings or profiles.
- The panel does not fetch full `config.yaml`, API keys, OAuth files, or auth records.
- It only reads a few safe operational toggles: debug, file logging, usage statistics, WebSocket auth, and whether a proxy URL is configured.

For beginners, this creates a safe learning path: first see whether management is configured, then verify the key, then understand a few runtime options before any future editable settings are introduced.

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
npm run tauri:check
npm run tauri dev
npm run tauri build
```

If `rustc` and `cargo` are not available, the frontend build can still be verified.

On Windows, install Rust with `winget install Rustlang.Rustup`, then restart the terminal and run `rustc --version` and `cargo --version` before running Tauri checks.

## Stage 1 Desktop Loop

The first complete-program milestone is the local desktop loop:

1. Configure the `cli_LH` binary and `config.yaml`.
2. Run preflight checks before launch.
3. Start, stop, and restart the sidecar.
4. Probe `/healthz` and `/statusz`.
5. Show beginner-friendly recovery suggestions.
6. Keep useful tray actions available when the window is hidden.
7. Export or inspect logs when troubleshooting.

This milestone matters because users must be able to run and repair the program before advanced dashboard features are useful.

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
npm run tauri:check
npm run tauri dev
```

The Windows desktop workspace has been validated locally with Rust/Cargo by running `npm run tauri:check`, `npm run typecheck`, and `npm run build`.

Pull requests that touch `desktop/**` also run `.github/workflows/desktop-check.yml`, which installs Node.js, Rust, Linux Tauri system dependencies, runs frontend checks, and runs `npm run tauri:check` in CI.

## Native sidecar manager

The Tauri backend owns the local `cli_LH` child process lifecycle. It persists launch settings under the app config directory, launches the configured binary with `--config <path>` and optional `--local-model`, streams stdout/stderr to frontend events, and exposes tray actions for show/start/stop/restart/quit.

The React frontend still treats HTTP readiness as a probe concern by checking `/healthz` and `/statusz` on the configured base URL. The native process phase can therefore be `starting` while the HTTP probe is still waiting for the Go service to report ready.
