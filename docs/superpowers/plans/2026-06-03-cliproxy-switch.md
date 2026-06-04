# CLIProxy Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compiled Go command-line switch tool that starts cli_LH in normal or DeepSeek direct mode and updates the double-click launcher to use it.

**Architecture:** Add a new standalone command at `cmd/cliproxy-switch/` using only the Go standard library. The tool probes the local server, detects Codex auth files, selects `config.yaml` or `config.deepseek.yaml`, then starts `bin/server.exe` with the selected config. Existing server/provider internals remain unchanged.

**Tech Stack:** Go 1.26, Windows batch, YAML config, cli_LH server binary.

---

## File Structure

- Create `cmd/cliproxy-switch/main.go`: the new CLI entry point, command parsing, status probing, auto mode selection, and server startup.
- Create `config.deepseek.yaml`: independent DeepSeek direct configuration that does not mutate `config.yaml`.
- Modify `启动服务.bat`: call `bin\cliproxy-switch.exe start --auto` and show build instructions if missing.
- Optionally leave `start.ps1` unchanged for legacy/manual use.

---

### Task 1: Add the CLI command skeleton and status checks

**Files:**
- Create: `cmd/cliproxy-switch/main.go`

- [ ] **Step 1: Create the initial CLI file**

Create `cmd/cliproxy-switch/main.go` with this complete content:

```go
package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	defaultHost       = "127.0.0.1"
	defaultPort       = "8317"
	defaultAPIKey     = "sk-your-secret-key-change-me"
	serverBinary      = "bin/server.exe"
	normalConfig      = "config.yaml"
	deepSeekConfig    = "config.deepseek.yaml"
	codexAuthGlob     = "auths/codex-*.json"
	defaultHTTPClient = 3 * time.Second
)

type statusInfo struct {
	ServerBinaryExists bool
	NormalConfigExists bool
	DeepSeekConfigExists bool
	CodexAuthCount int
	PortOpen bool
	ModelsReachable bool
	Models []string
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "[!] %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return nil
	}

	switch args[0] {
	case "status":
		return runStatus()
	case "start":
		return errors.New("start command is not implemented yet")
	case "use":
		return errors.New("use command is not implemented yet")
	case "help", "-h", "--help":
		printUsage()
		return nil
	default:
		printUsage()
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func printUsage() {
	fmt.Println("CLIProxy Switch")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  cliproxy-switch status")
	fmt.Println("  cliproxy-switch start [--auto|--mode normal|--mode deepseek]")
	fmt.Println("  cliproxy-switch use auto|normal|deepseek")
}

func runStatus() error {
	info := collectStatus()
	printStatus(info)
	return nil
}

func collectStatus() statusInfo {
	models, modelsReachable := probeModels(defaultHost, defaultPort, defaultAPIKey)
	return statusInfo{
		ServerBinaryExists: fileExists(serverBinary),
		NormalConfigExists: fileExists(normalConfig),
		DeepSeekConfigExists: fileExists(deepSeekConfig),
		CodexAuthCount: countMatches(codexAuthGlob),
		PortOpen: isPortOpen(defaultHost, defaultPort),
		ModelsReachable: modelsReachable,
		Models: models,
	}
}

func printStatus(info statusInfo) {
	fmt.Println("CLIProxy Switch Status")
	fmt.Println("======================")
	printBool("server binary", info.ServerBinaryExists, serverBinary)
	printBool("normal config", info.NormalConfigExists, normalConfig)
	printBool("deepseek config", info.DeepSeekConfigExists, deepSeekConfig)
	fmt.Printf("codex auth files: %d\n", info.CodexAuthCount)
	printBool("port 8317 open", info.PortOpen, "127.0.0.1:8317")
	printBool("models endpoint", info.ModelsReachable, "/v1/models")
	if len(info.Models) > 0 {
		fmt.Printf("models: %s\n", strings.Join(info.Models, ", "))
	}
}

func printBool(label string, ok bool, detail string) {
	mark := "-"
	if ok {
		mark = "+"
	}
	fmt.Printf("[%s] %s: %s\n", mark, label, detail)
}

func fileExists(path string) bool {
	stat, err := os.Stat(path)
	return err == nil && !stat.IsDir()
}

func countMatches(pattern string) int {
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return 0
	}
	count := 0
	for _, match := range matches {
		if fileExists(match) {
			count++
		}
	}
	return count
}

func isPortOpen(host string, port string) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), defaultHTTPClient)
	if err != nil {
		return false
	}
	defer func() {
		_ = conn.Close()
	}()
	return true
}

func probeModels(host string, port string, apiKey string) ([]string, bool) {
	client := &http.Client{Timeout: defaultHTTPClient}
	url := fmt.Sprintf("http://%s/v1/models", net.JoinHostPort(host, port))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, false
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, false
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, false
	}

	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, false
	}

	models := make([]string, 0, len(payload.Data))
	for _, model := range payload.Data {
		if strings.TrimSpace(model.ID) != "" {
			models = append(models, model.ID)
		}
	}
	return models, true
}

var _ = flag.ErrHelp
```

