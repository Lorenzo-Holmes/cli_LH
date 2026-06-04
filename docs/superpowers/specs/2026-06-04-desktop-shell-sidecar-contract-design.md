# Desktop Shell Sidecar Contract Design

## Context

`cli_LH` is a Go proxy core that provides OpenAI/Gemini/Claude/Codex-compatible APIs, provider adapters, OAuth flows, model registry management, token storage, load balancing, management APIs, request logging, and SDK entry points.

A desktop shell is an external application that presents the product UI and controls a local `cli_LH` process. `cockpit-tools` is a useful reference for this shape, but this repository should define a generic sidecar contract instead of importing a specific desktop product.

This document merges the existing sidecar integration direction with the validated contract corrections for startup arguments, health/status APIs, directory layout, logs, OAuth/login, process lifecycle, security, and SDK embedding.

## Goals

- Define a stable contract between external desktop shells and the `cli_LH` sidecar/core.
- Keep this repository focused on the Go proxy core.
- Make desktop integration possible through binary launch, explicit configuration, health/status probing, optional management APIs, and safe shutdown.
- Treat `cockpit-tools` as an integration reference, not as a code source or hard dependency.
- Document what exists today, what is optional today, and what should be considered a future extension.

## Non-Goals

- Do not copy a desktop shell UI into this repository.
- Do not copy a Tauri, React, Rust, or Node.js desktop runtime into this repository.
- Do not make `cli_LH` depend on `cockpit-tools` directories, account pages, tray logic, release workflow, or configuration schema.
- Do not introduce a new desktop framework dependency in this Go repository.
- Do not require all embedders to use the Go SDK; external desktop shells should be able to use the binary and HTTP contract.
- Do not promise lifecycle states or management routes that the current core does not already expose.

## Architecture

The recommended architecture is shell/core separation:

```text
External desktop shell, web panel, VS Code extension, CLI wrapper, or service controller
        |
        | binary launch, config path, stdout/stderr, signals, HTTP probes
        v
cli_LH sidecar/core
        |
        | provider adapters, translators, executors, auth stores, model registry
        v
OpenAI / Gemini / Claude / Codex / other providers
```

### Shell Responsibilities

The shell owns user-facing product behavior:

- Desktop windows, tray, menu, notifications, first-run flow, and update UX.
- Account pages and provider login buttons.
- Process launch, restart, crash detection, and stop behavior.
- Shell-level lifecycle states such as `starting`, `ready`, `stopping`, `stopped`, and `crashed`.
- Selecting or generating a sidecar configuration file.
- Displaying process logs, status, and safe management data.

### Core Responsibilities

The `cli_LH` core owns service behavior:

- Proxy API compatibility.
- Provider adapters and protocol translators.
- OAuth/login command implementations.
- Config loading and hot reload.
- Auth material storage under `auth-dir`.
- Model registry and local/remote model behavior.
- Request logging and usage accounting.
- Safe health/status endpoints.
- Optional management APIs.
- Go SDK embedding support.

## Current Stable Contract

The current repository already has several stable sidecar primitives.

### Binary Startup

The normal sidecar startup shape is:

```text
cli_LH --config <config.yaml>
```

Common existing flags that may matter to a shell:

| Flag | Current role | Shell contract guidance |
| --- | --- | --- |
| `--config <path>` | Selects the configuration file. | Stable startup input for binary sidecar mode. |
| `--local-model` | Disables remote model updates. | Useful for deterministic local startup or offline-friendly shell behavior. |
| `--tui` | Starts terminal UI mode. | Not part of the desktop shell contract. |
| `--standalone` | In TUI mode, starts an embedded local server. | Do not treat as a generic desktop sidecar flag. |
| `--no-browser` | Prevents automatic browser opening in login flows. | Use for OAuth/login subprocesses when the shell owns browser UX. Do not require it for normal server startup. |
| `--oauth-callback-port <port>` | Selects OAuth callback port for supported login flows. | Optional login-flow control. |
| `--project_id <id>` | Vertex-related login/import argument. | Use the underscore spelling that exists today. |
| `--vertex-import` | Imports Vertex credentials. | Login/import operation, not normal sidecar startup. |
| `--password <value>` | Local management password input in the current entrypoint. | Treat as sensitive. Prefer passing secrets through controlled shell mechanisms and never log it. |

