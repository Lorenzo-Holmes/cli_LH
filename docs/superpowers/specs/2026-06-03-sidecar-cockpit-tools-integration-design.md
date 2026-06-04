# cli_LH Sidecar Integration Design for Cockpit Tools

## Context

`cli_LH` is a Go proxy server that provides OpenAI/Gemini/Claude/Codex-compatible APIs, OAuth flows, model registry management, token storage, load balancing, management APIs, and SDK entry points.

`cockpit-tools` is an upper-layer desktop application built with Tauri, React, and Rust. It already embeds a copy of `cli_LH` under `sidecars/cockpit-cliproxy/cdk/cli_LH` and uses it as a local API proxy sidecar.

This design defines how this repository should treat `cockpit-tools` as an integration reference without moving the desktop UI, Tauri runtime, or account-page logic into this repository.

## Goal

Make `cli_LH` easier to embed as a stable local sidecar for desktop tools such as `cockpit-tools`, while keeping this repository focused on the proxy core.

## Non-Goals

- Do not copy the `cockpit-tools` React UI into this repository.
- Do not copy the `cockpit-tools` Tauri desktop runtime into this repository.
- Do not move `cockpit-tools` account-management pages, quota dashboards, tray logic, or settings pages into this repository.
- Do not make `cli_LH` depend on the `cockpit-tools` data directory or configuration schema.
- Do not make `cockpit-tools` the only supported embedding target.

## Shell/Core Separation

The recommended architecture is shell/core separation:

```text
Desktop shell, web panel, VS Code extension, CLI wrapper, or other controller
        |
        | process launch, config path, HTTP management API, health checks
        v
cli_LH sidecar/core
        |
        | provider adapters, translators, executors, auth stores, model registry
        v
OpenAI / Gemini / Claude / Codex / other providers
```

In this model:

- The shell owns user interaction.
- The core owns proxy execution.
- The shell starts and monitors the core through stable contracts.
- The core does not import shell-specific UI, storage, or release workflows.

For `cockpit-tools`, the shell is the Tauri/React desktop product. For this repository, the core is `cli_LH`.

## Why UI and Tauri Should Stay Outside This Repository

`cockpit-tools` UI, Tauri runtime, and account pages should not be moved into this repository for these reasons:

1. **Different responsibilities**
   - `cli_LH` is a service and SDK core.
   - `cockpit-tools` is a desktop product and control panel.
   - Combining them would blur service boundaries and make this repository responsible for desktop UX, packaging, and cross-platform window behavior.

2. **Technology-stack expansion**
   - This repository is primarily Go.
   - Importing the desktop shell would add Node.js, React, Vite, Tailwind CSS, DaisyUI, i18n, Rust, Tauri, and desktop packaging workflows.
   - That would increase build, CI, release, and security-audit complexity without improving the proxy core itself.

3. **KISS and maintainability**
   - Repository guidance requires small and simple changes.
   - A full desktop shell import would be a product-shape change, not a focused integration improvement.

4. **License boundary**
   - `cockpit-tools` is published under CC BY-NC-SA 4.0.
   - Directly copying UI/product code can create attribution, share-alike, and commercial-use constraints.
   - Studying integration patterns and defining compatible contracts is safer than importing product code.

5. **Stability**
   - UI and account pages change frequently.
   - A proxy core should keep startup behavior, API contracts, configuration loading, and auth behavior stable.
   - Separating shell and core prevents UI churn from destabilizing the service.

## Integration Model

A desktop shell should integrate `cli_LH` by:

1. Shipping or locating a `cli_LH` binary.
2. Creating or selecting a `config.yaml` file.
3. Selecting an auth directory.
4. Starting the binary with explicit arguments.
5. Waiting for a health or status signal.
6. Calling management APIs or proxy APIs over `127.0.0.1`.
7. Stopping the sidecar process when appropriate.

The shell should adapt to `cli_LH` contracts. `cli_LH` should not adapt directly to `cockpit-tools` internal configuration files.

## Sidecar Launch Contract

Recommended command shapes:

```text
cli_LH --config <config.yaml> --local-model --no-browser
cli_LH --standalone --config <config.yaml> --local-model --no-browser
cli_LH --codex-login --config <config.yaml> --no-browser
cli_LH --codex-device-login --config <config.yaml> --no-browser
```

