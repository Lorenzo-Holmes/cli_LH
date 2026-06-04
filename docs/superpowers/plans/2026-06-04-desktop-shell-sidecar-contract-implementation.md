# Desktop Shell Sidecar Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop-shell sidecar contract into tracked repository artifacts, stronger regression tests, and a minimal runnable controller example.

**Architecture:** Keep the core Go server contract small and stable: `/healthz`, `/statusz`, existing startup flags, optional management routes, and SDK runtime metadata remain the integration boundary. Implementation focuses on contract hardening, documentation discoverability, and a standalone example; it does not add a desktop UI, Tauri, React, Rust, or new sidecar lifecycle states.

**Tech Stack:** Go 1.26+, Gin, existing `internal/api` tests, PowerShell-compatible Windows development workflow, Markdown documentation.

---

## Scope and Constraints

This plan implements Phase 1 and a narrow part of Phase 2 from `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`.

In scope:

- Make `docs/superpowers/specs/...` and `docs/superpowers/plans/...` trackable despite the current `docs/*` ignore rule.
- Add regression tests that lock down the current sidecar HTTP contract.
- Add tests for optional `/keep-alive` behavior so desktop shells do not treat it as always available.
- Add a minimal controller example that starts a binary, polls `/healthz` and `/statusz`, streams process logs, and stops the child process.
- Add user-facing integration documentation that points to the formal contract and example.

Out of scope:

- No desktop UI implementation.
- No Tauri, React, Electron, Rust, or Node.js integration.
- No new `--sidecar` flag.
- No new lifecycle states in `/statusz`.
- No management API redesign.
- No changes under `internal/translator/`.

## File Structure

Planned file changes:

- Modify: `.gitignore`
  - Responsibility: allow the new formal spec and implementation plan under `docs/superpowers/` to be tracked while keeping the broad `docs/*` ignore rule.

- Modify: `internal/api/server_test.go`
  - Responsibility: contract regression tests for `/healthz`, `/statusz`, status field shape, secret redaction, management route optionality, and `/keep-alive` optionality.

- Create: `examples/sidecar-controller/main.go`
  - Responsibility: minimal external controller example that launches an already-built sidecar binary, waits for probes, prints safe status JSON, and terminates the process.

- Create: `docs/sidecar-integration.md` or modify it if already present
  - Responsibility: short public-facing integration guide that links to the formal contract, explains binary startup, login subprocesses, health/status probes, management optionality, and the controller example.

- Existing reference, no modification required unless a task explicitly says so: `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`
  - Responsibility: formal contract source.

## Task 1: Track Superpowers Contract Documents

**Files:**
- Modify: `.gitignore`
- Verify existing: `docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md`
- Verify existing: `docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md`

- [ ] **Step 1: Check current ignore behavior**

Run:

```text
git check-ignore -v docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md
git check-ignore -v docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md
```

Expected before implementation: both paths are ignored by the `docs/*` rule.

- [ ] **Step 2: Modify `.gitignore` to unignore the superpowers docs subtree**

Update the documentation section in `.gitignore` from:

```text
# Documentation
docs/*
!docs/sidecar-integration.md
AGENTS.md
CLAUDE.md
GEMINI.md
```

to:

```text
# Documentation
docs/*
!docs/sidecar-integration.md
!docs/superpowers/
!docs/superpowers/**
AGENTS.md
CLAUDE.md
GEMINI.md
```

- [ ] **Step 3: Verify the files are no longer ignored**

Run:

```text
git check-ignore -v docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md
git check-ignore -v docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md
```

Expected: no output and exit code 1 for each path, meaning the files are not ignored.

- [ ] **Step 4: Verify Git sees the new docs**

Run:

```text
git status --short -- docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md .gitignore
```

Expected: `.gitignore` is modified and the two Markdown files appear as untracked or staged depending on local state.

- [ ] **Step 5: Commit**

Run:

```text
git add .gitignore docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md
git commit -m "docs: add desktop sidecar contract plan"
```

Expected: commit succeeds. If the repository policy for this session is not to commit automatically, stop after `git add` verification and report the exact files to commit.

## Task 2: Strengthen `/statusz` Contract Tests

