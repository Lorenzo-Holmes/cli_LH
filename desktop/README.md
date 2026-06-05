# cli_LH Desktop Cockpit

First-party reference desktop shell for controlling a local `cli_LH` sidecar.

Packaging and release guidance is documented in [`PACKAGING.md`](./PACKAGING.md).

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

Pull requests that touch `desktop/**` also run `.github/workflows/desktop-check.yml`, which installs Node.js, Rust, Linux Tauri system dependencies, runs frontend checks, and runs `npm run tauri:check` in CI.

## Native sidecar manager

The Tauri backend owns the local `cli_LH` child process lifecycle. It persists launch settings under the app config directory, launches the configured binary with `--config <path>` and optional `--local-model`, streams stdout/stderr to frontend events, and exposes tray actions for show/start/stop/restart/quit.

The React frontend still treats HTTP readiness as a probe concern by checking `/healthz` and `/statusz` on the configured base URL. The native process phase can therefore be `starting` while the HTTP probe is still waiting for the Go service to report ready.