- [ ] **Step 2: Format the new Go file**

Run: `gofmt -w .\cmd\cliproxy-switch\main.go`

Expected: command exits successfully with no output.

- [ ] **Step 3: Build the CLI skeleton**

Run: `go build -o bin/cliproxy-switch.exe ./cmd/cliproxy-switch`

Expected: command exits successfully and creates `bin/cliproxy-switch.exe`.

- [ ] **Step 4: Run status**

Run: `.\bin\cliproxy-switch.exe status`

Expected: output starts with `CLIProxy Switch Status` and reports config/auth/server checks.

- [ ] **Step 5: Commit**

Run:

```powershell
git add cmd/cliproxy-switch/main.go
git commit -m "feat: add cliproxy switch status command"
```

Expected: commit succeeds if the workspace uses git. If commits are not desired in this local workspace, record that the commit step was skipped.

---

### Task 2: Implement mode selection and start behavior

**Files:**
- Modify: `cmd/cliproxy-switch/main.go`

- [ ] **Step 1: Replace the placeholder command handling**

In `run(args []string)`, replace the `start` and `use` cases with:

```go
	case "start":
		return runStart(args[1:])
	case "use":
		return runUse(args[1:])
```

- [ ] **Step 2: Add mode constants and selectedMode type**

After the existing `const` block, add:

```go
type selectedMode string

const (
	modeAuto selectedMode = "auto"
	modeNormal selectedMode = "normal"
	modeDeepSeek selectedMode = "deepseek"
)
```

- [ ] **Step 3: Add start/use functions**

Add these functions after `runStatus()`:

```go
func runStart(args []string) error {
	fs := flag.NewFlagSet("start", flag.ContinueOnError)
	fs.SetOutput(os.Stdout)
	auto := fs.Bool("auto", false, "automatically choose normal or deepseek mode")
	modeText := fs.String("mode", "auto", "startup mode: auto, normal, or deepseek")
	if err := fs.Parse(args); err != nil {
		return err
	}

	mode, err := parseMode(*modeText)
	if err != nil {
		return err
	}
	if *auto {
		mode = modeAuto
	}
	if mode == modeAuto {
		mode = chooseMode(collectStatus())
	}
	return startSelectedMode(mode)
}

func runUse(args []string) error {
	if len(args) != 1 {
		return errors.New("usage: cliproxy-switch use auto|normal|deepseek")
	}
	mode, err := parseMode(args[0])
	if err != nil {
		return err
	}
	if mode == modeAuto {
		mode = chooseMode(collectStatus())
	}
	return startSelectedMode(mode)
}

func parseMode(value string) (selectedMode, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "auto", "":
		return modeAuto, nil
	case "normal", "config":
		return modeNormal, nil
	case "deepseek", "ds":
		return modeDeepSeek, nil
	default:
		return "", fmt.Errorf("unknown mode %q", value)
	}
}

func chooseMode(info statusInfo) selectedMode {
	if info.PortOpen || info.ModelsReachable {
		fmt.Println("[+] existing cli_LH service detected; keeping current service")
		return modeAuto
	}
	if info.CodexAuthCount > 0 && info.NormalConfigExists {
		fmt.Println("[+] Codex/OAI auth found; selecting normal mode")
		return modeNormal
	}
	fmt.Println("[!] Codex/OAI auth unavailable; selecting DeepSeek direct mode")
	return modeDeepSeek
}

func startSelectedMode(mode selectedMode) error {
	info := collectStatus()
	if info.ModelsReachable || info.PortOpen {
		printStatus(info)
		fmt.Println("[+] service is already running; no duplicate process started")
		return nil
	}

	configPath := normalConfig
	if mode == modeDeepSeek {
		configPath = deepSeekConfig
	}
	if mode == modeAuto {
		return errors.New("auto mode did not resolve to a concrete mode")
	}
	if !fileExists(serverBinary) {
		return fmt.Errorf("server binary missing: %s", serverBinary)
	}
	if !fileExists(configPath) {
		return fmt.Errorf("selected config missing: %s", configPath)
	}

	fmt.Printf("[+] selected mode: %s\n", mode)
	fmt.Printf("[+] selected config: %s\n", configPath)
	fmt.Printf("[+] local API: http://%s\n", net.JoinHostPort(defaultHost, defaultPort))
	return startServer(configPath)
}
```

