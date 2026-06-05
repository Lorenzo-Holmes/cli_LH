# Stage 3 Read-Only Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the desktop telemetry area into a beginner-friendly read-only dashboard using safe `/statusz` data.

**Architecture:** The Go sidecar already exposes safe runtime, provider-count, and management-capability data through `/statusz`. The desktop app should transform that raw machine data into three read-only dashboard panels: provider summary, management capabilities, and runtime paths. No management password is required, no config is edited, and no secret-bearing management endpoint is called.

**Tech Stack:** React 18, TypeScript, Vite, CSS, existing Tauri desktop app, existing Go `/statusz` endpoint.

---

## Current State

- `desktop/src/lib/status.ts` defines `SidecarStatusResponse` and `ProbeResult`.
- `desktop/src/components/StatusPanel.tsx` currently mixes health metrics, server paths, provider counts, and management booleans in one metadata grid.
- `desktop/src/App.tsx` already fetches `/statusz` through `probeSidecar()` and passes the result to `StatusPanel`.
- `desktop/src/styles.css` already has shared panel, metric, metadata, and responsive grid styles.

## Chosen Approach

Create small read-only dashboard components and keep `StatusPanel` focused on top-level health.

The new layout will be:

1. `StatusPanel`: process health, latency, last check, and service identity.
2. `ProviderSummaryPanel`: safe provider counts from `/statusz.providers`.
3. `ManagementSummaryPanel`: safe management capability booleans from `/statusz.management`.
4. `RuntimeSummaryPanel`: host, port, config path, auth directory, and runtime mode flags.

### Why this approach

A beginner should not see one long technical list first. Splitting the same data into named panels teaches the mental model:

- providers = what credentials/routes are configured,
- management = what local control features are enabled,
- runtime = how and where the engine is running.

### Trade-offs

- **Pros:** No new backend risk, no secret access, clearer UI, easy to verify with TypeScript and build checks.
- **Cons:** It is still read-only; editing config and authenticated usage/log dashboards remain future Stage 3 increments.

## File Structure

- Modify `desktop/src/components/StatusPanel.tsx`
  - Keep only health/latency/service metrics and error display.
- Create `desktop/src/components/ProviderSummaryPanel.tsx`
  - Render provider counts from `ProbeResult.status.providers`.
- Create `desktop/src/components/ManagementSummaryPanel.tsx`
  - Render management booleans from `ProbeResult.status.management`.
- Create `desktop/src/components/RuntimeSummaryPanel.tsx`
  - Render safe server paths and runtime flags from `ProbeResult.status.server` and `ProbeResult.status.runtime`.
- Modify `desktop/src/App.tsx`
  - Import and render the three new panels near `StatusPanel`.
- Modify `desktop/src/styles.css`
  - Add compact summary-card and badge styles.
- Modify `desktop/README.md`
  - Add a beginner note explaining the read-only dashboard panels.

## Task 1: Split provider summary into its own panel