**Files:**
- Modify: `internal/api/server_test.go`
- Existing implementation: `internal/api/sidecar_status.go`

- [ ] **Step 1: Add a field-shape regression test**

Append this test near the existing `TestStatuszReturnsMachineReadableSidecarStatus` tests in `internal/api/server_test.go`:

```go
func TestStatuszContractFieldShape(t *testing.T) {
	server := newTestServer(t)
	server.cfg.Host = "127.0.0.1"
	server.cfg.Port = 8317
	server.sidecarRuntime = SidecarRuntimeInfo{
		TUIMode:    false,
		Standalone: false,
		LocalModel: true,
	}

	req := httptest.NewRequest(http.MethodGet, "/statusz", nil)
	w := httptest.NewRecorder()
	server.engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status code: got %d want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to parse response JSON: %v; body=%s", err, w.Body.String())
	}

	for _, key := range []string{"status", "service", "build", "server", "runtime", "providers"} {
		if _, ok := payload[key]; !ok {
			t.Fatalf("status payload missing top-level key %q: %s", key, w.Body.String())
		}
	}
	if got, _ := payload["status"].(string); got != "ready" {
		t.Fatalf("status = %q, want ready", got)
	}
	if got, _ := payload["service"].(string); got != "cli_LH" {
		t.Fatalf("service = %q, want cli_LH", got)
	}

	serverInfo, ok := payload["server"].(map[string]any)
	if !ok {
		t.Fatalf("server field = %#v, want object", payload["server"])
	}
	for _, key := range []string{"host", "port", "configPath", "authDir"} {
		if _, ok := serverInfo[key]; !ok {
			t.Fatalf("server field missing key %q: %#v", key, serverInfo)
		}
	}

	runtimeInfo, ok := payload["runtime"].(map[string]any)
	if !ok {
		t.Fatalf("runtime field = %#v, want object", payload["runtime"])
	}
	for _, key := range []string{"tuiMode", "standalone", "localModel"} {
		if _, ok := runtimeInfo[key]; !ok {
			t.Fatalf("runtime field missing key %q: %#v", key, runtimeInfo)
		}
	}
	if got, _ := runtimeInfo["localModel"].(bool); !got {
		t.Fatalf("runtime.localModel = %v, want true", runtimeInfo["localModel"])
	}

	providerInfo, ok := payload["providers"].(map[string]any)
	if !ok {
		t.Fatalf("providers field = %#v, want object", payload["providers"])
	}
	for _, key := range []string{"geminiApiKeys", "codexApiKeys", "claudeApiKeys", "openaiCompatibilityEntries", "vertexApiKeys", "oauthModelAliases", "homeEnabled"} {
		if _, ok := providerInfo[key]; !ok {
			t.Fatalf("providers field missing key %q: %#v", key, providerInfo)
		}
	}
}
```

- [ ] **Step 2: Run the focused status tests**

Run:

```text
go test ./internal/api -run "TestStatusz" -count=1
```

Expected: PASS.

- [ ] **Step 3: If the test fails, fix only the mismatch**

If the test fails because the implementation shape differs from the current contract, inspect `internal/api/sidecar_status.go` and update only the minimal field or test assertion needed to match the formal contract:

- top-level keys: `status`, `service`, `build`, `server`, `runtime`, `providers`
- current status value: `ready`
- runtime keys: `tuiMode`, `standalone`, `localModel`
- provider summary counts only; no raw secret values

Do not add future lifecycle states in this task.

- [ ] **Step 4: Run the focused status tests again**

Run:

```text
go test ./internal/api -run "TestStatusz" -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```text
git add internal/api/server_test.go internal/api/sidecar_status.go
git commit -m "test: lock down sidecar status contract"
```

Expected: commit succeeds. If no implementation file changed, `git add internal/api/server_test.go` is sufficient.

## Task 3: Add Management and `/keep-alive` Optionality Tests

**Files:**
- Modify: `internal/api/server_test.go`
- Existing implementation: `internal/api/server.go`

- [ ] **Step 1: Add a management-disabled regression test**

Append this test in `internal/api/server_test.go` near existing management tests:

```go
func TestManagementRoutesDisabledWithoutSecret(t *testing.T) {
	t.Setenv("MANAGEMENT_PASSWORD", "")
	server := newTestServer(t)
	server.cfg.RemoteManagement.SecretKey = ""

	req := httptest.NewRequest(http.MethodGet, "/v0/management/config", nil)
	w := httptest.NewRecorder()
	server.engine.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("management route status = %d, want %d when no management secret is configured; body=%s", w.Code, http.StatusNotFound, w.Body.String())
	}
}
```

- [ ] **Step 2: Add `/keep-alive` default absence test**

Append this test in `internal/api/server_test.go` near health/status tests:

```go
func TestKeepAliveEndpointIsNotRegisteredByDefault(t *testing.T) {
	server := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/keep-alive", nil)
	w := httptest.NewRecorder()
	server.engine.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("keep-alive status = %d, want %d when endpoint is not explicitly enabled; body=%s", w.Code, http.StatusNotFound, w.Body.String())
	}
}
```

- [ ] **Step 3: Add `/keep-alive` enabled/authenticated test**

Append this test in `internal/api/server_test.go` near the previous keep-alive test:

```go
func TestKeepAliveEndpointRequiresLocalPasswordWhenEnabled(t *testing.T) {
	server := newTestServer(t)
	server.localPassword = "local-secret"
	server.enableKeepAlive(time.Minute, func() {})
	t.Cleanup(func() {
		select {
		case server.keepAliveStop <- struct{}{}:
		default:
		}
	})

	missingReq := httptest.NewRequest(http.MethodGet, "/keep-alive", nil)
	missingW := httptest.NewRecorder()
	server.engine.ServeHTTP(missingW, missingReq)
	if missingW.Code != http.StatusUnauthorized {
		t.Fatalf("missing password status = %d, want %d; body=%s", missingW.Code, http.StatusUnauthorized, missingW.Body.String())
	}

	authReq := httptest.NewRequest(http.MethodGet, "/keep-alive", nil)
	authReq.Header.Set("Authorization", "Bearer local-secret")
	authW := httptest.NewRecorder()
	server.engine.ServeHTTP(authW, authReq)
	if authW.Code != http.StatusOK {
		t.Fatalf("authenticated status = %d, want %d; body=%s", authW.Code, http.StatusOK, authW.Body.String())
	}
}
```

- [ ] **Step 4: Run focused tests**

Run:

```text
go test ./internal/api -run "TestManagementRoutesDisabledWithoutSecret|TestKeepAlive" -count=1
```

Expected: PASS.

- [ ] **Step 5: Fix only contract mismatches if needed**

If the tests fail, inspect `internal/api/server.go` around:

- `registerManagementRoutes`
- `managementAvailabilityMiddleware`
- `WithKeepAliveEndpoint`
- `enableKeepAlive`
- `handleKeepAlive`

Keep fixes minimal. Do not make `/keep-alive` default-on. Do not make management routes unauthenticated.

- [ ] **Step 6: Run focused tests again**

Run:

```text
go test ./internal/api -run "TestManagementRoutesDisabledWithoutSecret|TestKeepAlive" -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```text
git add internal/api/server_test.go internal/api/server.go
git commit -m "test: document optional sidecar management endpoints"
```

Expected: commit succeeds. If no implementation file changed, `git add internal/api/server_test.go` is sufficient.

## Task 4: Add Minimal Sidecar Controller Example

**Files:**
- Create: `examples/sidecar-controller/main.go`

- [ ] **Step 1: Create the example file**

Create `examples/sidecar-controller/main.go` with this complete content:

```go
// Package main demonstrates how an external desktop shell can launch and probe
// cli_LH as a local sidecar without embedding Go SDK internals.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"
)

type statusResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Server  struct {
		Host       string `json:"host"`
		Port       int    `json:"port"`
		ConfigPath string `json:"configPath"`
		AuthDir    string `json:"authDir"`
	} `json:"server"`
	Runtime struct {
		TUIMode    bool `json:"tuiMode"`
		Standalone bool `json:"standalone"`
		LocalModel bool `json:"localModel"`
	} `json:"runtime"`
}

func main() {
	binaryPath := flag.String("binary", "", "Path to the cli_LH binary to launch")
	configPath := flag.String("config", "", "Path to the cli_LH config.yaml file")
	baseURL := flag.String("base-url", "http://127.0.0.1:8317", "Base URL used for /healthz and /statusz probes")
	startupTimeout := flag.Duration("startup-timeout", 30*time.Second, "Maximum time to wait for sidecar readiness")
	localModel := flag.Bool("local-model", false, "Pass --local-model to the sidecar")
	flag.Parse()

	if strings.TrimSpace(*binaryPath) == "" {
		fatalf("--binary is required")
	}
	if strings.TrimSpace(*configPath) == "" {
		fatalf("--config is required")
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	args := []string{"--config", *configPath}
	if *localModel {
		args = append(args, "--local-model")
	}

	cmd := exec.CommandContext(ctx, *binaryPath, args...)
	cmd.Stdout = prefixedWriter{prefix: "sidecar stdout", writer: os.Stdout}
	cmd.Stderr = prefixedWriter{prefix: "sidecar stderr", writer: os.Stderr}

	if err := cmd.Start(); err != nil {
		fatalf("failed to start sidecar: %v", err)
	}
	fmt.Printf("started sidecar pid=%d\n", cmd.Process.Pid)

	exitCh := make(chan error, 1)
	go func() {
		exitCh <- cmd.Wait()
	}()

	status, err := waitForReady(ctx, *baseURL, *startupTimeout, exitCh)
	if err != nil {
		_ = stopProcess(cmd)
		fatalf("sidecar did not become ready: %v", err)
	}

	encoded, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		_ = stopProcess(cmd)
		fatalf("failed to format status: %v", err)
	}
	fmt.Printf("sidecar ready:\n%s\n", encoded)

	fmt.Println("press Ctrl+C to stop this controller and terminate the sidecar")
	<-ctx.Done()
	_ = stopProcess(cmd)
}

func waitForReady(ctx context.Context, baseURL string, timeout time.Duration, exitCh <-chan error) (*statusResponse, error) {
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	client := &http.Client{Timeout: 2 * time.Second}
	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case err := <-exitCh:
			if err == nil {
				return nil, errors.New("sidecar exited before readiness")
			}
			return nil, fmt.Errorf("sidecar exited before readiness: %w", err)
		case <-deadline.C:
			return nil, fmt.Errorf("timed out after %s", timeout)
		case <-ticker.C:
			if err := probeHealth(client, baseURL); err != nil {
				continue
			}
			status, err := probeStatus(client, baseURL)
			if err != nil {
				continue
			}
			if status.Status == "ready" {
				return status, nil
			}
		}
	}
}

func probeHealth(client *http.Client, baseURL string) error {
	resp, err := client.Get(strings.TrimRight(baseURL, "/") + "/healthz")
	if err != nil {
		return err
	}
	defer closeBody(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthz status = %d", resp.StatusCode)
	}
	return nil
}

func probeStatus(client *http.Client, baseURL string) (*statusResponse, error) {
	resp, err := client.Get(strings.TrimRight(baseURL, "/") + "/statusz")
	if err != nil {
		return nil, err
	}
	defer closeBody(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("statusz status = %d", resp.StatusCode)
	}
	var status statusResponse
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	return &status, nil
}

func stopProcess(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if runtime.GOOS == "windows" {
		return cmd.Process.Kill()
	}
	return cmd.Process.Signal(os.Interrupt)
}

func closeBody(body io.Closer) {
	if err := body.Close(); err != nil {
		fmt.Fprintf(os.Stderr, "failed to close response body: %v\n", err)
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}

type prefixedWriter struct {
	prefix string
	writer io.Writer
}

func (w prefixedWriter) Write(p []byte) (int, error) {
	trimmed := strings.TrimRight(string(p), "\r\n")
	if trimmed != "" {
		_, err := fmt.Fprintf(w.writer, "[%s] %s\n", w.prefix, trimmed)
		if err != nil {
			return 0, err
		}
	}
	return len(p), nil
}
```

- [ ] **Step 2: Format the example**

Run:

```text
gofmt -w examples/sidecar-controller/main.go
```

Expected: command succeeds with no output.

- [ ] **Step 3: Build the example**

Run:

```text
go build ./examples/sidecar-controller
```

Expected: PASS.

- [ ] **Step 4: Fix compile issues if needed**

