# Stage 2 Management Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe management-capability summary to `/statusz` and show it in the desktop status panel.

**Architecture:** The Go server remains the source of truth for engine state. `/healthz` stays a tiny liveness check, while `/statusz` gains additive, non-secret fields that tell the desktop app which management surfaces and safety switches are available. The React desktop app reads those fields through its existing probe flow and renders them as status text only.

**Tech Stack:** Go 1.26+, Gin, Go `testing`, React 18, TypeScript, Vite, Tauri 2.

---

## Current State

- `internal/api/sidecar_status.go` already returns safe build, server, runtime, and provider-count data from `/statusz`.
- `internal/api/server_test.go` already tests `/statusz` shape, `HEAD`, and secret omission.
- `desktop/src/lib/status.ts` already defines `SidecarStatusResponse` and fetches `/healthz` then `/statusz`.
- `desktop/src/components/StatusPanel.tsx` already displays server and provider metadata.

## Chosen Approach

Use an additive `management` object under `/statusz`.

Example response shape:

```json
{
  "status": "ready",
  "service": "cli_LH",
  "management": {
    "available": true,
    "localPasswordAvailable": false,
    "remoteManagementAllowed": false,
    "controlPanelEnabled": true,
    "autoUpdatePanelEnabled": true,
    "usageStatisticsEnabled": false,
    "requestLogEnabled": false,
    "loggingToFileEnabled": false,
    "websocketAuthEnabled": false,
    "tlsEnabled": false
  }
}
```

### Why this approach

- Good for beginners: the dashboard can explain backend capabilities without teaching every config file detail first.
- Low risk: no existing fields are removed or renamed.
- Safe: booleans expose whether features are enabled, not passwords, hashes, tokens, or API keys.
- Testable: Go tests can prove the shape and secret-omission behavior.

### Trade-offs

- **Pros:** Small change, clear API contract, useful for desktop and future dashboard work.
- **Cons:** Does not yet add a full management dashboard or editing UI; those remain Stage 3 work.

## File Structure

- Modify `internal/api/sidecar_status.go`
  - Add `sidecarManagementSummary`.
  - Add `Management sidecarManagementSummary` to `sidecarStatusResponse`.
  - Populate management booleans from `config.Config` and `Server.localPassword`.
- Modify `internal/api/server_test.go`
  - Add focused tests for the new `management` object.
  - Extend existing contract shape test to require `management`.
  - Extend secret-omission test to prove local management password and panel repository values are not leaked.
- Modify `desktop/src/lib/status.ts`
  - Add a typed optional `management` object to `SidecarStatusResponse`.
- Modify `desktop/src/components/StatusPanel.tsx`
  - Render management capability rows from the existing `probe.status` data.
- Modify `desktop/README.md`
  - Add a short beginner note explaining `/healthz`, `/statusz`, and why management capability data is read-only.

## Task 1: Add Go tests for `/statusz.management`

**Files:**
- Modify: `internal/api/server_test.go`
- Test: `internal/api/server_test.go`

- [ ] **Step 1: Add failing test for management summary values**

Add this test after `TestStatuszContractFieldShape`:

```go
func TestStatuszIncludesManagementCapabilitySummary(t *testing.T) {
	server := newTestServer(t)
	server.localPassword = "local-management-password"
	server.cfg.RemoteManagement.AllowRemote = true
	server.cfg.RemoteManagement.SecretKey = "hashed-or-plain-secret"
	server.cfg.RemoteManagement.DisableControlPanel = false
	server.cfg.RemoteManagement.DisableAutoUpdatePanel = true
	server.cfg.UsageStatisticsEnabled = true
	server.cfg.RequestLog = true
	server.cfg.LoggingToFile = true
	server.cfg.WebsocketAuth = true
	server.cfg.TLS.Enable = true

	req := httptest.NewRequest(http.MethodGet, "/statusz", nil)
	w := httptest.NewRecorder()
	server.engine.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status code: got %d want %d; body=%s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp sidecarStatusResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response JSON: %v; body=%s", err, w.Body.String())
	}

	management := resp.Management
	if !management.Available {
		t.Fatalf("management.available = false, want true")
	}
	if !management.LocalPasswordAvailable {
		t.Fatalf("management.localPasswordAvailable = false, want true")
	}
	if !management.RemoteManagementAllowed {
		t.Fatalf("management.remoteManagementAllowed = false, want true")
	}
	if !management.ControlPanelEnabled {
		t.Fatalf("management.controlPanelEnabled = false, want true")
	}
	if management.AutoUpdatePanelEnabled {
		t.Fatalf("management.autoUpdatePanelEnabled = true, want false")
	}
	if !management.UsageStatisticsEnabled {
		t.Fatalf("management.usageStatisticsEnabled = false, want true")
	}
	if !management.RequestLogEnabled {
		t.Fatalf("management.requestLogEnabled = false, want true")
	}
	if !management.LoggingToFileEnabled {
		t.Fatalf("management.loggingToFileEnabled = false, want true")
	}
	if !management.WebsocketAuthEnabled {
		t.Fatalf("management.websocketAuthEnabled = false, want true")
	}
	if !management.TLSEnabled {
		t.Fatalf("management.tlsEnabled = false, want true")
	}
}
```

- [ ] **Step 2: Extend contract shape test**

In `TestStatuszContractFieldShape`, change:

```go
for _, key := range []string{"status", "service", "build", "server", "runtime", "providers"} {
```

to:

```go
for _, key := range []string{"status", "service", "build", "server", "runtime", "providers", "management"} {
```

Then add this block after the provider field assertions:

```go
managementInfo, ok := payload["management"].(map[string]any)
if !ok {
	t.Fatalf("management field = %#v, want object", payload["management"])
}
for _, key := range []string{"available", "localPasswordAvailable", "remoteManagementAllowed", "controlPanelEnabled", "autoUpdatePanelEnabled", "usageStatisticsEnabled", "requestLogEnabled", "loggingToFileEnabled", "websocketAuthEnabled", "tlsEnabled"} {
	if _, ok := managementInfo[key]; !ok {
		t.Fatalf("management field missing key %q: %#v", key, managementInfo)
	}
}
```

- [ ] **Step 3: Extend secret omission test**

In `TestStatuszOmitsSecrets`, add these assignments after `server.cfg.RemoteManagement.SecretKey = "management-secret-value"`:

```go
server.localPassword = "local-password-secret-value"
server.cfg.RemoteManagement.PanelGitHubRepository = "https://example.test/private-panel-repository-secret"
```

Then change the secret list to:

```go
for _, secret := range []string{"management-secret-value", "local-password-secret-value", "private-panel-repository-secret", "api-secret-value", "gemini-secret-value", "codex-secret-value", "claude-secret-value"} {
```

- [ ] **Step 4: Run focused tests to verify RED**

Run:

```bash
go test ./internal/api -run "TestStatuszIncludesManagementCapabilitySummary|TestStatuszContractFieldShape|TestStatuszOmitsSecrets"
```

Expected: FAIL because `sidecarStatusResponse` has no `Management` field and the JSON has no `management` top-level key.

## Task 2: Implement `/statusz.management`

**Files:**
- Modify: `internal/api/sidecar_status.go`
- Test: `internal/api/server_test.go`

- [ ] **Step 1: Add management summary type**

In `internal/api/sidecar_status.go`, add this type after `sidecarProviderSummary`:

