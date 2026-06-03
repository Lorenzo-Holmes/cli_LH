# Desktop Shell Sidecar Contract Implementation Plan

> **Scope note:** This plan is derived from `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`. It is intentionally phased so documentation can land before code or tests.

## Goal

Turn the desktop-shell sidecar contract into tracked repository artifacts, stronger regression tests, and a minimal runnable controller example while keeping `CLIProxyAPI` focused on the Go proxy core.

## Architecture

The implementation preserves the contract boundary documented in the spec:

- External desktop shells use binary launch, explicit config paths, stdout/stderr capture, signals, and HTTP probes.
- `CLIProxyAPI` owns proxy execution, OAuth/login flows, provider adapters, config loading, auth storage, model registry, health/status endpoints, optional management APIs, and SDK embedding support.
- Go embedders may use `sdk/cliproxy.Builder`; external shells should not need to import internal Go packages.

## Non-Goals

- Do not implement a desktop UI in this repository.
- Do not introduce Tauri, Electron, React, Rust, or Node.js dependencies.
- Do not change the existing `--sidecar` flag behavior in the documentation-only phase.
- Do not add new core `/statusz` lifecycle values in the documentation-only phase.
- Do not change `internal/translator/`.

## Phase 1: Documentation and Tracking

### Task 1: Track Superpowers Contract Documents

Files:

- `.gitignore`
- `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`
- `docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md`

Steps:

1. Confirm the current `docs/*` ignore rule hides `docs/superpowers/**`.
2. Add these unignore rules under the documentation section:

   ```text
   !docs/superpowers/
   !docs/superpowers/**
   ```

3. Verify both spec and plan files are visible to Git.
4. Keep the documents in English, per repository convention for new Markdown docs.

Acceptance criteria:

- `.gitignore` still ignores broad generated documentation content.
- `docs/sidecar-integration.md` remains unignored.
- `docs/superpowers/**` is trackable.
- The formal spec and this plan are present in the worktree.

### Task 2: Add Public Sidecar Integration Guide

Files:

- `docs/sidecar-integration.md`

Steps:

1. Replace obsolete shell-contract content and align it with the current branch's implemented `--sidecar` and `--sidecar-status-file` behavior.
2. Document the current supported baseline:
   - `cli-proxy-api --sidecar --config <path>` shell/controller startup.
   - Optional `--sidecar-status-file <path>` controller metadata output.
   - Optional `--local-model` startup.
   - `/healthz` for liveness.
   - `/statusz` for safe machine-readable readiness metadata.
   - Login subprocesses with `--config` and optional `--no-browser`.
   - Optional authenticated management APIs.
   - stdout/stderr as Phase 1 log baseline.
3. Link to the formal contract design document.

Acceptance criteria:

- The guide presents only implemented flags as current behavior.
- The guide recommends `--sidecar`, not `--standalone`, as generic desktop shell startup.
- The guide treats management APIs and `/keep-alive` as optional.
- The guide does not include secrets, token examples, or raw credential paths.

## Phase 2: Contract Tests

This phase is planned but not part of the documentation-only execution slice.

### Task 3: Strengthen `/statusz` Contract Tests

Files:

- `internal/api/server_test.go`
- `internal/api/sidecar_status.go` only if a test exposes a real implementation mismatch.

Planned checks:

- Top-level keys: `status`, `service`, `build`, `server`, `runtime`, `providers`.
- Current status value: `ready`.
- Runtime keys: `tuiMode`, `standalone`, `localModel`.
- Server keys: `host`, `port`, `configPath`, `authDir`.
- Provider summary keys expose counts and booleans only.
- No provider keys, OAuth tokens, management passwords, or raw config secrets are returned.

Verification:

```text
go test ./internal/api -run "TestStatusz" -count=1
```

### Task 4: Add Management and `/keep-alive` Optionality Tests

Files:

- `internal/api/server_test.go`
- `internal/api/server.go` only if a test exposes a real implementation mismatch.

Planned checks:

- Management routes return 404 when no management secret is configured.
- `/keep-alive` returns 404 by default.
- `/keep-alive` requires local password authentication when explicitly enabled.

Verification:

```text
go test ./internal/api -run "TestManagementRoutesDisabledWithoutSecret|TestKeepAlive" -count=1
```

## Phase 3: Minimal External Controller Example

This phase is planned but not part of the documentation-only execution slice.

Files:

- `examples/sidecar-controller/main.go`

Planned behavior:

- Start an already-built `cli-proxy-api` binary.
- Pass `--config <path>` and optionally `--local-model`.
- Capture stdout and stderr.
- Poll `/healthz` and `/statusz` until ready or timeout.
- Use `signal.NotifyContext` so Ctrl+C stops the controller.
- Terminate the child process on exit.
- Use only standard-library packages and public process/HTTP contracts.

Verification:

```text
gofmt -w examples/sidecar-controller/main.go
go build ./examples/sidecar-controller
```

## Phase 4: Final Verification for Full Plan

For documentation-only execution:

```text
git check-ignore -v docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md
git check-ignore -v docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md
git check-ignore -v docs/sidecar-integration.md
git status --short -- .gitignore docs/sidecar-integration.md docs/superpowers
```

Expected:

- `git check-ignore` returns no output for the three tracked documentation paths.
- Git status shows only intended documentation-related changes for the documentation-only slice.

For full code execution after Phase 2 and Phase 3:

```text
go test ./internal/api -run "TestHealthz|TestStatusz|TestManagementRoutesDisabledWithoutSecret|TestKeepAlive" -count=1
go build ./examples/sidecar-controller
go build -o test-output ./cmd/server
Remove-Item test-output -ErrorAction SilentlyContinue
go test ./...
```

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Documentation promises future behavior as current behavior | Keep future features labeled as future extension candidates only. |
| `--standalone` is mistaken for desktop sidecar mode | Explicitly document it as TUI-specific current behavior and recommend `--sidecar` for shell/controller integrations. |
| Management API is assumed to be always available | Document it as optional and authenticated. |
| `/keep-alive` becomes a desktop baseline dependency | Keep `/healthz` and `/statusz` as the baseline probes. |
| Status API leaks secrets in future changes | Add allowlist-based regression tests in Phase 2. |
| Desktop shell code bloats the Go core repository | Keep shell implementations external; only provide contract and minimal examples. |

## Documentation-Only Acceptance Criteria

- `.gitignore` allows `docs/superpowers/**` to be tracked.
- The formal sidecar contract spec exists under `docs/superpowers/specs/`.
- This implementation plan exists under `docs/superpowers/plans/`.
- `docs/sidecar-integration.md` matches the current implemented contract and does not advertise unimplemented behavior as available.
- No Go files are modified in the documentation-only slice.