If the build fails, edit only `examples/sidecar-controller/main.go`. Keep the example dependency-free and do not import internal packages. The example must use only process launch and HTTP probes.

- [ ] **Step 5: Build the example again**

Run:

```text
go build ./examples/sidecar-controller
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```text
git add examples/sidecar-controller/main.go
git commit -m "docs: add sidecar controller example"
```

Expected: commit succeeds.

## Task 5: Add Public Sidecar Integration Guide

**Files:**
- Create or modify: `docs/sidecar-integration.md`

- [ ] **Step 1: Inspect existing guide**

Run:

```text
if (Test-Path docs/sidecar-integration.md) { Get-Content docs/sidecar-integration.md -Raw } else { Write-Output "missing" }
```

Expected: either existing content is printed or `missing` is printed.

- [ ] **Step 2: Write the guide content**

If `docs/sidecar-integration.md` is missing or obsolete, replace it with this content:

````markdown
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
````

If the file already contains useful current information, merge the sections above without deleting accurate existing content.

- [ ] **Step 3: Verify the guide is not ignored**

Run:

```text
git check-ignore -v docs/sidecar-integration.md
```

Expected: no output and exit code 1 because `.gitignore` already unignores this file.

- [ ] **Step 4: Commit**

Run:

```text
git add docs/sidecar-integration.md
git commit -m "docs: document sidecar integration guide"
```

Expected: commit succeeds.

## Task 6: Final Verification

**Files:**
- Verify all modified files from previous tasks.

- [ ] **Step 1: Run API contract tests**

Run:

```text
go test ./internal/api -run "TestHealthz|TestStatusz|TestManagementRoutesDisabledWithoutSecret|TestKeepAlive" -count=1
```

Expected: PASS.

- [ ] **Step 2: Build the controller example**

Run:

```text
go build ./examples/sidecar-controller
```

Expected: PASS.

- [ ] **Step 3: Build the server**

Run:

```text
go build -o test-output ./cmd/server
```

Expected: PASS and a `test-output` binary is created.

- [ ] **Step 4: Remove the verification binary**

Run:

```text
Remove-Item test-output -ErrorAction SilentlyContinue
```

Expected: command succeeds.

- [ ] **Step 5: Inspect final diff**

Run:

```text
git status --short
git diff -- .gitignore internal/api/server_test.go examples/sidecar-controller/main.go docs/sidecar-integration.md docs/superpowers/specs/2026-06-04-desktop-shell-sidecar-contract-design.md docs/superpowers/plans/2026-06-04-desktop-shell-sidecar-contract-implementation.md
```

Expected:

- Only intended files are modified or newly added for this plan.
- No secrets appear in diffs.
- No generated `test-output` binary remains.

- [ ] **Step 6: Run broader tests if API tests or build touched shared behavior**

Run:

```text
go test ./...
```

Expected: PASS. If this is too slow for the current environment, record the focused tests and server build output, then ask for permission before skipping broader tests.

## Self-Review Checklist

Spec coverage:

- Startup flags: covered by guide and controller example.
- `/healthz`: covered by existing and final tests.
- `/statusz`: covered by new field-shape regression test.
- `auth-dir`: covered by formal spec and guide references.
- Logs: covered by guide and existing log test; no hard-coded file log promise added.
- OAuth/login: covered by guide; no login behavior change required.
- Process lifecycle: covered by controller example and guide.
- Security model: covered by management optionality tests and guide.
- Management optionality: covered by new test.
- `/keep-alive` optionality: covered by new tests.
- SDK builder: covered by formal spec; no SDK implementation change required.

Placeholder scan:

- No `TBD`.
- No `TODO`.
- No unspecified implementation steps.
- No task says only “write tests” without concrete test code.

Type consistency:

- `SidecarRuntimeInfo` fields match existing JSON keys: `tuiMode`, `standalone`, `localModel`.
- `/statusz` top-level keys match existing implementation: `status`, `service`, `build`, `server`, `runtime`, `providers`.
- Provider summary keys match existing implementation: `geminiApiKeys`, `codexApiKeys`, `claudeApiKeys`, `openaiCompatibilityEntries`, `vertexApiKeys`, `oauthModelAliases`, `homeEnabled`.
- Existing config key spelling remains `auth-dir`.
