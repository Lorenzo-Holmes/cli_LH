# Sidecar Cockpit Tools Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small, stable, machine-readable sidecar status contract for desktop shells while documenting how shells such as Cockpit Tools should launch and monitor `cli_LH`.

**Architecture:** Keep `cli_LH` as the core service and expose sidecar-friendly metadata through existing server construction boundaries. Add a focused status response in `internal/api`, pass runtime mode metadata from `cmd/server`, and document launch/status contracts without importing any UI or Tauri code.

**Tech Stack:** Go, Gin, existing `internal/api` server, existing `internal/buildinfo`, Markdown docs.

---

## File Structure

- Modify `internal/api/server.go`
  - Register unauthenticated `GET /statusz` and `HEAD /statusz` alongside existing `/healthz`.
  - Store safe runtime mode metadata supplied by server options.
- Create `internal/api/sidecar_status.go`
  - Define allowlisted response types and the handler method.
  - Keep sensitive configuration out of the response.
- Modify `internal/api/server_test.go`
  - Add tests for JSON shape, build metadata, config path, auth directory, runtime flags, and secret redaction.
- Modify `cmd/server/main.go`
  - Pass runtime flags (`tui`, `standalone`, `local-model`) into the service builder through `cmd.StartService` and `cmd.StartServiceBackground`.
- Modify `internal/cmd/run.go`
  - Extend service startup functions to accept sidecar runtime metadata.
  - Forward metadata into `cliproxy.Builder` server options.
- Modify `sdk/cliproxy/builder.go`
  - Add a builder method for runtime mode metadata.
- Create `docs/sidecar-integration.md`
  - Document shell/core separation, launch commands, health/status endpoints, and security notes.

---

### Task 1: Add Sidecar Status Types and Handler

**Files:**
- Create: `internal/api/sidecar_status.go`
- Test: `internal/api/server_test.go`

- [ ] **Step 1: Write the failing status endpoint tests**

Append these tests to `internal/api/server_test.go`:

```go
func TestStatuszReturnsMachineReadableSidecarStatus(t *testing.T) {
	server := newTestServer(t)
	server.sidecarRuntime = SidecarRuntimeInfo{
		TUIMode:    true,
		Standalone: true,
		LocalModel: true,
	}

	req := httptest.NewRequest(http.MethodGet, "/statusz", nil)
	rr := httptest.NewRecorder()
	server.engine.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("unexpected status code: got %d want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}

	var resp sidecarStatusResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response JSON: %v; body=%s", err, rr.Body.String())
	}
	if resp.Status != "ready" {
		t.Fatalf("status = %q, want ready", resp.Status)
	}
	if resp.Service != "cli_LH" {
		t.Fatalf("service = %q, want cli_LH", resp.Service)
	}
	if resp.Build.Version == "" || resp.Build.Commit == "" || resp.Build.BuildDate == "" {
		t.Fatalf("build metadata is incomplete: %+v", resp.Build)
	}
	if resp.Server.ConfigPath == "" {
		t.Fatalf("config path should be present")
	}
	if resp.Server.AuthDir == "" {
		t.Fatalf("auth dir should be present")
	}
	if !resp.Runtime.TUIMode || !resp.Runtime.Standalone || !resp.Runtime.LocalModel {
		t.Fatalf("runtime flags not reflected: %+v", resp.Runtime)
	}
}

func TestStatuszHeadHasNoBody(t *testing.T) {
	server := newTestServer(t)

	req := httptest.NewRequest(http.MethodHead, "/statusz", nil)
	rr := httptest.NewRecorder()
	server.engine.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("unexpected status code: got %d want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	if rr.Body.Len() != 0 {
		t.Fatalf("expected empty body for HEAD request, got %q", rr.Body.String())
	}
}

func TestStatuszOmitsSecrets(t *testing.T) {
	server := newTestServer(t)
	server.cfg.RemoteManagement.SecretKey = "management-secret-value"
	server.cfg.APIKeys = []string{"api-secret-value"}
	server.cfg.GeminiKey = []proxyconfig.GeminiKey{{APIKey: "gemini-secret-value"}}
	server.cfg.CodexKey = []proxyconfig.CodexKey{{APIKey: "codex-secret-value"}}
	server.cfg.ClaudeKey = []proxyconfig.ClaudeKey{{APIKey: "claude-secret-value"}}

	req := httptest.NewRequest(http.MethodGet, "/statusz", nil)
	rr := httptest.NewRecorder()
	server.engine.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("unexpected status code: got %d want %d; body=%s", rr.Code, http.StatusOK, rr.Body.String())
	}
	body := rr.Body.String()
	for _, secret := range []string{"management-secret-value", "api-secret-value", "gemini-secret-value", "codex-secret-value", "claude-secret-value"} {
		if strings.Contains(body, secret) {
			t.Fatalf("status response leaked secret %q: %s", secret, body)
		}
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `go test ./internal/api -run TestStatusz -count=1`

Expected: FAIL because `sidecarStatusResponse`, `SidecarRuntimeInfo`, `sidecarRuntime`, and `/statusz` are not defined.

- [ ] **Step 3: Add status response implementation**

Create `internal/api/sidecar_status.go` with this content:

```go
package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/buildinfo"
)

