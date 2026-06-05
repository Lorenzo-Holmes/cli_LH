# Desktop Packaging Strategy

This document defines the packaging path for the `cli_LH` desktop cockpit without changing the Go proxy core into a desktop dependency.

## Goals

- Ship a Tauri desktop shell that controls a local `cli_LH` sidecar.
- Keep `cli_LH` usable as an independent Go CLI/server.
- Make the bundled binary/config contract explicit and testable.
- Avoid claiming native build success unless Rust/Cargo checks have passed.

## Build Inputs

- Go sidecar binary built from repository root:
  - Windows: `go build -o desktop/src-tauri/binaries/cli_LH-x86_64-pc-windows-msvc.exe ./cmd/server`
  - Linux/macOS names should follow Tauri sidecar target naming when packaging those platforms.
- Desktop frontend built from `desktop/`:
  - `npm ci`
  - `npm run typecheck`
  - `npm run build`
- Tauri native validation:
  - `npm run tauri:check`
  - `npm run tauri build`

## Sidecar Contract

The desktop shell starts the Go process with:

```text
cli_LH --config <path> [--local-model]
```

Runtime readiness is determined by probing:

- `/healthz` for liveness.
- `/statusz` for safe machine-readable service metadata.

The launch profile remains user-editable, so development and packaged builds can both point to a custom `cli_LH` binary and `config.yaml`.

## Recommended Release Flow

1. Build and verify the Go binary from repository root.
2. Copy the release binary into the Tauri sidecar binaries directory using the correct target triple name.
3. Run frontend checks in `desktop/`.
4. Run `npm run tauri:check` on a machine with Rust/Cargo and platform prerequisites installed.
5. Run `npm run tauri build` for the target platform.
6. Smoke-test the packaged app:
   - Launch app.
   - Confirm preflight checks pass.
   - Start sidecar.
   - Confirm `/healthz` and `/statusz` probe readiness.
   - Confirm tray start/stop/restart/quit behavior.

## Current Validation Status

Local frontend validation is available with Node.js. Full native validation requires Rust/Cargo. If Rust/Cargo are unavailable locally, use `.github/workflows/desktop-check.yml` as the authoritative native validation path until the local environment is installed.

## Future Improvements

- Add scripted sidecar binary copy per target triple.
- Add release workflow artifacts for Windows, Linux, and macOS.
- Add signed installers after distribution requirements are known.
- Add optional migration/import flow for existing `config.yaml` and `auths/` directories.
