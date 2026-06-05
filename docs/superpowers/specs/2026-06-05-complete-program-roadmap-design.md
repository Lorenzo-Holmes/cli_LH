# Complete Program Roadmap Design

## Context

This repository already contains the main pieces of a complete local proxy product:

- A Go proxy server that exposes OpenAI/Gemini/Claude/Codex/Grok-compatible APIs.
- A Tauri 2 + React desktop shell under `desktop/`.
- Packaging scripts and Windows installer validation notes.
- Existing design and implementation plans for the desktop sidecar workflow.

The next goal is not to rewrite the project from scratch. The goal is to turn the existing codebase into a complete, beginner-understandable program that can be installed, opened, configured, used, diagnosed, and maintained.

## Product Goal

Build **cli_LH Cockpit**: a local desktop control application for `cli_LH`.

The program should help a user:

1. Configure a local `cli_LH` binary and `config.yaml`.
2. Start, stop, and restart the local proxy service.
3. Understand whether the service is healthy.
4. Diagnose common startup failures.
5. View useful local status and logs.
6. Open management pages and local files safely.
7. Install and run the app on Windows.

For a beginner, the mental model is:

```text
React UI = what the user sees and clicks
Tauri/Rust = local desktop powers such as process control and tray menu
Go cli_LH server = the real proxy engine
```

## Recommended Strategy

Use a staged roadmap. Do not build every idea at once.

```text
Stage 1: Complete desktop app loop
Stage 2: Strengthen Go management surfaces
Stage 3: Add management dashboard features
Stage 4: Release and maintenance system
```

This order is intentional. A complete program first needs a stable user loop: open app, configure it, start service, see status, fix errors, and close or tray it. Advanced dashboards are useful only after that loop is reliable.

## Stage 1: Complete Desktop App Loop

### Goal

Make `desktop/` a usable Windows desktop program, not just a development shell.

### Scope

- First-run setup guidance.
- Auto-detect and browse actions for `cli_LH.exe` and `config.yaml`.
- Launch preflight checks:
  - binary exists
  - config exists
  - base URL is valid
  - configured port appears available
- Start, stop, and restart actions.
- Accurate process state:
  - `starting`
  - `ready`
  - `stopping`
  - `stopped`
  - `error`
- Health and status display for `/healthz` and `/statusz`.
- Human-readable recovery suggestions.
- Tray menu actions.
- Windows packaging path.

### Teaching Note

This stage is the foundation. It answers the question: “Can a normal user actually run this program without using the command line?”

### Success Criteria

- A user can launch the desktop app and configure the sidecar.
- The app blocks obvious invalid launches before spawning the process.
- Startup failures show useful explanations.
- The sidecar can be started, stopped, restarted, and observed.
- The app can be validated with frontend checks, Tauri checks, Go build, and sidecar smoke tests.

## Stage 2: Strengthen Go Management Surfaces

### Goal

Give the desktop app stable and safe backend information to display.

### Scope

- Keep `/healthz` as a simple liveness endpoint.
- Keep or improve `/statusz` as a safe machine-readable endpoint.
- Add or refine local-only management endpoints only when needed.
- Standardize error payloads where the desktop app depends on them.
- Avoid exposing secrets or tokens.
- Add focused tests around any new management surface.

### Teaching Note

The Go server is the engine. The desktop UI is the dashboard. A dashboard should not guess engine state; it should read safe, stable signals from the engine.

### Success Criteria

- The desktop app can display reliable health/status data.
- New local management data does not leak sensitive credentials.
- Backend changes are covered by Go tests.
- Existing API compatibility is not broken.

## Stage 3: Management Dashboard Features

### Goal

Upgrade the desktop app from a launcher into a local control cockpit.

### Scope

Candidate features, implemented incrementally:

- Provider summary.
- Model summary.
- Config snapshot viewer.
- Request or activity overview from existing safe APIs.
- Log filtering and search.
- OAuth/account shortcuts where already supported safely.
- Basic usage overview only if a reliable data source exists.

### Teaching Note

This stage helps users understand what the proxy is doing after it starts. It should not come before stable start/stop and diagnostics.

### Success Criteria

