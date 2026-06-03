# Sidecar Integration Guide

`CLIProxyAPI` can run as a local sidecar for desktop shells, web panels, editor extensions, or other local controllers.

## Shell/Core Separation

The shell owns user interaction. The core owns proxy execution.

Examples of shells:

- Tauri or Electron desktop tools
- web management panels
- VS Code extensions
- command-line wrappers

`CLIProxyAPI` should remain the core service. Shells should start it, pass explicit configuration, monitor it, and call its HTTP APIs.

## Recommended Launch Commands

Start the proxy service with a shell-owned config file:

```text
cli-proxy-api --config <config.yaml> --local-model --no-browser
```

Start an isolated local service mode:

```text
cli-proxy-api --standalone --config <config.yaml> --local-model --no-browser
```

Run Codex OAuth login as a separate foreground operation:

```text
cli-proxy-api --codex-login --config <config.yaml> --no-browser
```

Run Codex device login when browser automation is not desired:

```text
cli-proxy-api --codex-device-login --config <config.yaml> --no-browser
```

## Health and Status

Use `/healthz` for a minimal readiness check:

```text
GET /healthz
```

Expected response:

```json
{"status":"ok"}
```

Use `/statusz` for machine-readable sidecar metadata:

```text
GET /statusz
```

Expected response shape:

```json
{
  "status": "ready",
  "service": "CLIProxyAPI",
  "build": {
    "version": "dev",
    "commit": "none",
    "buildDate": "unknown"
  },
  "server": {
    "host": "127.0.0.1",
    "port": 8317,
    "configPath": "C:/path/to/config.yaml",
    "authDir": "C:/path/to/auths"
  },
  "runtime": {
    "tuiMode": false,
    "standalone": false,
    "localModel": true
  },
  "providers": {
    "geminiApiKeys": 0,
    "codexApiKeys": 0,
    "claudeApiKeys": 0,
    "openaiCompatibilityEntries": 0,
    "vertexApiKeys": 0,
    "oauthModelAliases": 0,
    "homeEnabled": false
  }
}
```

The status endpoint intentionally exposes only allowlisted metadata and must not expose API keys, OAuth tokens, management passwords, or provider secrets.

## Configuration Ownership

The shell may create or edit a `CLIProxyAPI` `config.yaml`, but `CLIProxyAPI` does not read shell-specific configuration schemas.

Recommended shell responsibilities:

1. Choose a config file path.
2. Choose an auth directory.
3. Start `CLIProxyAPI` with explicit arguments.
4. Poll `/healthz` or `/statusz` until ready.
5. Call proxy and management APIs over localhost.
6. Stop the sidecar process during application shutdown.

## Security Notes

- Prefer binding to `127.0.0.1` for desktop integrations.
- Keep management APIs protected by configured credentials.
- Do not display raw tokens or API keys in shell logs.
- Treat config and auth directories as sensitive local data.
