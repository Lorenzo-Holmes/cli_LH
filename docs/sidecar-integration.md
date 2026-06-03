# Sidecar Integration Guide

`CLIProxyAPI` can be controlled by an external desktop shell as a local sidecar process. The shell owns UI and process lifecycle; `CLIProxyAPI` owns proxy execution, provider adapters, OAuth/login flows, auth storage, model registry, and safe status endpoints.

For the full contract, see `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`.

## Recommended Startup

Build the server binary first:

```text
go build -o cli-proxy-api ./cmd/server
```

Start with an explicit config file:

```text
cli-proxy-api --config <path-to-config.yaml>
```

For shell/controller integrations, use the sidecar profile:

```text
cli-proxy-api --sidecar --config <path-to-config.yaml>
```

The sidecar profile applies local-controller defaults while preserving explicit config values:

- enables `--local-model`
- enables `--no-browser`
- defaults an empty host to `127.0.0.1`

Optional status-file output for controllers:

```text
cli-proxy-api --sidecar --config <path-to-config.yaml> --sidecar-status-file <runtime-dir>/server.json
```

Direct deterministic local-model startup is also supported:

```text
cli-proxy-api --config <path-to-config.yaml> --local-model
```

Do not use `--standalone` as a generic desktop sidecar flag. It currently belongs to TUI standalone behavior.

## Health and Status

Use `/healthz` for liveness:

```text
GET http://127.0.0.1:<port>/healthz
```

Expected response:

```json
{"status":"ok"}
```

Use `/statusz` for machine-readable readiness and safe runtime metadata:

```text
GET http://127.0.0.1:<port>/statusz
```

The current core status value is `ready`. Other lifecycle states such as `starting`, `stopping`, or `crashed` should be maintained by the external shell unless explicitly added to the core in the future.

When `--sidecar` is enabled, `/statusz.runtime.sidecar` is `true`.

## Sidecar Status File

When `--sidecar-status-file` is provided, `CLIProxyAPI` writes a small JSON metadata file after startup. The file includes only operational metadata such as `baseURL`, `healthURL`, `statusURL`, `configPath`, `authDir`, safe runtime flags, build metadata, and write time. It must not contain provider API keys, OAuth tokens, or management passwords.

## Login Flows

Run login flows as foreground subprocesses using the same config file:

```text
cli-proxy-api --codex-login --config <path-to-config.yaml>
cli-proxy-api --codex-device-login --config <path-to-config.yaml>
cli-proxy-api --claude-login --config <path-to-config.yaml>
```

Use `--no-browser` only when the shell wants to own browser opening or device-code presentation.

## Management API

The management API is optional and authenticated. Do not assume `/v0/management` exists after startup. If a desktop shell needs management APIs, configure a management secret deliberately and keep the service bound to localhost unless the user explicitly chooses remote access.

## Logs

For Phase 1 integrations, capture child-process stdout and stderr. File log paths are resolved by the core and should not be hard-coded by shells.

## Example Controller

A minimal process-launching controller is available under `examples/sidecar-controller`.

The integration baseline is:

1. Start `cli-proxy-api --sidecar --config <path-to-config.yaml> --sidecar-status-file <runtime-dir>/server.json` as a child process.
2. Capture stdout and stderr.
3. Read the status file after startup.
4. Poll `healthURL` until the HTTP server is alive.
5. Call `statusURL` and wait for `status: "ready"`.
6. Stop the child process gracefully when the shell exits.

## Security Defaults

- Prefer `host: 127.0.0.1` for desktop integrations.
- Treat `auth-dir` contents as sensitive.
- Do not show raw provider tokens, OAuth tokens, API keys, or management passwords.
- Keep management APIs localhost-only unless the user explicitly enables remote exposure.
