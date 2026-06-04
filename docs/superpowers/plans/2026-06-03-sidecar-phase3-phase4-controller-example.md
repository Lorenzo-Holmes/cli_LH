# Sidecar Phase 3 and Controller Example Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next sidecar integration layer: a `--sidecar` operating profile, an optional machine-readable `server.json` status file, public SDK-friendly sidecar metadata types, and a minimal external controller example that starts, probes, and stops `cli_LH`.

**Architecture:** Keep UI shells outside this repository. Extend the Go core with sidecar-friendly startup contracts only: CLI flags for profile/status-file behavior, safe runtime metadata exposed through `/statusz`, an SDK-visible type that does not force external users to import `internal/api`, and an example process controller that uses explicit binary arguments and HTTP probing.

**Tech Stack:** Go, standard library `flag`, `os/exec`, `net/http`, existing `internal/api`, `internal/cmd`, `sdk/cliproxy`, Markdown docs.

---

## File Structure

- Modify `internal/api/sidecar_status.go`
  - Add `Sidecar bool` to `SidecarRuntimeInfo`.
  - Keep JSON output allowlisted and backward-compatible.
- Modify `internal/api/server_test.go`
  - Assert `/statusz.runtime.sidecar` is represented safely.
- Modify `sdk/cliproxy/builder.go`
  - Add public `cliproxy.SidecarRuntimeInfo` type.
  - Change `Builder.WithSidecarRuntimeInfo` to accept the SDK type and convert it internally to `api.SidecarRuntimeInfo`.
- Modify `sdk/cliproxy/*_test.go` or create `sdk/cliproxy/builder_sidecar_test.go`
  - Verify the public SDK sidecar type maps to the API status response.
- Modify `internal/cmd/run.go`
  - Replace long sidecar argument lists with a small `SidecarOptions` struct.
  - Add status-file writing through service lifecycle hooks.
- Modify `cmd/server/main.go`
  - Add `--sidecar` and `--sidecar-status-file` flags.
  - Apply sidecar defaults before starting the service: localhost bind, local model catalog, no-browser OAuth behavior.
- Create `internal/cmd/sidecar_status_file.go`
  - Write allowlisted `server.json` fields atomically.
- Create `internal/cmd/sidecar_status_file_test.go`
  - Test status file shape and redaction.
- Create `examples/sidecar-controller/main.go`
  - External controller example that starts the binary, waits for `/statusz`, prints status, and shuts the process down.
- Create `examples/sidecar-controller/controller.go`
  - Testable controller helpers: command construction, base URL building, polling, status parsing, shutdown fallback.
- Create `examples/sidecar-controller/controller_test.go`
  - Test command arguments, status polling, timeout behavior, and no secret printing.
- Modify `docs/sidecar-integration.md`
  - Document `--sidecar`, `--sidecar-status-file`, status file schema, and controller example usage.
- Modify `README.md` and `README_CN.md`
  - Link the controller example from SDK/sidecar docs sections.

---

## Task 1: Extend Runtime Metadata with Sidecar Mode

**Files:**
- Modify: `internal/api/sidecar_status.go`
- Modify: `internal/api/server_test.go`

- [ ] **Step 1: Update the failing API test expectation**

In `internal/api/server_test.go`, update `TestStatuszReturnsMachineReadableSidecarStatus` so it sets and asserts sidecar mode:

```go
server.sidecarRuntime = SidecarRuntimeInfo{
	Sidecar:    true,
	TUIMode:    true,
	Standalone: true,
	LocalModel: true,
}
```

Add this assertion after the existing runtime flag assertion:

```go
if !resp.Runtime.Sidecar {
	t.Fatalf("sidecar flag not reflected: %+v", resp.Runtime)
}
```

- [ ] **Step 2: Run the focused failing test**

Run:

```text
go test ./internal/api -run TestStatuszReturnsMachineReadableSidecarStatus -count=1
```

Expected: FAIL because `SidecarRuntimeInfo.Sidecar` does not exist.

- [ ] **Step 3: Add the sidecar runtime field**

In `internal/api/sidecar_status.go`, change `SidecarRuntimeInfo` to:

```go
// SidecarRuntimeInfo holds runtime metadata for the sidecar status endpoint.
type SidecarRuntimeInfo struct {
	Sidecar    bool `json:"sidecar"`
	TUIMode    bool `json:"tuiMode"`
	Standalone bool `json:"standalone"`
	LocalModel bool `json:"localModel"`
}
```

- [ ] **Step 4: Verify the API test passes**

Run:

```text
gofmt -w internal/api/sidecar_status.go internal/api/server_test.go
go test ./internal/api -run TestStatuszReturnsMachineReadableSidecarStatus -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```text
git add internal/api/sidecar_status.go internal/api/server_test.go
git commit -m "feat(api): expose sidecar runtime mode"
```

Expected: commit succeeds.

---

## Task 2: Add SDK-Public Sidecar Runtime Type

**Files:**
- Modify: `sdk/cliproxy/builder.go`
- Create: `sdk/cliproxy/builder_sidecar_test.go`

- [ ] **Step 1: Add a test for public SDK runtime metadata mapping**

Create `sdk/cliproxy/builder_sidecar_test.go`:

```go
package cliproxy

import (
	"path/filepath"
	"testing"

	"github.com/Lorenzo-Holmes/cli_LH/v7/sdk/config"
)

func TestBuilderWithSidecarRuntimeInfoUsesPublicSDKType(t *testing.T) {
	tmp := t.TempDir()
	cfg := &config.Config{
		Host:    "127.0.0.1",
		Port:    8317,
		AuthDir: filepath.Join(tmp, "auths"),
	}

	svc, err := NewBuilder().
		WithConfig(cfg).
		WithConfigPath(filepath.Join(tmp, "config.yaml")).
		WithSidecarRuntimeInfo(SidecarRuntimeInfo{
			Sidecar:    true,
			TUIMode:    false,
			Standalone: true,
			LocalModel: true,
		}).
		Build()
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if svc == nil {
		t.Fatalf("Build() returned nil service")
	}
	if len(svc.serverOptions) == 0 {
		t.Fatalf("expected sidecar runtime server option to be registered")
	}
}
```

- [ ] **Step 2: Run the focused failing test**

Run:

```text
go test ./sdk/cliproxy -run TestBuilderWithSidecarRuntimeInfoUsesPublicSDKType -count=1
```

Expected: FAIL because `cliproxy.SidecarRuntimeInfo` is not defined or `WithSidecarRuntimeInfo` still requires the internal API type.

- [ ] **Step 3: Add the SDK-public type and conversion**

In `sdk/cliproxy/builder.go`, add this type near `Hooks`:

```go
// SidecarRuntimeInfo is safe runtime metadata exposed through sidecar status endpoints.
type SidecarRuntimeInfo struct {
	Sidecar    bool `json:"sidecar"`
	TUIMode    bool `json:"tuiMode"`
	Standalone bool `json:"standalone"`
	LocalModel bool `json:"localModel"`
}
```

Replace `WithSidecarRuntimeInfo` with:

```go
// WithSidecarRuntimeInfo configures safe runtime metadata exposed by sidecar status endpoints.
func (b *Builder) WithSidecarRuntimeInfo(info SidecarRuntimeInfo) *Builder {
	b.serverOptions = append(b.serverOptions, api.WithSidecarRuntimeInfo(api.SidecarRuntimeInfo{
		Sidecar:    info.Sidecar,
		TUIMode:    info.TUIMode,
		Standalone: info.Standalone,
		LocalModel: info.LocalModel,
	}))
	return b
}
```

- [ ] **Step 4: Update current callers**

Update `internal/cmd/run.go` or later Task 3 code so it passes `cliproxy.SidecarRuntimeInfo`, not `api.SidecarRuntimeInfo`, into `sdk/cliproxy.Builder`.

- [ ] **Step 5: Verify SDK tests pass**

Run:

```text
gofmt -w sdk/cliproxy/builder.go sdk/cliproxy/builder_sidecar_test.go
go test ./sdk/cliproxy -run TestBuilderWithSidecarRuntimeInfoUsesPublicSDKType -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```text
git add sdk/cliproxy/builder.go sdk/cliproxy/builder_sidecar_test.go
git commit -m "feat(sdk): expose sidecar runtime metadata type"
```