- [ ] **Step 4: Add process startup function**

Add `os/exec` to the import list.

Add this function after `startSelectedMode()`:

```go
func startServer(configPath string) error {
	cmd := exec.Command(serverBinary, "--config", configPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	cmd.Dir = "."
	fmt.Println("[+] starting cli_LH; press Ctrl+C to stop")
	return cmd.Run()
}
```

- [ ] **Step 5: Format and build**

Run:

```powershell
gofmt -w .\cmd\cliproxy-switch\main.go
go build -o bin/cliproxy-switch.exe ./cmd/cliproxy-switch
```

Expected: both commands exit successfully.

- [ ] **Step 6: Run non-starting validation**

Run: `.\bin\cliproxy-switch.exe status`

Expected: status prints without starting a new server.

- [ ] **Step 7: Commit**

Run:

```powershell
git add cmd/cliproxy-switch/main.go
git commit -m "feat: add cliproxy switch startup modes"
```

Expected: commit succeeds if git commits are being used.

---

### Task 3: Add DeepSeek direct configuration

**Files:**
- Create: `config.deepseek.yaml`

- [ ] **Step 1: Create DeepSeek config**

Create `config.deepseek.yaml` with this content. Use the local DeepSeek key from the private workspace only if this file will remain local; otherwise replace it with a placeholder before sharing or committing.

```yaml
# ============================================================
# cli_LH - DeepSeek direct mode
# ============================================================

host: "127.0.0.1"
port: 8317

tls:
  enable: false
  cert: ""
  key: ""

remote-management:
  allow-remote: false
  secret-key: ""
  disable-control-panel: false
  panel-github-repository: "https://github.com/router-for-me/cli_LH-Management-Center"

auth-dir: "auths"

api-keys:
  - "sk-your-secret-key-change-me"

debug: true

# DeepSeek direct mode intentionally bypasses the local proxy.
proxy-url: ""

request-retry: 3
max-retry-credentials: 0
max-retry-interval: 30
disable-cooling: false
usage-statistics-enabled: false
redis-usage-queue-retention-seconds: 60
logging-to-file: false
logs-max-total-size-mb: 0

openai-compatibility:
  - name: "deepseek"
    base-url: "https://api.deepseek.com"
    api-key-entries:
      - api-key: "REPLACE_WITH_DEEPSEEK_API_KEY"
    models:
      - name: "deepseek-v4-pro"
        alias: "deepseek-v4-pro"
      - name: "deepseek-v4-flash"
        alias: "deepseek-v4-flash"
      - name: "deepseek-chat"
        alias: "deepseek-chat"
      - name: "deepseek-reasoner"
        alias: "deepseek-reasoner"
```

- [ ] **Step 2: Decide local key handling**