```go
type sidecarManagementSummary struct {
	Available                bool `json:"available"`
	LocalPasswordAvailable   bool `json:"localPasswordAvailable"`
	RemoteManagementAllowed  bool `json:"remoteManagementAllowed"`
	ControlPanelEnabled      bool `json:"controlPanelEnabled"`
	AutoUpdatePanelEnabled   bool `json:"autoUpdatePanelEnabled"`
	UsageStatisticsEnabled   bool `json:"usageStatisticsEnabled"`
	RequestLogEnabled        bool `json:"requestLogEnabled"`
	LoggingToFileEnabled     bool `json:"loggingToFileEnabled"`
	WebsocketAuthEnabled     bool `json:"websocketAuthEnabled"`
	TLSEnabled               bool `json:"tlsEnabled"`
}
```

- [ ] **Step 2: Add field to status response**

Change `sidecarStatusResponse` from:

```go
type sidecarStatusResponse struct {
	Status    string                 `json:"status"`
	Service   string                 `json:"service"`
	Build     sidecarBuildInfo       `json:"build"`
	Server    sidecarServerInfo      `json:"server"`
	Runtime   SidecarRuntimeInfo     `json:"runtime"`
	Providers sidecarProviderSummary `json:"providers"`
}
```

to:

```go
type sidecarStatusResponse struct {
	Status     string                   `json:"status"`
	Service    string                   `json:"service"`
	Build      sidecarBuildInfo         `json:"build"`
	Server     sidecarServerInfo        `json:"server"`
	Runtime    SidecarRuntimeInfo       `json:"runtime"`
	Providers  sidecarProviderSummary   `json:"providers"`
	Management sidecarManagementSummary `json:"management"`
}
```

- [ ] **Step 3: Populate management summary**

Inside `if s != nil && s.cfg != nil { ... }`, after `resp.Providers = sidecarProviderSummary{...}`, add:

```go
hasManagementSecret := s.cfg.RemoteManagement.SecretKey != "" || s.localPassword != ""
resp.Management = sidecarManagementSummary{
	Available:                hasManagementSecret,
	LocalPasswordAvailable:   s.localPassword != "",
	RemoteManagementAllowed:  s.cfg.RemoteManagement.AllowRemote,
	ControlPanelEnabled:      !s.cfg.RemoteManagement.DisableControlPanel,
	AutoUpdatePanelEnabled:   !s.cfg.RemoteManagement.DisableAutoUpdatePanel,
	UsageStatisticsEnabled:   s.cfg.UsageStatisticsEnabled,
	RequestLogEnabled:        s.cfg.RequestLog,
	LoggingToFileEnabled:     s.cfg.LoggingToFile,
	WebsocketAuthEnabled:     s.cfg.WebsocketAuth,
	TLSEnabled:               s.cfg.TLS.Enable,
}
```

- [ ] **Step 4: Run focused tests to verify GREEN**

Run:

```bash
go test ./internal/api -run "TestStatuszIncludesManagementCapabilitySummary|TestStatuszContractFieldShape|TestStatuszOmitsSecrets"
```

Expected: PASS.

- [ ] **Step 5: Format Go files**

Run:

```bash
gofmt -w internal/api/sidecar_status.go internal/api/server_test.go
```

Expected: command exits with code 0 and no output.

- [ ] **Step 6: Run package tests**

Run:

```bash
go test ./internal/api
```

Expected: PASS.

- [ ] **Step 7: Commit Go backend change**

Run:

```bash
git add internal/api/sidecar_status.go internal/api/server_test.go
git commit -m "feat: expose management status summary"
```

Expected: commit succeeds.

## Task 3: Display management summary in desktop telemetry

**Files:**
- Modify: `desktop/src/lib/status.ts`
- Modify: `desktop/src/components/StatusPanel.tsx`

- [ ] **Step 1: Add TypeScript status fields**

In `desktop/src/lib/status.ts`, add this optional property after `providers?: { ... };`:

```ts
  management?: {
    available?: boolean;
    localPasswordAvailable?: boolean;
    remoteManagementAllowed?: boolean;
    controlPanelEnabled?: boolean;
    autoUpdatePanelEnabled?: boolean;
    usageStatisticsEnabled?: boolean;
    requestLogEnabled?: boolean;
    loggingToFileEnabled?: boolean;
    websocketAuthEnabled?: boolean;
    tlsEnabled?: boolean;
  };
```