Expected: commit succeeds.

---

## Task 3: Add Sidecar Profile CLI Flags

**Files:**
- Modify: `cmd/server/main.go`
- Modify: `internal/cmd/run.go`

- [ ] **Step 1: Add CLI tests for sidecar defaults by extracting pure helper**

Create a pure helper in `cmd/server/main.go` in Step 3, but first add tests in a new file `cmd/server/sidecar_profile_test.go`:

```go
package main

import (
	"testing"

	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/config"
)

func TestApplySidecarProfileDefaults(t *testing.T) {
	cfg := &config.Config{Host: "", Port: 8317}
	flags := runtimeFlagState{Sidecar: true}

	applySidecarProfileDefaults(cfg, &flags)

	if cfg.Host != "127.0.0.1" {
		t.Fatalf("host = %q, want 127.0.0.1", cfg.Host)
	}
	if !flags.LocalModel {
		t.Fatalf("local model should be enabled in sidecar mode")
	}
	if !flags.NoBrowser {
		t.Fatalf("no-browser should be enabled in sidecar mode")
	}
}

func TestApplySidecarProfilePreservesExplicitHost(t *testing.T) {
	cfg := &config.Config{Host: "localhost", Port: 8317}
	flags := runtimeFlagState{Sidecar: true}

	applySidecarProfileDefaults(cfg, &flags)

	if cfg.Host != "localhost" {
		t.Fatalf("host = %q, want localhost", cfg.Host)
	}
}

func TestApplySidecarProfileNoopWhenDisabled(t *testing.T) {
	cfg := &config.Config{Host: "", Port: 8317}
	flags := runtimeFlagState{}

	applySidecarProfileDefaults(cfg, &flags)

	if cfg.Host != "" {
		t.Fatalf("host = %q, want empty", cfg.Host)
	}
	if flags.LocalModel || flags.NoBrowser {
		t.Fatalf("flags changed when sidecar disabled: %+v", flags)
	}
}
```

- [ ] **Step 2: Run the focused failing tests**

Run:

```text
go test ./cmd/server -run TestApplySidecarProfile -count=1
```

Expected: FAIL because `runtimeFlagState` and `applySidecarProfileDefaults` are not defined.

- [ ] **Step 3: Add sidecar profile helper types**

In `cmd/server/main.go`, add this type near the package-level vars:

```go
type runtimeFlagState struct {
	Sidecar    bool
	TUIMode    bool
	Standalone bool
	LocalModel bool
	NoBrowser  bool
}
```

Add this helper below `init()`:

```go
func applySidecarProfileDefaults(cfg *config.Config, flags *runtimeFlagState) {
	if cfg == nil || flags == nil || !flags.Sidecar {
		return
	}
	if strings.TrimSpace(cfg.Host) == "" {
		cfg.Host = "127.0.0.1"
	}
	flags.LocalModel = true
	flags.NoBrowser = true
}
```

- [ ] **Step 4: Add flags and use the helper in main**

In `main()`, add variables:

```go
var sidecar bool
var sidecarStatusFile string
```

Register flags:

```go
flag.BoolVar(&sidecar, "sidecar", false, "Start with local sidecar defaults for shell/controller integrations")
flag.StringVar(&sidecarStatusFile, "sidecar-status-file", "", "Write sidecar server metadata JSON to this file after startup")
```

After config loading and before login/server mode branching, build and apply the helper:

```go
runtimeFlags := runtimeFlagState{
	Sidecar:    sidecar,
	TUIMode:    tuiMode,
	Standalone: standalone,
	LocalModel: localModel,
	NoBrowser:  noBrowser,
}
applySidecarProfileDefaults(cfg, &runtimeFlags)
localModel = runtimeFlags.LocalModel
noBrowser = runtimeFlags.NoBrowser
```

Update runtime info creation:

```go
runtimeInfo := cliproxy.SidecarRuntimeInfo{
	Sidecar:    runtimeFlags.Sidecar,
	TUIMode:    runtimeFlags.TUIMode,
	Standalone: runtimeFlags.Standalone,
	LocalModel: runtimeFlags.LocalModel,
}
```

