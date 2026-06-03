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

Start with the sidecar profile enabled:

```text
cli-proxy-api --sidecar --config <config.yaml>
```

The sidecar profile applies safe local-controller defaults:

- `--local-model`
- `--no-browser`
- `127.0.0.1` host when the config has no explicit host

Write a launch metadata file for a shell/controller:

```text
cli-proxy-api --sidecar --config <config.yaml> --sidecar-status-file <runtime-dir>/server.json
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
    "sidecar": true,
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

## Sidecar Status File

When `--sidecar-status-file` is provided, `CLIProxyAPI` writes a JSON file after the service starts successfully. This is useful when a controller launches the sidecar as a child process and needs the final localhost URL without scraping logs.

Example `server.json`:

```json
{
  "status": "ready",
  "service": "CLIProxyAPI",
  "pid": 12345,
  "baseURL": "http://127.0.0.1:8317",
  "healthURL": "http://127.0.0.1:8317/healthz",
  "statusURL": "http://127.0.0.1:8317/statusz",
  "configPath": "C:/path/to/config.yaml",
  "authDir": "C:/path/to/auths",
  "runtime": {
    "sidecar": true,
    "tuiMode": false,
    "standalone": false,
    "localModel": true
  },
  "build": {
    "version": "dev",
    "commit": "none",
    "buildDate": "unknown"
  },
  "writtenAt": "2026-06-03T00:00:00Z"
}
```

The file is intentionally small and contains only operational metadata. It must not contain API keys, OAuth tokens, management passwords, or provider secrets.

## Controller Example

See `examples/sidecar-controller` for a minimal local controller. It reads `server.json` and verifies readiness through `HEAD /healthz`.

Example flow:

1. The shell starts `cli-proxy-api --sidecar --sidecar-status-file <runtime-dir>/server.json`.
2. The shell waits for `server.json` to appear.
3. The shell reads `healthURL`, `statusURL`, and `baseURL`.
4. The shell verifies readiness with `HEAD /healthz`.
5. The shell calls proxy or management APIs over localhost.

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