A desktop shell should prefer direct binary execution with explicit arguments over batch-file wrappers. Windows helper scripts can remain useful for operators but should not be the formal embedding contract.

### Health API

`GET /healthz` is the liveness endpoint.

Expected current behavior:

```json
{"status":"ok"}
```

Contract rules:

- `GET /healthz` returning HTTP 200 means the HTTP server is alive.
- `HEAD /healthz` should return HTTP 200 with no response body.
- The shell may poll this endpoint during startup.
- This endpoint should stay minimal and should not include secrets, configuration contents, provider tokens, or account material.

### Status API

`GET /statusz` is the machine-readable sidecar status endpoint.

Current status response includes safe groups such as:

- service status
- service name
- build information
- server host, port, config path, and auth directory
- runtime flags such as TUI mode, standalone mode, and local-model mode
- provider summary counts without secrets

Contract rules:

- `GET /statusz` returning HTTP 200 means the server has reached its current ready state.
- `HEAD /statusz` should return HTTP 200 with no response body.
- The current core status value is `ready`.
- Additional status values such as `starting`, `degraded`, `stopping`, or `restart_required` are future extensions unless implemented explicitly.
- Desktop shells must ignore unknown fields.
- Documented fields should be add-only where possible.
- The status response must remain allowlist-based and must not expose API keys, management passwords, OAuth tokens, refresh tokens, provider credentials, or raw config secrets.

### SDK Builder

The Go SDK builder is a separate official embedding path for Go applications.

Existing builder concepts include:

- `WithConfig`
- `WithConfigPath`
- `WithLocalManagementPassword`
- `WithServerOptions`
- `WithSidecarRuntimeInfo`
- `Build`

Contract split:

- External desktop shells should use binary launch and HTTP probes.
- Go embedders may use `sdk/cliproxy.Builder`.
- The SDK should preserve the same service semantics as the binary path where practical.
- `WithSidecarRuntimeInfo` should remain the SDK path for passing runtime metadata into `/statusz`.

## Startup Contract

### Normal Server Startup

Recommended external shell command:

```text
cli_LH --config <absolute-or-shell-owned-config-path>
```

Optional additions:

```text
cli_LH --config <path> --local-model
```

The shell should:

1. Choose a config file path.
2. Ensure the config file is present or generate a valid minimal config.
3. Start the binary as a child process.
4. Capture stdout and stderr.
5. Poll `GET /healthz` for liveness.
6. Poll `GET /statusz` for machine-readable readiness.
7. Mark the shell-side service as ready only after the probe succeeds.

The shell should not require `--standalone` for normal desktop sidecar mode because that flag currently belongs to TUI standalone behavior.

### Login and Import Startup

Login and import flows should be modeled as foreground subprocess operations, separate from normal server startup.

Existing login/import flags include:

```text
--login
--codex-login
--codex-device-login
--claude-login
--antigravity-login
--kimi-login
--xai-login
--vertex-import
```

Recommended shell behavior:

1. Stop or leave the main sidecar running depending on provider-specific requirements.
2. Launch the relevant login command as a foreground child process.
3. Pass `--config <path>` so the login command uses the same sidecar profile.
4. Pass `--no-browser` only when the shell wants to open the browser itself or show a device-code UI.
5. Pass `--oauth-callback-port <port>` only when needed.
6. Capture stdout/stderr and exit code.
7. Refresh `/statusz` or management/account views after successful login.

The login subprocess contract should not require the management API to be enabled.

## Configuration and Directory Layout Contract

### Configuration File

`config.yaml` remains the primary service configuration format.

A shell may generate, edit, or select a `cli_LH` config file, but the core should not read shell-specific product configuration directly.

Important existing YAML keys include:

| YAML key | Meaning |
| --- | --- |
| `host` | Server bind host. |
| `port` | Server port. |
| `auth-dir` | Directory for auth material. |
| `remote-management` | Optional management API configuration. |
| `logging-to-file` | Whether application logs are written to rotating files. |
| `logs-max-total-size-mb` | Total log directory cleanup limit. |
| `error-logs-max-files` | Error log retention limit. |

Use `auth-dir`, not `auth_dir`.

### Auth Directory

The default auth directory is:

```text
~/.cli_LH
```

The auth directory stores provider auth material and related runtime files. It is selected by the `auth-dir` configuration field and resolved by the core.

Contract rules:

- The shell may choose a shell-owned `auth-dir` by writing it into config.
- The shell must treat files under `auth-dir` as sensitive.
- The shell must not display raw token files unless explicitly implementing a secure diagnostic mode.
- The shell must not copy, upload, or log auth material.

### Working Directory and `.env`

The core may auto-load `.env` from the working directory. A shell that starts the sidecar should choose the working directory deliberately.

Recommended shell behavior:

- Use a deterministic working directory for the sidecar profile.
- Avoid inheriting unrelated user shell state.
- Avoid placing secrets in process arguments when an environment variable or config secret path can be used safely.

## Logging Contract

Logging has multiple existing paths and should not be overspecified as a single fixed directory.

Current behavior includes:

- Base logs go to stdout unless file logging is enabled.
- `logging-to-file` enables rotating application logs.
- The log directory is resolved by core logic.
- The resolver may use a writable application path, a local `logs` directory, or fall back to `auth-dir/logs` when the local logs directory is not writable.
- Request/error logs use the resolved log directory.

Contract rules:

- Phase 1 shells should capture child-process stdout/stderr as the most reliable log source.
- File log discovery should be best-effort unless a future stable log API or manifest endpoint is added.
- The shell should not hard-code exactly one file log directory.
- The shell should redact secrets before displaying or exporting logs.
- The core should continue avoiding provider tokens, OAuth tokens, API keys, and management passwords in logs.

Future extension candidates:

- Stable `GET /v0/management/logs/...` endpoints when management is enabled.
- A safe log manifest endpoint.
- A sidecar status file containing resolved log paths.

## Management API Contract

The management API is optional and must be treated as a discoverable capability, not as a guaranteed baseline endpoint.

Current security behavior:

- `remote-management.secret-key` controls the config-based management secret.
- An empty `remote-management.secret-key` disables management routes in the normal config path.
- `remote-management.allow-remote` controls remote management exposure.
- Management requests require a key even on localhost.
- `MANAGEMENT_PASSWORD` can enable management routes through environment-driven runtime behavior.
- `WithLocalManagementPassword` can be used by Go embedding paths and local runtime flows.

Contract rules for desktop shells:

- Do not assume `/v0/management` exists after startup.
- If the shell needs management APIs, it must configure or provide a management secret deliberately.
- Treat all management secrets as sensitive.
- Prefer localhost-only management for desktop use.
- Do not expose management routes remotely unless explicitly configured by an advanced user.
- Do not log management secrets or place them in screenshots, telemetry, or exported diagnostics.

### `/keep-alive`

`/keep-alive` exists only when the server is constructed with `WithKeepAliveEndpoint(...)`.

Contract status:

- It is an optional local lifecycle extension.
- It is not part of the Phase 1 desktop shell baseline contract.
- Shells should use `/healthz` and `/statusz` for basic startup probing.
- Shells should not depend on `/keep-alive` unless they intentionally use a runtime path that enables it.

## Process Lifecycle Contract

### Shell-Side Lifecycle Model

The shell should maintain its own normalized process lifecycle state:

| Shell state | Meaning |
| --- | --- |
| `stopped` | No sidecar process is expected to be running. |
| `starting` | Process has been spawned but probes have not succeeded yet. |
| `ready` | `/healthz` and/or `/statusz` probe has succeeded. |
| `stopping` | Shell has requested shutdown. |
| `crashed` | Process exited unexpectedly or failed startup. |
| `restart_required` | Shell has changed settings that require a restart. |

Only `ready` is currently a core `/statusz` status. Other states are shell-side or future core extensions.

### Startup Sequence

Recommended startup sequence:

1. Validate that the binary exists and is executable.
2. Validate or generate config.
3. Spawn process with explicit arguments.
4. Read stdout/stderr asynchronously.
5. Poll `/healthz` with a startup deadline.
6. Poll `/statusz` after liveness succeeds.
7. If probes fail before the deadline, terminate the process and report startup failure.
8. If the process exits before readiness, mark as `crashed` or `startup_failed`.

### Shutdown Sequence

Recommended shutdown sequence:

1. Mark shell state as `stopping`.
2. Send a graceful termination signal suitable for the platform.
3. Wait for process exit.
4. If the process does not exit within a shell-defined grace period, force kill it.
5. Mark shell state as `stopped` if the stop was requested, otherwise `crashed`.

Current core behavior uses signal handling for graceful shutdown paths. Desktop shells should prefer graceful termination before force killing the process.

### Restart Sequence

Recommended restart sequence:

1. Mark `restart_required` when configuration changes cannot be hot reloaded safely.
2. Stop the existing process gracefully.
3. Start a new process with the updated config.
4. Probe health/status.
5. Mark shell state as `ready` or `crashed`.

## Security Model

### Local-First Binding

Desktop use should prefer localhost-only binding.

Recommended desktop defaults:

```yaml
host: 127.0.0.1
```

A shell should avoid binding the proxy or management APIs to public interfaces unless the user explicitly configures that behavior.

### Secret Handling

Secrets include:

- Provider API keys.
- OAuth access tokens and refresh tokens.
- Codex, Claude, Gemini, Kimi, Vertex, XAI, or other provider auth files.
- Management passwords and secret keys.
- Home JWTs and cluster credentials.
- Database, git store, or object-store credentials.

Rules:

- Never write secrets to shell logs.
- Never pass secrets through user-visible command previews.
- Avoid command-line secrets where practical because process arguments can be visible to other local tools.
- Use config files, environment variables, or OS credential stores according to the shell's security model.
- Redact secrets in diagnostic exports.
- Treat `auth-dir` as a sensitive directory.

### Status and Management Exposure

`/statusz` must remain a safe status endpoint. It should expose only allowlisted operational data.

The management API is higher risk and should require explicit authentication. Desktop shells should keep it localhost-only by default and should not enable remote management unless the user understands the risk.

### Browser and OAuth Safety

For OAuth/login flows:

- The shell may use `--no-browser` and open the browser itself.
- Device-code flows should display only the user code and verification URL, not hidden tokens.
- Callback ports should be local-only where possible.
- Login output should be parsed carefully and redacted before display.

## Compatibility Rules

### API Compatibility

- Stable documented health/status fields should remain compatible where practical.
- New `/statusz` fields should be additive.
- Shells must ignore unknown fields.
- Shells must tolerate missing optional fields.
- The core should not expose secrets in status or health responses.

### Startup Compatibility

- `--config` is the primary stable binary startup argument.
- Login flags are foreground operations, not normal server startup modes.
- `--standalone` should not be repurposed as the generic desktop-sidecar flag without a separate compatibility decision.
- A future `--sidecar` flag may be introduced if repeated desktop integrations need a dedicated mode.

### Directory Compatibility

- `auth-dir` is the stable config key for auth material.
- Log paths are resolved by core logic and should not be hard-coded by shells.
- Shells should store their own UI preferences outside the core auth directory unless they are intentionally part of the core configuration.

## Reference Desktop Shell Design

A reference desktop shell can be designed around these pages and modules without importing them into this repository:

| Shell module | Responsibility | Core contract used |
| --- | --- | --- |
| First-run setup | Select binary, config, port, auth directory. | File generation, `--config`, `/healthz`, `/statusz`. |
| Service monitor | Start, stop, restart, show readiness/crash state. | Process lifecycle, stdout/stderr, probes. |
| Account center | Trigger provider login and show safe account status. | Login subprocesses, optional management APIs. |
| Config editor | Edit safe config fields. | `config.yaml`, restart/hot-reload decisions. |
| Log viewer | Show process logs and safe file logs. | stdout/stderr, optional file log discovery. |
| Provider/model view | Show provider/model summaries. | `/statusz`, optional management APIs. |
| Security settings | Configure localhost binding and management key. | `host`, `remote-management`, shell secret storage. |

This reference shell may be implemented in Tauri, Electron, native desktop, webview, or another technology. That implementation belongs outside this repository unless a separate product decision is made.

## Existing vs Optional vs Future

### Exists Today

- Binary server startup with `--config`.
- OAuth/login command flags.
- `auth-dir` configuration.
- `GET/HEAD /healthz`.
- `GET/HEAD /statusz`.
- Safe `/statusz` provider summaries without secret leakage.
- Signal-aware service startup and shutdown paths.
- SDK builder with sidecar runtime info.
- Optional management routes controlled by secret configuration or runtime environment.
- Optional `/keep-alive` when explicitly enabled by server construction.