Add `github.com/Lorenzo-Holmes/cli_LH/v7/sdk/cliproxy` to imports and remove direct `internal/api` import if it is only used for runtime info.

- [ ] **Step 5: Update service startup calls to include sidecar status file path**

This compiles after Task 4 introduces `internal/cmd.SidecarOptions`. For now, update the intended call sites to:

```go
sidecarOptions := cmd.SidecarOptions{
	RuntimeInfo: runtimeInfo,
	StatusFile:  sidecarStatusFile,
}
```

Use:

```go
cmd.StartServiceBackground(cfg, configFilePath, password, sidecarOptions)
cmd.StartService(cfg, configFilePath, password, sidecarOptions)
```

- [ ] **Step 6: Verify CLI helper tests pass after Task 4 is present**

Run after Task 4 implementation:

```text
gofmt -w cmd/server/main.go cmd/server/sidecar_profile_test.go
go test ./cmd/server -run TestApplySidecarProfile -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3 after Task 4 compiles**

Run after Task 4:

```text
git add cmd/server/main.go cmd/server/sidecar_profile_test.go
git commit -m "feat(cmd): add sidecar startup profile"
```

Expected: commit succeeds.

---

## Task 4: Add Sidecar Status File Writer

**Files:**
- Create: `internal/cmd/sidecar_status_file.go`
- Create: `internal/cmd/sidecar_status_file_test.go`
- Modify: `internal/cmd/run.go`

- [ ] **Step 1: Add status file writer tests**

Create `internal/cmd/sidecar_status_file_test.go`:

```go
package cmd

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Lorenzo-Holmes/cli_LH/v7/sdk/cliproxy"
	"github.com/Lorenzo-Holmes/cli_LH/v7/sdk/config"
)

func TestWriteSidecarStatusFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "server.json")
	cfg := &config.Config{Host: "127.0.0.1", Port: 8317, AuthDir: filepath.Join(dir, "auths")}

	err := writeSidecarStatusFile(path, cfg, filepath.Join(dir, "config.yaml"), cliproxy.SidecarRuntimeInfo{
		Sidecar:    true,
		LocalModel: true,
	})
	if err != nil {
		t.Fatalf("writeSidecarStatusFile() error = %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	var resp sidecarStatusFile
	if err := json.Unmarshal(data, &resp); err != nil {
		t.Fatalf("json decode error = %v; body=%s", err, data)
	}
	if resp.Service != "cli_LH" {
		t.Fatalf("service = %q, want cli_LH", resp.Service)
	}
	if resp.BaseURL != "http://127.0.0.1:8317" {
		t.Fatalf("baseURL = %q, want http://127.0.0.1:8317", resp.BaseURL)
	}
	if resp.HealthURL != "http://127.0.0.1:8317/healthz" {
		t.Fatalf("healthURL = %q", resp.HealthURL)
	}
	if resp.StatusURL != "http://127.0.0.1:8317/statusz" {
		t.Fatalf("statusURL = %q", resp.StatusURL)
	}
	if !resp.Runtime.Sidecar || !resp.Runtime.LocalModel {
		t.Fatalf("runtime not written: %+v", resp.Runtime)
	}
}

func TestWriteSidecarStatusFileOmitsSecrets(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "server.json")
	cfg := &config.Config{Host: "127.0.0.1", Port: 8317, AuthDir: filepath.Join(dir, "auths")}
	cfg.RemoteManagement.SecretKey = "management-secret-value"
	cfg.APIKeys = []string{"api-secret-value"}

	err := writeSidecarStatusFile(path, cfg, filepath.Join(dir, "config.yaml"), cliproxy.SidecarRuntimeInfo{Sidecar: true})
	if err != nil {
		t.Fatalf("writeSidecarStatusFile() error = %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	body := string(data)
	for _, secret := range []string{"management-secret-value", "api-secret-value"} {
		if strings.Contains(body, secret) {
			t.Fatalf("status file leaked secret %q: %s", secret, body)
		}
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```text
go test ./internal/cmd -run TestWriteSidecarStatusFile -count=1
```

Expected: FAIL because `writeSidecarStatusFile` and `sidecarStatusFile` are not defined.

- [ ] **Step 3: Implement the status file writer**

Create `internal/cmd/sidecar_status_file.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/buildinfo"
	"github.com/Lorenzo-Holmes/cli_LH/v7/sdk/cliproxy"
	"github.com/Lorenzo-Holmes/cli_LH/v7/sdk/config"
)

type sidecarStatusFile struct {
	Status     string                       `json:"status"`
	Service    string                       `json:"service"`
	PID        int                          `json:"pid"`
	BaseURL    string                       `json:"baseURL"`
	HealthURL  string                       `json:"healthURL"`
	StatusURL  string                       `json:"statusURL"`
	ConfigPath string                       `json:"configPath"`
	AuthDir    string                       `json:"authDir"`
	Runtime    cliproxy.SidecarRuntimeInfo  `json:"runtime"`
	Build      sidecarStatusFileBuild       `json:"build"`
	WrittenAt  string                       `json:"writtenAt"`
}

type sidecarStatusFileBuild struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildDate string `json:"buildDate"`
}

func writeSidecarStatusFile(path string, cfg *config.Config, configPath string, runtimeInfo cliproxy.SidecarRuntimeInfo) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil
	}
	if cfg == nil {
		return fmt.Errorf("sidecar status file: config is nil")
	}

	baseURL := sidecarBaseURL(cfg.Host, cfg.Port)
	payload := sidecarStatusFile{
		Status:     "ready",
		Service:    "cli_LH",
		PID:        os.Getpid(),
		BaseURL:    baseURL,
		HealthURL:  baseURL + "/healthz",
		StatusURL:  baseURL + "/statusz",
		ConfigPath: configPath,
		AuthDir:    cfg.AuthDir,
		Runtime:    runtimeInfo,
		Build: sidecarStatusFileBuild{
			Version:   buildinfo.Version,
			Commit:    buildinfo.Commit,
			BuildDate: buildinfo.BuildDate,
		},
		WrittenAt: time.Now().UTC().Format(time.RFC3339),
	}

	data, errMarshal := json.MarshalIndent(payload, "", "  ")
	if errMarshal != nil {
		return fmt.Errorf("sidecar status file: marshal: %w", errMarshal)
	}
	data = append(data, '\n')

	if errMkdir := os.MkdirAll(filepath.Dir(path), 0o755); errMkdir != nil {
		return fmt.Errorf("sidecar status file: create parent directory: %w", errMkdir)
	}
	tmp := path + ".tmp"
	if errWrite := os.WriteFile(tmp, data, 0o600); errWrite != nil {
		return fmt.Errorf("sidecar status file: write temp file: %w", errWrite)
	}
	if errRename := os.Rename(tmp, path); errRename != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("sidecar status file: replace file: %w", errRename)
	}
	return nil
}

func sidecarBaseURL(host string, port int) string {
	host = strings.TrimSpace(host)
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return "http://" + net.JoinHostPort(host, fmt.Sprintf("%d", port))
}
```

- [ ] **Step 4: Add sidecar options to service startup**

In `internal/cmd/run.go`, add:

```go
// SidecarOptions carries safe sidecar metadata and optional status-file output settings.
type SidecarOptions struct {
	RuntimeInfo cliproxy.SidecarRuntimeInfo
	StatusFile  string
}
```

Change signatures:

```go
func StartService(cfg *config.Config, configPath string, localPassword string, sidecarOptions SidecarOptions)
func StartServiceBackground(cfg *config.Config, configPath string, localPassword string, sidecarOptions SidecarOptions) (cancel func(), done <-chan struct{})
```

Add this helper in the same file:

```go
func sidecarHooks(cfg *config.Config, configPath string, options SidecarOptions) cliproxy.Hooks {
	return cliproxy.Hooks{
		OnAfterStart: func(*cliproxy.Service) {
			if errWrite := writeSidecarStatusFile(options.StatusFile, cfg, configPath, options.RuntimeInfo); errWrite != nil {
				log.Errorf("failed to write sidecar status file: %v", errWrite)
			}
		},
	}
}
```

Update both builder chains:

```go
builder := cliproxy.NewBuilder().
	WithConfig(cfg).
	WithConfigPath(configPath).
	WithLocalManagementPassword(localPassword).
	WithSidecarRuntimeInfo(sidecarOptions.RuntimeInfo).
	WithHooks(sidecarHooks(cfg, configPath, sidecarOptions))
```

- [ ] **Step 5: Verify status file tests pass**

Run:

```text
gofmt -w internal/cmd/run.go internal/cmd/sidecar_status_file.go internal/cmd/sidecar_status_file_test.go
go test ./internal/cmd -run TestWriteSidecarStatusFile -count=1
```

Expected: PASS.

- [ ] **Step 6: Verify cmd/server now compiles and tests pass**

Run:

```text
gofmt -w cmd/server/main.go cmd/server/sidecar_profile_test.go
go test ./cmd/server -run TestApplySidecarProfile -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4 together with Task 3 if needed**

Run:

```text
git add cmd/server/main.go cmd/server/sidecar_profile_test.go internal/cmd/run.go internal/cmd/sidecar_status_file.go internal/cmd/sidecar_status_file_test.go
git commit -m "feat(cmd): add sidecar profile status file"
```

Expected: commit succeeds.

---

## Task 5: Add External Controller Example

**Files:**
- Create: `examples/sidecar-controller/controller.go`
- Create: `examples/sidecar-controller/main.go`
- Create: `examples/sidecar-controller/controller_test.go`

- [ ] **Step 1: Add controller helper tests**

Create `examples/sidecar-controller/controller_test.go`:

```go
package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBuildSidecarArgs(t *testing.T) {
	args := buildSidecarArgs("config.yaml", "server.json")
	joined := strings.Join(args, " ")
	for _, want := range []string{"--sidecar", "--config", "config.yaml", "--sidecar-status-file", "server.json", "--no-browser"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("args %q missing %q", joined, want)
		}
	}
}

func TestPollStatusz(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/statusz" {
			http.NotFound(w, r)
			return
		}
		_ = json.NewEncoder(w).Encode(sidecarStatus{Status: "ready", Service: "cli_LH"})
	}))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	status, err := pollStatusz(ctx, srv.URL, 10*time.Millisecond)
	if err != nil {
		t.Fatalf("pollStatusz() error = %v", err)
	}
	if status.Status != "ready" || status.Service != "cli_LH" {
		t.Fatalf("unexpected status: %+v", status)
	}
}

func TestPollStatuszTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not ready", http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err := pollStatusz(ctx, srv.URL, 10*time.Millisecond)
	if err == nil {
		t.Fatalf("pollStatusz() error = nil, want timeout")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```text
go test ./examples/sidecar-controller -count=1
```

Expected: FAIL because the controller helper functions and types do not exist.

- [ ] **Step 3: Implement controller helpers**

Create `examples/sidecar-controller/controller.go`:

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

type sidecarStatus struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

func buildSidecarArgs(configPath string, statusFile string) []string {
	args := []string{"--sidecar", "--config", configPath, "--no-browser"}
	if strings.TrimSpace(statusFile) != "" {
		args = append(args, "--sidecar-status-file", statusFile)
	}
	return args
}

func startSidecar(ctx context.Context, binary string, configPath string, statusFile string) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, binary, buildSidecarArgs(configPath, statusFile)...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start sidecar: %w", err)
	}
	return cmd, nil
}

func pollStatusz(ctx context.Context, baseURL string, interval time.Duration) (sidecarStatus, error) {
	if interval <= 0 {
		interval = 200 * time.Millisecond
	}
	client := &http.Client{Timeout: 2 * time.Second}
	url := strings.TrimRight(baseURL, "/") + "/statusz"
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return sidecarStatus{}, ctx.Err()
		case <-ticker.C:
			req, errReq := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
			if errReq != nil {
				return sidecarStatus{}, errReq
			}
			resp, errDo := client.Do(req)
			if errDo != nil {
				continue
			}
			var status sidecarStatus
			decodeOK := false
			func() {
				defer resp.Body.Close()
				if resp.StatusCode != http.StatusOK {
					return
				}
				decodeOK = json.NewDecoder(resp.Body).Decode(&status) == nil
			}()
			if decodeOK && status.Status == "ready" && status.Service == "cli_LH" {
				return status, nil
			}
		}
	}
}