**Files:**
- Create: `desktop/src/components/ProviderSummaryPanel.tsx`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/components/StatusPanel.tsx`
- Modify: `desktop/src/styles.css`

- [ ] **Step 1: Create provider summary component**

Create `desktop/src/components/ProviderSummaryPanel.tsx` with:

```tsx
import { KeyRound } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function ProviderSummaryPanel({ probe }: { probe?: ProbeResult }) {
  const providers = probe?.status?.providers;
  const items = [
    { label: "Gemini keys", value: providers?.geminiApiKeys ?? 0 },
    { label: "Codex keys", value: providers?.codexApiKeys ?? 0 },
    { label: "Claude keys", value: providers?.claudeApiKeys ?? 0 },
    { label: "OpenAI compat", value: providers?.openaiCompatibilityEntries ?? 0 },
    { label: "Vertex keys", value: providers?.vertexApiKeys ?? 0 },
    { label: "OAuth aliases", value: providers?.oauthModelAliases ?? 0 },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="panel summary-panel">
      <div className="panel-heading">
        <span>Providers</span>
        <strong>{total} entries</strong>
      </div>
      <div className="summary-card hero-summary">
        <KeyRound />
        <div>
          <strong>{total > 0 ? "Provider routing configured" : "No provider entries detected"}</strong>
          <p>Counts only. API keys and OAuth tokens are never shown here.</p>
        </div>
      </div>
      <div className="metadata-grid compact">
        {items.map((item) => (
          <FragmentRow key={item.label} label={item.label} value={String(item.value)} />
        ))}
        <FragmentRow label="Home mode" value={providers?.homeEnabled ? "Enabled" : "Disabled"} />
      </div>
    </section>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
}
```

- [ ] **Step 2: Import provider panel in App**

In `desktop/src/App.tsx`, add:

```tsx
import { ProviderSummaryPanel } from "./components/ProviderSummaryPanel";
```

- [ ] **Step 3: Render provider panel**

In `desktop/src/App.tsx`, after `<StatusPanel probe={probe} />`, add:

```tsx
          <ProviderSummaryPanel probe={probe} />
```

- [ ] **Step 4: Remove provider rows from StatusPanel**

In `desktop/src/components/StatusPanel.tsx`, delete these rows from the metadata grid:

```tsx
        <span>Gemini keys</span><strong>{status?.providers?.geminiApiKeys ?? 0}</strong>
        <span>Codex keys</span><strong>{status?.providers?.codexApiKeys ?? 0}</strong>
        <span>Claude keys</span><strong>{status?.providers?.claudeApiKeys ?? 0}</strong>
        <span>OpenAI compat</span><strong>{status?.providers?.openaiCompatibilityEntries ?? 0}</strong>
```

- [ ] **Step 5: Add summary styles**

In `desktop/src/styles.css`, after `.metadata-grid strong { ... }`, add:

```css
.metadata-grid.compact { grid-template-columns: 150px 1fr; }
.summary-panel { min-height: 260px; }
.summary-card { border: 1px solid var(--line); border-radius: 18px; padding: 14px; display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,0.035); }
.summary-card svg { color: var(--cyan); width: 22px; flex: 0 0 auto; }
.summary-card strong { display: block; margin-bottom: 4px; }
.summary-card p { margin: 0; color: var(--text-muted); line-height: 1.45; }
.hero-summary { margin-bottom: 14px; }
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm --prefix desktop run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit provider panel**

Run:

```bash
git add desktop/src/App.tsx desktop/src/components/StatusPanel.tsx desktop/src/components/ProviderSummaryPanel.tsx desktop/src/styles.css
git commit -m "feat(desktop): add provider summary panel"
```

Expected: commit succeeds.

## Task 2: Split management summary into its own panel

