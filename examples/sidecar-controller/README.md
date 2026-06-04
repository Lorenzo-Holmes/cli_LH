# Sidecar Controller Example

This example shows the smallest controller-side integration point for a desktop shell or supervisor. It reads the safe `server.json` file produced by `cli-proxy-api --sidecar-status-file`, checks the sidecar health endpoint, and prints the resolved base URL.

## Start the Sidecar

Build the server binary first:

```text
go build -o cli-proxy-api ./cmd/server
```

Start the server in sidecar mode and ask it to write runtime metadata:

```text
cli-proxy-api --sidecar --config <path-to-config.yaml> --sidecar-status-file <runtime-dir>/server.json
```

The sidecar profile applies local shell/controller defaults:

- `--local-model`
- `--no-browser`
- `127.0.0.1` as the default host when the config host is empty

## Run the Controller

```text
go run ./examples/sidecar-controller --status-file <runtime-dir>/server.json
```

Expected output:

```text
Sidecar CLIProxyAPI is ready at http://127.0.0.1:<port> (pid=<pid>)
```

## Contract Notes

The status file is intended for safe process discovery only. Controllers should treat these fields as operational metadata and must not expect API keys, OAuth tokens, management passwords, or raw provider credentials to appear there.

The controller should still use `/healthz` for liveness and `/statusz` for machine-readable readiness after reading the status file.