type SidecarRuntimeInfo struct {
	TUIMode    bool `json:"tuiMode"`
	Standalone bool `json:"standalone"`
	LocalModel bool `json:"localModel"`
}

type sidecarBuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildDate string `json:"buildDate"`
}

type sidecarServerInfo struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	ConfigPath string `json:"configPath"`
	AuthDir    string `json:"authDir"`
}

type sidecarProviderSummary struct {
	GeminiAPIKeys              int  `json:"geminiApiKeys"`
	CodexAPIKeys               int  `json:"codexApiKeys"`
	ClaudeAPIKeys              int  `json:"claudeApiKeys"`
	OpenAICompatibilityEntries int  `json:"openaiCompatibilityEntries"`
	VertexAPIKeys              int  `json:"vertexApiKeys"`
	OAuthModelAliases          int  `json:"oauthModelAliases"`
	HomeEnabled                bool `json:"homeEnabled"`
}

type sidecarStatusResponse struct {
	Status    string                 `json:"status"`
	Service   string                 `json:"service"`
	Build     sidecarBuildInfo       `json:"build"`
	Server    sidecarServerInfo      `json:"server"`
	Runtime   SidecarRuntimeInfo     `json:"runtime"`
	Providers sidecarProviderSummary `json:"providers"`
}

func (s *Server) sidecarStatusHandler(c *gin.Context) {
	if c.Request.Method == http.MethodHead {
		c.Status(http.StatusOK)
		return
	}

	resp := sidecarStatusResponse{
		Status:  "ready",
		Service: "cli_LH",
		Build: sidecarBuildInfo{
			Version:   buildinfo.Version,
			Commit:    buildinfo.Commit,
			BuildDate: buildinfo.BuildDate,
		},
		Runtime: s.sidecarRuntime,
	}

	if s != nil && s.cfg != nil {
		resp.Server = sidecarServerInfo{
			Host:       s.cfg.Host,
			Port:       s.cfg.Port,
			ConfigPath: s.configFilePath,
			AuthDir:    s.cfg.AuthDir,
		}
		resp.Providers = sidecarProviderSummary{
			GeminiAPIKeys:              len(s.cfg.GeminiKey),
			CodexAPIKeys:               len(s.cfg.CodexKey),
			ClaudeAPIKeys:              len(s.cfg.ClaudeKey),
			OpenAICompatibilityEntries: len(s.cfg.OpenAICompatibility),
			VertexAPIKeys:              len(s.cfg.VertexCompatAPIKey),
			OAuthModelAliases:          len(s.cfg.OAuthModelAlias),
			HomeEnabled:                s.cfg.Home.Enabled,
		}
	}

	c.JSON(http.StatusOK, resp)
}
```

- [ ] **Step 4: Commit Task 1**

Run: `git add internal/api/sidecar_status.go internal/api/server_test.go && git commit -m "test: define sidecar status contract"`

Expected: commit succeeds with failing tests still pending implementation wiring.

---

### Task 2: Wire Status Endpoint and Runtime Metadata into API Server

**Files:**
- Modify: `internal/api/server.go`
- Test: `internal/api/server_test.go`

- [ ] **Step 1: Add runtime metadata to server options**

In `internal/api/server.go`, update `serverOptionConfig` to include `sidecarRuntime`:

```go
type serverOptionConfig struct {
	extraMiddleware      []gin.HandlerFunc
	engineConfigurator   func(*gin.Engine)
	routerConfigurator   func(*gin.Engine, *handlers.BaseAPIHandler, *config.Config)
	requestLoggerFactory func(*config.Config, string) logging.RequestLogger
	localPassword        string
	keepAliveEnabled     bool
	keepAliveTimeout     time.Duration
	keepAliveOnTimeout   func()
	postAuthHook         auth.PostAuthHook
	sidecarRuntime       SidecarRuntimeInfo
}
```

- [ ] **Step 2: Add server option helper**

In `internal/api/server.go`, after `WithPostAuthHook`, add:

```go
// WithSidecarRuntimeInfo records safe runtime mode metadata for machine-readable status endpoints.
func WithSidecarRuntimeInfo(info SidecarRuntimeInfo) ServerOption {
	return func(cfg *serverOptionConfig) {
		cfg.sidecarRuntime = info
	}
}
```

- [ ] **Step 3: Add runtime metadata field to Server**

In the `Server` struct in `internal/api/server.go`, after `localPassword string`, add:

```go
	sidecarRuntime SidecarRuntimeInfo