- Dashboard data comes from documented local APIs or safe files.
- Each dashboard panel has a clear purpose.
- Missing data is shown as “unavailable,” not as a crash.
- The UI remains understandable for beginners.

## Stage 4: Release and Maintenance System

### Goal

Make the program shippable and maintainable.

### Scope

- Windows installer workflow.
- GitHub Actions release artifacts.
- Clear beginner documentation.
- Troubleshooting guide.
- Version and release notes.
- Packaging smoke-test checklist.
- Future update strategy.

### Teaching Note

Code is only one part of a complete program. A real program also needs installation, documentation, verification, and a repeatable release process.

### Success Criteria

- A release can be produced from documented commands or CI.
- Users know how to install and start the app.
- Maintainers know how to verify a release before publishing.
- Known limitations are documented.

## Architecture

```text
User
  |
  v
React Desktop UI
  - setup screens
  - control panel
  - logs
  - diagnostics
  - dashboard panels
  |
  v
Tauri/Rust Backend
  - settings persistence
  - path validation
  - port checks
  - process lifecycle
  - tray menu
  - native open/reveal actions
  |
  v
Go cli_LH Sidecar
  - proxy APIs
  - health/status endpoints
  - safe local management data
```

## Boundaries

### React Should

- Render state clearly.
- Explain errors in beginner-friendly language.
- Call typed Tauri commands.
- Probe safe HTTP endpoints.

### React Should Not

- Spawn processes directly.
- Store secrets in frontend-local storage.
- Guess irreversible process state without backend confirmation.

### Tauri/Rust Should

- Own local process lifecycle.
- Validate launch profiles.
- Manage tray behavior.
- Open files, folders, and browser URLs through native APIs.

### Tauri/Rust Should Not

- Reimplement the Go proxy.
- Parse or expose provider secrets unnecessarily.

### Go Should

- Remain usable as an independent CLI/server.
- Provide stable health and status data.
- Keep provider/runtime logic independent from desktop dependencies.

### Go Should Not

- Depend on React, Node, Tauri, Rust, or Cargo.

## Error Handling Principles

Errors should be written for beginners first, then include technical detail when useful.

Examples:

- Missing binary: “Choose `cli_LH.exe` or run Auto-detect.”
- Missing config: “Choose `config.yaml` before starting.”
- Port conflict: “Another process is already using this port. Stop it or change the Base URL port.”
- Readiness timeout: “The process started, but the health endpoint did not become ready in time.”
- Status parse failure: “The service responded, but the response was not valid status data.”

## Testing and Verification

Each stage should include verification before being called complete.

Recommended checks:

- Go formatting after Go changes: `gofmt -w .`
- Go compile check: `go build -o test-output ./cmd/server` then remove `test-output`.
- Go tests where backend logic changes: `go test ./...`.
- Desktop type check: run the existing desktop typecheck script.
- Desktop build: run the existing desktop build script.
- Tauri check when Rust/Cargo are available.
- Sidecar smoke test when packaging or launch behavior changes.

## Proposed Execution Order

1. Finish Stage 1 features already described by the existing desktop next-stage plan.
2. Verify Stage 1 with build, typecheck, Tauri check, and sidecar smoke test.
3. Identify the smallest backend management API gap needed by the desktop UI.
4. Implement only that backend gap with tests.
5. Add one dashboard panel at a time.
6. Update packaging and beginner documentation after each product-visible milestone.

## Self-Reviewed Trade-Offs

### Advantages

- Builds on existing code instead of restarting.
- Produces visible progress early through the desktop app.
- Keeps the Go proxy core independent and reusable.
- Gives beginners a clear mental model.
- Reduces risk by staging the work.

### Disadvantages

- The full roadmap spans multiple phases.
- The project uses several technologies: Go, React, TypeScript, Rust, and Tauri.
- Dashboard features must wait until the process loop is stable.
- Some packaging checks depend on local Rust/Cargo and Windows installer prerequisites.

## Recommendation

Proceed with this roadmap and start implementation from **Stage 1: Complete Desktop App Loop**.

The first implementation plan should reuse the existing `Desktop Next Stage Implementation Plan` where possible, because it already targets the right foundation: preflight diagnostics, recovery actions, tray behavior, and packaging documentation.