- [ ] **Step 2: Render management rows**

In `desktop/src/components/StatusPanel.tsx`, add this helper before `Metric`:

```tsx
function yesNo(value?: boolean) {
  if (value === undefined) return "-";
  return value ? "Yes" : "No";
}
```

Then add these rows at the end of the `<div className="metadata-grid">` block:

```tsx
        <span>Management API</span><strong>{yesNo(status?.management?.available)}</strong>
        <span>Control panel</span><strong>{yesNo(status?.management?.controlPanelEnabled)}</strong>
        <span>Usage stats</span><strong>{yesNo(status?.management?.usageStatisticsEnabled)}</strong>
        <span>Request log</span><strong>{yesNo(status?.management?.requestLogEnabled)}</strong>
        <span>WebSocket auth</span><strong>{yesNo(status?.management?.websocketAuthEnabled)}</strong>
        <span>TLS</span><strong>{yesNo(status?.management?.tlsEnabled)}</strong>
```

- [ ] **Step 3: Run desktop typecheck**

Run:

```bash
npm --prefix desktop run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit desktop display change**

Run:

```bash
git add desktop/src/lib/status.ts desktop/src/components/StatusPanel.tsx
git commit -m "feat(desktop): show management status summary"
```

Expected: commit succeeds.

## Task 4: Add beginner documentation

**Files:**
- Modify: `desktop/README.md`

- [ ] **Step 1: Add status endpoint explanation**

Add this section after `## Beginner Mental Model`:

```markdown
## Health and Status Endpoints

The desktop app checks two safe HTTP endpoints on the local Go sidecar:

- `/healthz` answers one simple question: is the process alive enough to answer HTTP?
- `/statusz` answers a richer question: what safe runtime, provider-count, and management-capability information can the UI show?

`/statusz` intentionally reports counts and booleans instead of secrets. For example, it can say that the Management API is available or that request logging is enabled, but it must not return management passwords, API keys, OAuth tokens, or provider credentials.
```

- [ ] **Step 2: Commit documentation**

Run:

```bash
git add desktop/README.md
git commit -m "docs(desktop): explain health and status endpoints"
```

Expected: commit succeeds.

## Task 5: Full verification

**Files:**
- Verify repository state only.

- [ ] **Step 1: Run Go tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 2: Verify Go server compile**

Run:

```bash
go build -o test-output ./cmd/server
```

Expected: PASS and creates `test-output`.

- [ ] **Step 3: Remove temporary build artifact**

Run:

```bash
rm test-output
```

Expected: `test-output` is removed.

- [ ] **Step 4: Run desktop typecheck**

Run:

```bash
npm --prefix desktop run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run desktop build**

Run:

```bash
npm --prefix desktop run build
```

Expected: PASS.

- [ ] **Step 6: Run Tauri check**

Run:

```bash
npm --prefix desktop run tauri:check
```

Expected: PASS.

- [ ] **Step 7: Check working tree**

Run:

```bash
git status --short
```

Expected: no unexpected files. `test-output` must not remain.

## Plan Self-Review

- **Spec coverage:** Stage 2 requires safe backend status data, no secret leakage, focused Go tests, and stable desktop display. Tasks 1-2 cover backend tests and implementation; Task 3 displays data; Task 4 documents beginner concepts; Task 5 verifies.
- **Placeholder scan:** No `TBD`, `TODO`, or vague implementation-only steps remain.
- **Type consistency:** Go JSON names match TypeScript names: `localPasswordAvailable`, `remoteManagementAllowed`, `controlPanelEnabled`, `autoUpdatePanelEnabled`, `usageStatisticsEnabled`, `requestLogEnabled`, `loggingToFileEnabled`, `websocketAuthEnabled`, `tlsEnabled`.
- **Scope check:** This plan intentionally avoids full management editing UI; that belongs to Stage 3.