The launch contract should document:

- `--config <path>` selects the sidecar-owned configuration file.
- `--local-model` disables remote model updates when deterministic local startup is needed.
- `--no-browser` prevents the sidecar from opening a browser automatically during shell-controlled flows.
- `--standalone` can be used when the shell wants isolated service behavior.
- Login commands should be launched as separate foreground operations when possible.

Windows batch files such as `启动服务.bat` are useful for local operators, but desktop shells should prefer direct binary execution with explicit arguments.

## Sidecar Profile Concept

A sidecar profile is a documented operating mode for embedding `cli_LH` in another application.

A future `sidecar` profile may define:

- Bind host: `127.0.0.1` by default.
- Port behavior: fixed port from config or dynamically selected port.
- Config path: supplied by the shell.
- Auth directory: supplied by config or environment.
- Browser behavior: disabled by default unless explicitly requested.
- Log behavior: write logs to a shell-readable directory without leaking secrets.
- Startup signal: provide machine-readable status through an HTTP endpoint, JSON status file, or structured stdout.
- Shutdown behavior: support graceful process termination.

This design does not require a new `--sidecar` flag immediately. It first defines the expected behavior so implementation can remain incremental.

## Health and Status Contract

A shell needs a stable way to know whether the sidecar is usable.

The status contract should expose, or confirm the existence of, machine-readable fields such as:

- service status: starting, ready, degraded, stopping
- version, commit, and build date
- bind address and port
- active configuration file path
- auth directory path
- enabled provider summary without secrets
- model registry mode and update status
- runtime mode flags such as `standalone`, `tui`, and `local-model`

The first implementation step should audit existing management or health endpoints before adding new endpoints.

## Configuration Contract

`cli_LH` should continue to own its native configuration:

- `config.yaml` remains the primary service configuration.
- `.env` may still be loaded from the working directory.
- auth material remains under the configured auth directory.
- storage backends remain file-based by default, with optional Postgres, git, or object-store support.

A desktop shell may generate or edit a `cli_LH` config file, but this repository should not read shell-specific files such as `~/.antigravity_cockpit/config.json` directly.

## Implementation Phases

### Phase 1: Documentation and Contract Definition

- Add this design document.
- Add an implementation plan.
- Document recommended desktop-sidecar launch commands.
- Audit existing health and management APIs.

### Phase 2: Minimal Compatibility Enhancements

- Confirm or add a stable health/status response.
- Ensure status output is machine-readable.
- Include version, port, config path, and safe runtime summaries.
- Avoid logging secrets or tokens.

### Phase 3: Desktop-Shell Optimization

- Consider a `--sidecar` mode if repeated shell integrations need it.
- Consider writing a `server.json` status file for shells that cannot rely only on stdout.
- Improve no-browser and device-code login flows for shell-controlled UX.
- Improve graceful shutdown behavior.

### Phase 4: SDK and Example Integration

- Strengthen `sdk/cliproxy` as the supported embedding layer.
- Add a sidecar integration guide.
- Add a minimal controller example that starts, probes, and stops the service.

## Testing Strategy

Documentation-only changes do not require a full Go test run.

For Go code changes, run:

```text
gofmt -w .
go test ./...
go build -o test-output ./cmd/server
```

For focused registry or startup changes, run narrower tests first, then the build command.

For any new health/status contract, add tests that verify:

- response is valid JSON
- status omits secrets
- version/build fields are present when available
- config path and runtime flags are represented safely

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Shell-specific assumptions leak into the core | Keep contracts generic and name them as sidecar contracts, not cockpit-only contracts |
| UI requests expand the repository scope | Keep UI/Tauri work in external shells and document integration points only |
| License ambiguity from copying product code | Do not copy `cockpit-tools` code; use it only as a behavioral reference |
| Status API leaks secrets | Use allowlisted fields only and add tests for redaction |
| Launch behavior differs across Windows/macOS/Linux | Prefer explicit binary arguments and document platform-specific wrappers separately |

## Acceptance Criteria

- The repository has a documented sidecar integration design.
- The design explains shell/core separation and why UI/Tauri code stays outside this repository.
- The design identifies launch, health/status, and configuration contracts.
- The design provides phased implementation guidance without requiring immediate large code changes.
- The design avoids `cockpit-tools`-specific hard dependencies.
