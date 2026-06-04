# Sidecar Integration Guide

`cli_LH` can be controlled by an external desktop shell as a local sidecar process. The shell owns UI and process lifecycle; `cli_LH` owns proxy execution, provider adapters, OAuth/login flows, auth storage, model registry, and safe status endpoints.

For the full contract, see `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`.

## Recommended Startup

Build the server binary first:

```text
go build -o cli_LH ./cmd/server
```

Start the sidecar with an explicit config file:

```text
cli_LH --config <path-to-config.yaml>
```

Optional deterministic local-model startup:

```text
cli_LH --config <path-to-config.yaml> --local-model
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

## Login Flows

Run login flows as foreground subprocesses using the same config file:

```text
cli_LH --codex-login --config <path-to-config.yaml>
cli_LH --codex-device-login --config <path-to-config.yaml>
cli_LH --claude-login --config <path-to-config.yaml>
```

Use `--no-browser` only when the shell wants to own browser opening or device-code presentation.

## Management API

The management API is optional and authenticated. Do not assume `/v0/management` exists after startup. If a desktop shell needs management APIs, configure a management secret deliberately and keep the service bound to localhost unless the user explicitly chooses remote access.

## Logs

For Phase 1 integrations, capture child-process stdout and stderr. File log paths are resolved by the core and should not be hard-coded by shells.

## Example Controller

A minimal process-launching controller is available at `examples/sidecar-controller`.

Build it:

```text
go build ./examples/sidecar-controller
```

Run it with an already-built server binary:

```text
sidecar-controller --binary <path-to-cli_LH> --config <path-to-config.yaml> --base-url http://127.0.0.1:<port>
```