### Optional Today

- Management API use by a desktop shell.
- Runtime local management password.
- File log discovery.
- Request/error log display.
- `--local-model` for deterministic registry behavior.
- Login flows with shell-controlled browser behavior via `--no-browser`.

### Future Extension Candidates

- Dedicated `--sidecar` mode.
- Richer core lifecycle statuses beyond `ready`.
- Stable account status API that exposes safe account metadata only.
- Stable log manifest or log streaming API.
- Sidecar manifest/status file for shells that cannot rely on HTTP during startup.
- Explicit restart-required signaling.
- Port negotiation or dynamic-port discovery.
- Reference controller example that starts, probes, and stops the sidecar.

## Implementation Phases

### Phase 1: Documentation and Contract Alignment

- Add this contract design document.
- Keep the existing sidecar/cockpit design as background reference or supersede it with this generic contract.
- Document startup flags accurately.
- Document `/healthz` and `/statusz` as the baseline HTTP contract.
- Document management API as optional.
- Document `auth-dir` and log resolution caveats.

### Phase 2: Contract Tests and Examples

- Keep or extend tests for `/healthz` and `/statusz`.
- Add regression tests for no secret leakage if status fields grow.
- Add a minimal controller example that starts the binary, waits for `/healthz`, reads `/statusz`, and stops the process.
- Add documentation for safe desktop defaults.

### Phase 3: Sidecar Ergonomics

- Consider a dedicated `--sidecar` flag if needed.
- Consider a stable resolved-runtime manifest endpoint or file.
- Improve login subprocess output for shell parsing without leaking secrets.
- Improve account-safe summary APIs through authenticated management routes.

### Phase 4: Reference Desktop Shell Outside Core

- Build a desktop shell outside this repository if desired.
- Use this contract as the integration boundary.
- Keep UI, Tauri/Electron/native packaging, account pages, and tray behavior in that external product.

## Testing Strategy

Documentation-only changes do not require a full Go test run.

For Go code changes related to this contract, run at minimum:

```text
gofmt -w .
go build -o test-output ./cmd/server
```

For API contract changes, also run relevant tests such as:

```text
go test ./internal/api
```

For broader changes, run:

```text
go test ./...
```

Any new or changed health/status behavior should include tests for:

- HTTP method behavior for `GET` and `HEAD`.
- Valid JSON response bodies for `GET`.
- No response body for `HEAD`.
- Safe build/runtime/server fields.
- No leakage of provider secrets, management secrets, OAuth tokens, auth files, or raw config secrets.
- Backward compatibility for documented fields.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Shell-specific assumptions leak into the core | Keep the contract generic and avoid product-specific directories or UI concepts. |
| Desktop UI scope expands this Go repository | Keep shell UI and packaging outside this repository. |
| `--standalone` is misused by desktop shells | Document it as TUI-specific current behavior, not the generic sidecar mode. |
| Management API is assumed to be always available | Document it as optional and authenticated. |
| `/keep-alive` becomes an accidental hard dependency | Keep it optional and outside Phase 1 baseline. |
| Status endpoint leaks secrets | Use allowlisted fields and regression tests. |
| Log paths are hard-coded incorrectly | Treat stdout/stderr as baseline and file logs as best-effort until a stable log API exists. |
| OAuth output leaks sensitive data in shell UI | Redact subprocess output and display only user-safe login instructions. |
| Remote binding exposes local credentials | Prefer `127.0.0.1` defaults and authenticated management routes. |

## Acceptance Criteria

- The repository has a formal generic desktop-shell sidecar contract.
- The contract accurately documents existing startup flags and avoids treating `--standalone` as a generic desktop sidecar flag.
- The contract includes existing `/healthz` and `/statusz` behavior.
- The contract documents `auth-dir` with the correct YAML key.
- The contract describes log behavior without hard-coding a single directory.
- The contract treats management API and `/keep-alive` as optional capabilities.
- The contract distinguishes current core status from future lifecycle extensions.
- The contract includes process lifecycle and security guidance for external shells.
- The contract keeps UI/Tauri/React/Rust implementation outside this repository.
