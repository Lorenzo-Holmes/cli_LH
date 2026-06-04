# CLIProxy Switch Design

## Goal

Add a small compiled Go command-line application, similar in spirit to `ccswitch`, that makes this repository easier to start and switch into a DeepSeek direct mode when the normal CLI/Codex path is unavailable.

The tool should be simple, local-first, and safe: it must not overwrite the user's existing `config.yaml`. DeepSeek direct mode will use a separate configuration file.

## Scope

In scope:

- Add a new Go CLI command under `cmd/cliproxy-switch/`.
- Add an independent DeepSeek direct configuration file, `config.deepseek.yaml`.
- Update `启动服务.bat` so double-click startup uses the new switch tool.
- Keep `start.ps1` available as a legacy/manual launcher unless implementation finds a small compatibility update is needed.
- Provide commands for status checks, startup, and mode selection.

Out of scope for the first version:

- A full graphical desktop application.
- A separate web control server for start/stop operations.
- Mutating `config.yaml` automatically.
- Adding new server-side provider logic inside `internal/translator/` or runtime executors.

## User Experience

The compiled executable should live at:

- `bin/cliproxy-switch.exe`

Expected command shape:

- `cliproxy-switch status`
- `cliproxy-switch start`
- `cliproxy-switch start --auto`
- `cliproxy-switch use deepseek`
- `cliproxy-switch use auto`

For double-click usage, `启动服务.bat` should call:

- `bin\cliproxy-switch.exe start --auto`

If the executable is missing, the batch file should show a clear build instruction, for example:

- `go build -o bin/cliproxy-switch.exe ./cmd/cliproxy-switch`

## Modes

### Auto mode

Auto mode decides which config to use before starting `bin/server.exe`.

Checks:

1. Check whether `127.0.0.1:8317` is already serving `/v1/models`.
2. Check whether Codex/OAI auth material exists, using `auths/codex-*.json` as the local signal.
3. If the service is already online, print status and do not start a duplicate server.
4. If Codex/OAI auth material is present, prefer the normal `config.yaml` path.
5. If Codex/OAI auth material is missing or unusable, use `config.deepseek.yaml`.

The first implementation can treat missing `auths/codex-*.json` as unavailable. If a lightweight request-based validation is straightforward, it can be added without blocking startup.

### DeepSeek mode

DeepSeek mode always starts `bin/server.exe` with:

- `--config config.deepseek.yaml`

The config should expose at least a DeepSeek Pro-style alias. Based on the existing local configuration, the first version should include aliases such as:

- `deepseek-v4-pro`
- `deepseek-v4-flash`
- `deepseek-chat`
- `deepseek-reasoner`

The tool should not print API keys or secrets.

### Normal mode

Normal mode starts `bin/server.exe` with:

- `--config config.yaml`

It should preserve existing behavior for users who already have Codex/OAI auth configured.

## Architecture

### New command package

Add:

- `cmd/cliproxy-switch/main.go`

Keep the first version small and dependency-light. Standard library argument parsing is enough unless the repository already uses a CLI framework in nearby code.

Suggested internal structure inside the command:

- `main()` parses command and flags.
- `runStatus()` checks server binary, config files, port, model endpoint, and Codex auth files.
- `runStart(mode string, auto bool)` chooses config and starts `bin/server.exe`.
- `chooseMode()` implements auto detection.
- `startServer(configPath string)` starts the server as a child process and streams output or waits interactively.
- `probeModels()` queries `/v1/models` with the configured local API key if available.

No changes are planned under `internal/translator/`.

### Configuration files

Add:

- `config.deepseek.yaml`

This file should be based on the existing `config.yaml` but should be intentionally direct:

- `proxy-url: ""`
- `openai-compatibility` provider named `deepseek`
- `base-url: "https://api.deepseek.com"`
- aliases for DeepSeek models

If a real key is already present in local `config.yaml`, implementation should avoid hardcoding it into a committed-style template unless this workspace is purely local. Prefer a placeholder plus clear instructions if there is any risk of leaking secrets.

### Batch launcher

Update:

- `启动服务.bat`

Behavior:

1. Change to repository root.
2. If `bin\cliproxy-switch.exe` exists, run `bin\cliproxy-switch.exe start --auto`.
3. If missing, print the build command and pause.

## Error Handling

The tool should report clear status lines:

- Server binary missing.
- Normal config missing.
- DeepSeek config missing.
- Port already in use.
- Existing service online.
- Codex auth found or missing.
- Selected mode.
- API base URL and local server URL.

Failures should return non-zero exit codes. The tool should not call `log.Fatal` or panic.

## Testing and Verification

Implementation should verify:

1. `gofmt -w` on new Go files.
2. `go build -o bin/cliproxy-switch.exe ./cmd/cliproxy-switch`.
3. `go build -o test-output ./cmd/server` then remove `test-output`.
4. `bin\cliproxy-switch.exe status` runs without crashing.
5. `启动服务.bat` points to the new executable and has a useful fallback message.

If the server is started during verification, the test should avoid leaving duplicate long-running processes behind.

## Open Decisions

None. The user selected:

- Go compiled CLI application.
- Add it to the current Go project.
- Auto detection uses both service/port state and Codex/OAI availability.
- DeepSeek direct mode uses an independent `config.deepseek.yaml` rather than mutating `config.yaml`.