```

- [ ] **Step 4: Store runtime metadata during construction**

In `NewServer`, in the `s := &Server{...}` literal, add:

```go
		sidecarRuntime:      optionState.sidecarRuntime,
```

- [ ] **Step 5: Register `/statusz` routes**

In `setupRoutes`, immediately after the existing `/healthz` route registration, add:

```go
	s.engine.GET("/statusz", s.sidecarStatusHandler)
	s.engine.HEAD("/statusz", s.sidecarStatusHandler)
```

- [ ] **Step 6: Run endpoint tests**

Run: `go test ./internal/api -run 'TestHealthz|TestStatusz' -count=1`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run: `git add internal/api/server.go internal/api/sidecar_status.go internal/api/server_test.go && git commit -m "feat: expose sidecar status endpoint"`

Expected: commit succeeds.

---

### Task 3: Pass Runtime Flags from CLI Startup into the Service

**Files:**
- Modify: `internal/cmd/run.go`
- Modify: `cmd/server/main.go`
- Modify: `sdk/cliproxy/builder.go`

- [ ] **Step 1: Extend builder with runtime metadata**

In `sdk/cliproxy/builder.go`, add this import if not already available through existing imports:

```go
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/api"
```

The file already imports `internal/api`, so no import change should be required.

After `WithLocalManagementPassword`, add:

```go
// WithSidecarRuntimeInfo configures safe runtime metadata exposed by sidecar status endpoints.
func (b *Builder) WithSidecarRuntimeInfo(info api.SidecarRuntimeInfo) *Builder {
	b.serverOptions = append(b.serverOptions, api.WithSidecarRuntimeInfo(info))
	return b
}
```

- [ ] **Step 2: Update service start function signatures**

In `internal/cmd/run.go`, change the `StartService` signature to:

```go
func StartService(cfg *config.Config, configPath string, localPassword string, runtimeInfo api.SidecarRuntimeInfo) {
```

Change its builder chain to:

```go
	builder := cliproxy.NewBuilder().
		WithConfig(cfg).
		WithConfigPath(configPath).
		WithLocalManagementPassword(localPassword).
		WithSidecarRuntimeInfo(runtimeInfo)
```

Change `StartServiceBackground` signature to:

```go
func StartServiceBackground(cfg *config.Config, configPath string, localPassword string, runtimeInfo api.SidecarRuntimeInfo) (cancel func(), done <-chan struct{}) {
```

Change its builder chain to:

```go
	builder := cliproxy.NewBuilder().
		WithConfig(cfg).
		WithConfigPath(configPath).
		WithLocalManagementPassword(localPassword).
		WithSidecarRuntimeInfo(runtimeInfo)
```

- [ ] **Step 3: Create runtime info in `cmd/server/main.go`**

In `cmd/server/main.go`, after logging build info and before service startup branches, add:

```go
	runtimeInfo := api.SidecarRuntimeInfo{
		TUIMode:    tuiMode,
		Standalone: standalone,
		LocalModel: localModel,
	}
```

If `internal/api` is not imported in `cmd/server/main.go`, add:

```go
	"github.com/Lorenzo-Holmes/cli_LH/v7/internal/api"
```

- [ ] **Step 4: Update service start calls**

In `cmd/server/main.go`, change:

```go
				cancel, done := cmd.StartServiceBackground(cfg, configFilePath, password)
```

to:

```go
				cancel, done := cmd.StartServiceBackground(cfg, configFilePath, password, runtimeInfo)
```

Change:

```go
			cmd.StartService(cfg, configFilePath, password)
```

to:

```go
			cmd.StartService(cfg, configFilePath, password, runtimeInfo)
```

- [ ] **Step 5: Run compile-focused tests**

Run: `go test ./internal/api ./internal/cmd ./sdk/cliproxy -count=1`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run: `git add cmd/server/main.go internal/cmd/run.go sdk/cliproxy/builder.go && git commit -m "feat: pass sidecar runtime metadata"`

Expected: commit succeeds.

---

### Task 4: Add Sidecar Integration Guide

**Files:**
- Create: `docs/sidecar-integration.md`
- Modify: `README.md`
- Modify: `README_CN.md`

- [ ] **Step 1: Create integration guide**

Create `docs/sidecar-integration.md` with this content:

```markdown
# Sidecar Integration Guide

`cli_LH` can run as a local sidecar for desktop shells, web panels, editor extensions, or other local controllers.

## Shell/Core Separation

The shell owns user interaction. The core owns proxy execution.

Examples of shells:

- Tauri or Electron desktop tools
- web management panels
- VS Code extensions
- command-line wrappers

`cli_LH` should remain the core service. Shells should start it, pass explicit configuration, monitor it, and call its HTTP APIs.

## Recommended Launch Commands

Start the proxy service with a shell-owned config file:

```text
cli_LH --config <config.yaml> --local-model --no-browser
```

Start an isolated local service mode:

```text
cli_LH --standalone --config <config.yaml> --local-model --no-browser
```

Run Codex OAuth login as a separate foreground operation:

```text
cli_LH --codex-login --config <config.yaml> --no-browser
```

Run Codex device login when browser automation is not desired:

```text
cli_LH --codex-device-login --config <config.yaml> --no-browser
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
  "service": "cli_LH",
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

The shell may create or edit a `cli_LH` `config.yaml`, but `cli_LH` does not read shell-specific configuration schemas.

Recommended shell responsibilities:

1. Choose a config file path.
2. Choose an auth directory.
3. Start `cli_LH` with explicit arguments.
4. Poll `/healthz` or `/statusz` until ready.
5. Call proxy and management APIs over localhost.
6. Stop the sidecar process during application shutdown.

## Security Notes

- Prefer binding to `127.0.0.1` for desktop integrations.
- Keep management APIs protected by configured credentials.
- Do not display raw tokens or API keys in shell logs.
- Treat config and auth directories as sensitive local data.
```

- [ ] **Step 2: Link guide from English README**

In `README.md`, under the SDK or development-related section, add this bullet:

```markdown
- [Sidecar Integration Guide](docs/sidecar-integration.md) - guidance for embedding cli_LH in desktop shells, web panels, and local controllers.
```

- [ ] **Step 3: Link guide from Chinese README**

In `README_CN.md`, under the SDK or development-related section, add this bullet:

```markdown
- [Sidecar 集成指南](docs/sidecar-integration.md) - 面向桌面壳、Web 面板和本地控制器嵌入 cli_LH 的集成说明。
```

- [ ] **Step 4: Commit Task 4**

Run: `git add docs/sidecar-integration.md README.md README_CN.md && git commit -m "docs: add sidecar integration guide"`

Expected: commit succeeds.

---

### Task 5: Verification

**Files:**
- Verify: `internal/api/sidecar_status.go`
- Verify: `internal/api/server.go`
- Verify: `internal/api/server_test.go`
- Verify: `cmd/server/main.go`
- Verify: `internal/cmd/run.go`
- Verify: `sdk/cliproxy/builder.go`
- Verify: `docs/sidecar-integration.md`

- [ ] **Step 1: Format Go files**

Run: `gofmt -w internal/api/sidecar_status.go internal/api/server.go internal/api/server_test.go cmd/server/main.go internal/cmd/run.go sdk/cliproxy/builder.go`

Expected: command exits with code 0.

- [ ] **Step 2: Run focused tests**

Run: `go test ./internal/api ./internal/cmd ./sdk/cliproxy -count=1`

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 4: Verify server build**

Run: `go build -o test-output ./cmd/server; Remove-Item test-output`

Expected: build succeeds and `test-output` is removed.

- [ ] **Step 5: Final commit**

Run: `git status --short`

Expected: no uncommitted changes after previous task commits. If formatting changed files, run:

```text
git add internal/api/sidecar_status.go internal/api/server.go internal/api/server_test.go cmd/server/main.go internal/cmd/run.go sdk/cliproxy/builder.go docs/sidecar-integration.md README.md README_CN.md
git commit -m "chore: verify sidecar integration status contract"
```

Expected: final status is clean.

---

## Plan Self-Review

- Spec coverage: covered shell/core separation, launch contract, health/status contract, configuration ownership, phased implementation, testing, and no UI/Tauri import.
- Placeholder scan: no placeholder implementation steps are left.
- Type consistency: `SidecarRuntimeInfo`, `sidecarStatusResponse`, `/statusz`, and builder/server option names are used consistently across tasks.
