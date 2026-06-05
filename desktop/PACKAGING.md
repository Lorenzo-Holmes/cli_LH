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
- Scripted sidecar preparation from `desktop/`:
  - `npm run prepare:sidecar`
  - optional target override: `TAURI_TARGET_TRIPLE=<triple> npm run prepare:sidecar`
- Scripted sidecar contract smoke test from `desktop/`:
  - `npm run smoke:sidecar`
  - optional PowerShell overrides: `./scripts/smoke-sidecar.ps1 -Port 8319 -BinaryPath <path> -ConfigPath <path>`
- Desktop frontend built from `desktop/`:
  - `npm ci`
  - `npm run typecheck`
  - `npm run build`
- Tauri native validation:
  - `npm run tauri:check`
  - `npm run check:installer-prereqs` on Windows before full installer bundling.
  - `node ./node_modules/@tauri-apps/cli/tauri.js build --no-bundle` for release executable validation.
  - `npm run tauri build` for installer bundling when platform prerequisites are available.
- GitHub Actions release packaging:
  - `.github/workflows/desktop-release.yml`
  - Runs on `workflow_dispatch` and `v*` tags.
  - Produces unsigned Windows NSIS desktop bundle artifacts from `desktop/src-tauri/target/release/bundle/**`.

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
2. Copy the release binary into the Tauri sidecar binaries directory using `npm run prepare:sidecar` or the correct target triple name.
3. Run `npm run smoke:sidecar` to validate `/healthz` and `/statusz` on an isolated temporary port.
4. Run frontend checks in `desktop/`.
5. Run `npm run tauri:check` on a machine with Rust/Cargo and platform prerequisites installed.
6. Run `npm run check:installer-prereqs` on Windows before full installer bundling.
7. Run `node ./node_modules/@tauri-apps/cli/tauri.js build --no-bundle` from `desktop/` to validate the release executable.
8. Run `npm run tauri build` for the target platform when installer tooling is installed or can be downloaded. Windows currently targets NSIS to avoid MSI/WiX, but NSIS must still be installed locally or downloadable by Tauri.
9. Smoke-test the packaged app:
   - Launch app.
   - Confirm preflight checks pass.
   - Start sidecar.
   - Confirm `/healthz` and `/statusz` probe readiness.
   - Confirm tray start/stop/restart/quit behavior.

For CI-based packaging, run the `desktop-release` workflow manually or push a `v*` tag. The workflow installs Node.js, Go, and Rust, prepares the Go sidecar, runs frontend checks, builds the Tauri bundle, and uploads unsigned Windows NSIS artifacts.

## Current Validation Status

Local Windows validation has passed with Node.js, Rust, Cargo, WebView2, and MSVC Build Tools installed:

- `npm run tauri:check`
- `npm run typecheck`
- `npm run build`
- `npm run prepare:sidecar`
- `npm run smoke:sidecar`
- `node ./node_modules/@tauri-apps/cli/tauri.js build --no-bundle`
- Isolated sidecar smoke test on a temporary port: `/healthz` and `/statusz` returned `200 OK`.

Full local installer bundling is blocked in this environment until NSIS can be installed or downloaded successfully. Use `npm run check:installer-prereqs` to confirm local readiness before running `npm run tauri build`. The release executable build is validated; installer validation should be completed locally after NSIS is available or through `.github/workflows/desktop-release.yml`.

Release packaging is represented by `.github/workflows/desktop-release.yml`; local `npm run tauri build` should still be used before publishing release artifacts when possible.

If Rust/Cargo are unavailable in another local environment, use `.github/workflows/desktop-check.yml` as the authoritative native validation path until that environment is installed.

## Future Improvements

- Extend release workflow artifacts to Linux and macOS.
- Add signed installers after distribution requirements are known.
- Add optional migration/import flow for existing `config.yaml` and `auths/` directories.