**Files:**
- Create: `desktop/src/components/ManagementSummaryPanel.tsx`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/components/StatusPanel.tsx`
- Modify: `desktop/src/styles.css`

- [ ] **Step 1: Create management summary component**

Create `desktop/src/components/ManagementSummaryPanel.tsx` with:

```tsx
import { ShieldCheck } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function ManagementSummaryPanel({ probe }: { probe?: ProbeResult }) {
  const management = probe?.status?.management;
  const available = management?.available === true;

  const items = [
    { label: "Management API", value: enabledText(management?.available) },
    { label: "Local password", value: enabledText(management?.localPasswordAvailable) },
    { label: "Remote access", value: enabledText(management?.remoteManagementAllowed) },
    { label: "Control panel", value: enabledText(management?.controlPanelEnabled) },
    { label: "Panel auto-update", value: enabledText(management?.autoUpdatePanelEnabled) },
    { label: "Usage stats", value: enabledText(management?.usageStatisticsEnabled) },
    { label: "Request log", value: enabledText(management?.requestLogEnabled) },
    { label: "File logging", value: enabledText(management?.loggingToFileEnabled) },
    { label: "WebSocket auth", value: enabledText(management?.websocketAuthEnabled) },
    { label: "TLS", value: enabledText(management?.tlsEnabled) },
  ];

  return (
    <section className="panel summary-panel">
      <div className="panel-heading">
        <span>Management</span>
        <strong>{available ? "available" : "locked"}</strong>
      </div>
      <div className={`summary-card ${available ? "summary-ok" : "summary-muted"}`}>
        <ShieldCheck />
        <div>
          <strong>{available ? "Local control is configured" : "Management key not configured"}</strong>
          <p>Only safe booleans are shown. Passwords and management keys stay hidden.</p>
        </div>
      </div>
      <div className="metadata-grid compact">
        {items.map((item) => (
          <FragmentRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </section>
  );
}

function enabledText(value?: boolean) {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
}
```

- [ ] **Step 2: Import management panel in App**

In `desktop/src/App.tsx`, add:

```tsx
import { ManagementSummaryPanel } from "./components/ManagementSummaryPanel";
```

- [ ] **Step 3: Render management panel**

In `desktop/src/App.tsx`, after `<ProviderSummaryPanel probe={probe} />`, add:

```tsx
          <ManagementSummaryPanel probe={probe} />
```

- [ ] **Step 4: Remove management rows from StatusPanel**

In `desktop/src/components/StatusPanel.tsx`, delete these rows from the metadata grid:

```tsx
        <span>Management API</span><strong>{yesNo(status?.management?.available)}</strong>
        <span>Control panel</span><strong>{yesNo(status?.management?.controlPanelEnabled)}</strong>
        <span>Usage stats</span><strong>{yesNo(status?.management?.usageStatisticsEnabled)}</strong>
        <span>Request log</span><strong>{yesNo(status?.management?.requestLogEnabled)}</strong>
        <span>WebSocket auth</span><strong>{yesNo(status?.management?.websocketAuthEnabled)}</strong>
        <span>TLS</span><strong>{yesNo(status?.management?.tlsEnabled)}</strong>
```

Also delete the unused helper:

```tsx
function yesNo(value?: boolean) {
  if (value === undefined) return "-";
  return value ? "Yes" : "No";
}
```

- [ ] **Step 5: Add management summary styles**

In `desktop/src/styles.css`, after `.hero-summary { margin-bottom: 14px; }`, add:

```css
.summary-ok { border-color: rgba(125,255,157,0.28); }
.summary-muted { border-color: rgba(255,189,74,0.22); }
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm --prefix desktop run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit management panel**

Run:

```bash
git add desktop/src/App.tsx desktop/src/components/StatusPanel.tsx desktop/src/components/ManagementSummaryPanel.tsx desktop/src/styles.css
git commit -m "feat(desktop): add management summary panel"
```

Expected: commit succeeds.

## Task 3: Split runtime summary into its own panel

**Files:**
- Create: `desktop/src/components/RuntimeSummaryPanel.tsx`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/components/StatusPanel.tsx`
- Modify: `desktop/src/styles.css`

- [ ] **Step 1: Create runtime summary component**

Create `desktop/src/components/RuntimeSummaryPanel.tsx` with:

```tsx
import { ServerCog } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function RuntimeSummaryPanel({ probe }: { probe?: ProbeResult }) {
  const status = probe?.status;
  const server = status?.server;
  const runtime = status?.runtime;

  return (
    <section className="panel runtime-panel">
      <div className="panel-heading">
        <span>Runtime</span>
        <strong>{server?.port ? `:${server.port}` : "unknown"}</strong>
      </div>
      <div className="summary-card hero-summary">
        <ServerCog />
        <div>
          <strong>{server?.host || server?.port ? "Go sidecar endpoint detected" : "Waiting for sidecar status"}</strong>
          <p>These paths and flags describe where the local engine is running.</p>
        </div>
      </div>
      <div className="metadata-grid runtime-grid">
        <span>Host</span><strong>{server?.host || "all interfaces"}</strong>
        <span>Port</span><strong>{server?.port ?? "-"}</strong>
        <span>Config</span><strong title={server?.configPath}>{server?.configPath ?? "-"}</strong>
        <span>Auth dir</span><strong title={server?.authDir}>{server?.authDir ?? "-"}</strong>
        <span>TUI mode</span><strong>{enabledText(runtime?.tuiMode)}</strong>
        <span>Standalone</span><strong>{enabledText(runtime?.standalone)}</strong>
        <span>Local model</span><strong>{enabledText(runtime?.localModel)}</strong>
      </div>
    </section>
  );
}

function enabledText(value?: boolean) {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}
```

- [ ] **Step 2: Import runtime panel in App**

In `desktop/src/App.tsx`, add:

```tsx
import { RuntimeSummaryPanel } from "./components/RuntimeSummaryPanel";
```

- [ ] **Step 3: Render runtime panel**

In `desktop/src/App.tsx`, after `<ManagementSummaryPanel probe={probe} />`, add:

```tsx
          <RuntimeSummaryPanel probe={probe} />
```

- [ ] **Step 4: Simplify StatusPanel metadata**

In `desktop/src/components/StatusPanel.tsx`, remove this whole metadata block:

```tsx
      <div className="metadata-grid">
        <span>Host</span><strong>{status?.server?.host ?? "-"}</strong>
        <span>Port</span><strong>{status?.server?.port ?? "-"}</strong>
        <span>Config</span><strong title={status?.server?.configPath}>{status?.server?.configPath ?? "-"}</strong>
        <span>Auth dir</span><strong title={status?.server?.authDir}>{status?.server?.authDir ?? "-"}</strong>
      </div>
```

`StatusPanel` should then only show top health metrics and any `probe.error`.

- [ ] **Step 5: Add runtime panel span style**

In `desktop/src/styles.css`, after `.summary-muted { border-color: rgba(255,189,74,0.22); }`, add:

```css
.runtime-panel { grid-column: span 2; }
.runtime-grid { grid-template-columns: 120px minmax(0, 1fr); }
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm --prefix desktop run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit runtime panel**

Run:

```bash
git add desktop/src/App.tsx desktop/src/components/StatusPanel.tsx desktop/src/components/RuntimeSummaryPanel.tsx desktop/src/styles.css
git commit -m "feat(desktop): add runtime summary panel"
```

Expected: commit succeeds.

## Task 4: Add beginner dashboard documentation

**Files:**
- Modify: `desktop/README.md`

- [ ] **Step 1: Add read-only dashboard note**

After the `## Health and Status Endpoints` section, add:

```markdown
## Read-Only Dashboard Panels

The Stage 3 dashboard starts as read-only on purpose:

- **Telemetry** answers whether the local Go sidecar is responding.
- **Providers** summarizes configured provider entries by count, without showing keys.
- **Management** summarizes enabled local control features, without showing passwords.
- **Runtime** shows where the sidecar is running and which launch modes are active.

This is safer for beginners than starting with editable settings. First learn what the engine is doing; then later stages can add controlled editing where it is safe.
```

- [ ] **Step 2: Commit docs**

Run:

```bash
git add desktop/README.md
git commit -m "docs(desktop): explain read-only dashboard panels"
```

Expected: commit succeeds.

## Task 5: Full verification

**Files:**
- Verify repository state only.

- [ ] **Step 1: Run desktop typecheck**

Run:

```bash
npm --prefix desktop run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run desktop build**

Run:

```bash
npm --prefix desktop run build
```

Expected: PASS.

- [ ] **Step 3: Run Tauri check**

Run:

```bash
npm --prefix desktop run tauri:check
```

Expected: PASS.

- [ ] **Step 4: Run Go tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 5: Verify Go server compile**

Run:

```bash
go build -o test-output ./cmd/server
```

Expected: PASS and creates `test-output`.

- [ ] **Step 6: Remove temporary build artifact**

Run:

```bash
rm test-output
```

Expected: `test-output` is removed.

- [ ] **Step 7: Check working tree**

Run:

```bash
git status --short
```

Expected: no unexpected files. `test-output` must not remain.

## Plan Self-Review

- **Spec coverage:** Stage 3 asks for dashboard features using safe data. This plan adds provider, management, and runtime dashboard panels using existing `/statusz`; no authenticated or secret-bearing endpoint is used.
- **Placeholder scan:** No `TBD`, `TODO`, or vague implementation steps remain.
- **Type consistency:** Component props consistently use `ProbeResult`; status fields match `desktop/src/lib/status.ts` names.
- **Scope check:** This is intentionally the first Stage 3 increment. Authenticated usage and request-log dashboards are not included because they require management-key UX and stronger security design.