If this workspace is only local and the user expects immediate operation, replace `REPLACE_WITH_DEEPSEEK_API_KEY` with the key already present in local `config.yaml`. Do not print the key in terminal output.

If the result may be shared or committed publicly, keep the placeholder and document that the user must fill it.

- [ ] **Step 3: Run status**

Run: `.\bin\cliproxy-switch.exe status`

Expected: `deepseek config` line is marked present.

- [ ] **Step 4: Commit**

Run:

```powershell
git add config.deepseek.yaml
git commit -m "feat: add deepseek direct config"
```

Expected: commit succeeds if git commits are being used and no secret is being committed accidentally.

---

### Task 4: Update the double-click launcher

**Files:**
- Modify: `启动服务.bat`

- [ ] **Step 1: Replace batch file content**

Replace `启动服务.bat` with:

```bat
@echo off
:: ============================================================
:: cli_LH launcher - double click to start
:: ============================================================
cd /d "%~dp0"

if exist ".\bin\cliproxy-switch.exe" (
    ".\bin\cliproxy-switch.exe" start --auto
) else (
    echo [!] Missing .\bin\cliproxy-switch.exe
    echo Build it with:
    echo     go build -o bin/cliproxy-switch.exe ./cmd/cliproxy-switch
    echo.
    pause
)
```

- [ ] **Step 2: Verify file content**

Run: `Get-Content .\启动服务.bat`

Expected: it contains `cliproxy-switch.exe start --auto` and the build instruction.

- [ ] **Step 3: Commit**

Run:

```powershell
git add 启动服务.bat
git commit -m "chore: route launcher through cliproxy switch"
```

Expected: commit succeeds if git commits are being used.

---

### Task 5: End-to-end verification

**Files:**
- Verify: `cmd/cliproxy-switch/main.go`
- Verify: `config.deepseek.yaml`
- Verify: `启动服务.bat`

- [ ] **Step 1: Format Go code**

Run: `gofmt -w .\cmd\cliproxy-switch\main.go`

Expected: command exits successfully.

- [ ] **Step 2: Build switch CLI**

Run: `go build -o bin/cliproxy-switch.exe ./cmd/cliproxy-switch`

Expected: `bin\cliproxy-switch.exe` is produced.

- [ ] **Step 3: Verify server compile**

Run:

```powershell
go build -o test-output ./cmd/server
Remove-Item .\test-output -Force
```

Expected: build succeeds and `test-output` is removed.

- [ ] **Step 4: Run status command**

Run: `.\bin\cliproxy-switch.exe status`

Expected: status reports server binary, configs, Codex auth count, port state, and model endpoint state.

- [ ] **Step 5: Run help command**

Run: `.\bin\cliproxy-switch.exe help`

Expected: output shows the command usage.

- [ ] **Step 6: Optional start smoke test**

Only run this if no existing server is needed or if the user approves starting a foreground server:

Run: `.\bin\cliproxy-switch.exe start --mode deepseek`

Expected: the CLI prints selected mode/config and starts `bin/server.exe`. Stop with Ctrl+C after confirming it begins startup.

- [ ] **Step 7: Final commit**

Run:

```powershell
git status --short
git add cmd/cliproxy-switch/main.go config.deepseek.yaml 启动服务.bat docs/superpowers/specs/2026-06-03-cliproxy-switch-design.md docs/superpowers/plans/2026-06-03-cliproxy-switch.md
git commit -m "feat: add cliproxy deepseek switch launcher"
```

Expected: commit succeeds if git commits are being used. If intermediate commits were already made, this final commit may have nothing to commit.

---

## Self-Review

- Spec coverage: covered Go CLI, project integration, auto detection, DeepSeek direct config, batch launcher, and verification.
- Placeholder scan: no implementation step depends on undefined behavior; the only intentional placeholder is `REPLACE_WITH_DEEPSEEK_API_KEY`, with an explicit decision step to either keep it safe or replace it locally.
- Type consistency: `selectedMode`, `statusInfo`, `runStart`, `runUse`, `chooseMode`, and `startSelectedMode` are named consistently across tasks.