func stopSidecar(cmd *exec.Cmd) error {
	if cmd == nil || cmd.Process == nil {
		return nil
	}
	if runtime.GOOS != "windows" {
		if errInterrupt := cmd.Process.Signal(os.Interrupt); errInterrupt == nil {
			return cmd.Wait()
		}
	}
	if errKill := cmd.Process.Kill(); errKill != nil {
		return fmt.Errorf("stop sidecar: %w", errKill)
	}
	return cmd.Wait()
}
```

- [ ] **Step 4: Implement example main**

Create `examples/sidecar-controller/main.go`:

```go
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"
)

func main() {
	binary := flag.String("binary", "cli_LH", "Path to the cli_LH binary")
	configPath := flag.String("config", "config.yaml", "Path to the cli_LH config file")
	baseURL := flag.String("base-url", "http://127.0.0.1:8317", "Base URL used to probe the sidecar")
	statusFile := flag.String("status-file", "", "Optional sidecar status file path")
	keepRunning := flag.Bool("keep-running", false, "Leave the sidecar running after readiness is confirmed")
	flag.Parse()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cmd, errStart := startSidecar(ctx, *binary, *configPath, *statusFile)
	if errStart != nil {
		fmt.Fprintf(os.Stderr, "failed to start sidecar: %v\n", errStart)
		os.Exit(1)
	}
	if !*keepRunning {
		defer func() {
			if errStop := stopSidecar(cmd); errStop != nil {
				fmt.Fprintf(os.Stderr, "failed to stop sidecar: %v\n", errStop)
			}
		}()
	}

	probeCtx, probeCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer probeCancel()
	status, errProbe := pollStatusz(probeCtx, *baseURL, 200*time.Millisecond)
	if errProbe != nil {
		fmt.Fprintf(os.Stderr, "sidecar did not become ready: %v\n", errProbe)
		os.Exit(1)
	}

	fmt.Printf("sidecar ready: service=%s status=%s baseURL=%s\n", status.Service, status.Status, *baseURL)
	if *keepRunning {
		fmt.Printf("sidecar left running with pid=%d\n", cmd.Process.Pid)
	}
}
```

- [ ] **Step 5: Verify example tests pass**

Run:

```text
gofmt -w examples/sidecar-controller/controller.go examples/sidecar-controller/main.go examples/sidecar-controller/controller_test.go
go test ./examples/sidecar-controller -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```text
git add examples/sidecar-controller
git commit -m "feat(examples): add sidecar controller example"
```

Expected: commit succeeds.

---

## Task 6: Document Phase 3 and Controller Example

**Files:**
- Modify: `docs/sidecar-integration.md`
- Modify: `README.md`
- Modify: `README_CN.md`

- [ ] **Step 1: Update sidecar guide**

In `docs/sidecar-integration.md`, add this section after `Recommended Launch Commands`:

```markdown
## Sidecar Profile

Use `--sidecar` when a shell or local controller owns the user experience and wants deterministic local startup defaults:

```text
cli_LH --sidecar --config <config.yaml> --sidecar-status-file <server.json>
```

The sidecar profile applies these defaults:

- binds to `127.0.0.1` when `host` is not explicitly configured
- enables the local embedded model catalog
- disables automatic browser opening for shell-controlled OAuth flows
- sets `runtime.sidecar` to `true` in `/statusz`

`--sidecar-status-file` is optional. When present, the service writes a machine-readable JSON file after startup so shells can discover URLs without scraping stdout.
```

Add this status file schema under `Health and Status`:

```markdown
Optional `server.json` shape:

```json
{
  "status": "ready",
  "service": "cli_LH",
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
```

Add this section near the end:

```markdown
## Controller Example

A minimal process-based controller is available at `examples/sidecar-controller`.

Run it after building `cli_LH`:

```text
go run ./examples/sidecar-controller --binary ./cli_LH --config config.yaml --status-file ./server.json
```

The example starts the sidecar with explicit arguments, polls `/statusz`, prints readiness, and stops the sidecar unless `--keep-running` is set.
```

- [ ] **Step 2: Update README links**

In `README.md`, change the existing sidecar guide bullet to:

```markdown
- Sidecar Integration Guide: [docs/sidecar-integration.md](docs/sidecar-integration.md) and example controller: `examples/sidecar-controller`
```

In `README_CN.md`, change the existing sidecar guide bullet to:

```markdown
- Sidecar 集成指南：[docs/sidecar-integration.md](docs/sidecar-integration.md)，示例控制器：`examples/sidecar-controller`
```

- [ ] **Step 3: Verify docs contain the new contracts**

Run:

```text
grep -n "--sidecar\|sidecar-status-file\|examples/sidecar-controller\|server.json" docs/sidecar-integration.md README.md README_CN.md
```

On Windows PowerShell, use:

```text
Select-String -Path docs/sidecar-integration.md,README.md,README_CN.md -Pattern "--sidecar","sidecar-status-file","examples/sidecar-controller","server.json"
```

Expected: matches in all relevant files.

- [ ] **Step 4: Commit Task 6**

Run:

```text
git add docs/sidecar-integration.md README.md README_CN.md
git commit -m "docs: document sidecar profile controller flow"
```

Expected: commit succeeds.

---

## Task 7: Final Verification

**Files:**
- All files modified in Tasks 1-6.

- [ ] **Step 1: Format Go files**

Run:

```text
gofmt -w internal/api/sidecar_status.go internal/api/server_test.go sdk/cliproxy/builder.go sdk/cliproxy/builder_sidecar_test.go cmd/server/main.go cmd/server/sidecar_profile_test.go internal/cmd/run.go internal/cmd/sidecar_status_file.go internal/cmd/sidecar_status_file_test.go examples/sidecar-controller/controller.go examples/sidecar-controller/main.go examples/sidecar-controller/controller_test.go
```

Expected: command exits 0.

- [ ] **Step 2: Run focused tests**

Run:

```text
go test ./internal/api ./internal/cmd ./cmd/server ./sdk/cliproxy ./examples/sidecar-controller -count=1
```

Expected: PASS for all listed packages.

- [ ] **Step 3: Build server**

Run:

```text
go build -o test-output ./cmd/server
Remove-Item test-output
```

Expected: build exits 0 and `test-output` is removed.

- [ ] **Step 4: Run full tests and record known failures**

Run:

```text
go test ./...
```

Expected: PASS unless the existing unrelated `internal/runtime/executor` failure remains. If it fails only with `TestCodexExecutorCacheHelper_IdentityConfuseRemapsBodyAndHeaders`, record it as unrelated to this sidecar work and keep the focused test/build evidence.

- [ ] **Step 5: Inspect status**

Run:

```text
git status --short
git log --oneline -5
```

Expected: only intended sidecar files are changed or committed, with no generated binaries left behind.

- [ ] **Step 6: Final commit if prior tasks were not committed individually**

Run:

```text
git add internal/api/sidecar_status.go internal/api/server_test.go sdk/cliproxy/builder.go sdk/cliproxy/builder_sidecar_test.go cmd/server/main.go cmd/server/sidecar_profile_test.go internal/cmd/run.go internal/cmd/sidecar_status_file.go internal/cmd/sidecar_status_file_test.go examples/sidecar-controller docs/sidecar-integration.md README.md README_CN.md
git commit -m "feat(sidecar): add profile and controller example"
```

Expected: commit succeeds if there are staged changes; otherwise Git reports no changes to commit.

---

## Self-Review

- **Spec coverage:** Covers Phase 3 `--sidecar` mode, status file output, no-browser/local-model shell defaults, and Phase 4 SDK/controller example. It keeps UI/Tauri code out of the repository and only adds core contracts plus a process-based example.
- **Scope control:** Does not add a web UI, desktop app, tray, quota dashboard, or cockpit-specific configuration reader.
- **Secret safety:** `/statusz` and `server.json` expose only allowlisted metadata. Tests assert management/API secrets are absent.
- **Testing:** Adds focused tests for API status metadata, SDK public type mapping, CLI sidecar defaults, status file redaction, and controller polling behavior.
- **Known risk:** Process shutdown behavior differs by OS. The controller example uses interrupt on non-Windows and kill fallback on Windows for predictable example behavior.
