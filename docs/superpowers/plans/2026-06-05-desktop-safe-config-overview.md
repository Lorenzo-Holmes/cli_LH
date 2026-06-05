# Desktop Safe Config Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Safe Config Overview panel for the desktop cockpit without exposing secrets.

**Architecture:** Add a focused frontend view-model builder that consumes existing safe app state and `/statusz` data, then render it through a new React panel. No native file reads and no backend changes are required.

**Tech Stack:** React, TypeScript, Tauri command bridge already present, Vite, existing desktop CSS.

---

## File Structure

- Create `desktop/src/lib/safeConfigOverview.ts`: converts settings/state/preflight/probe into safe display sections and notes.
- Create `desktop/src/components/SafeConfigOverviewPanel.tsx`: renders overview sections and warning notes.
- Modify `desktop/src/App.tsx`: import and place the new panel.
- Modify `desktop/src/styles.css`: add focused overview card styles.
- Modify `desktop/README.md`: document the panel and privacy boundary.

## Task 1: Safe Config Overview View Model

**Files:**
- Create: `desktop/src/lib/safeConfigOverview.ts`

- [ ] **Step 1: Create the view-model builder**

Create `desktop/src/lib/safeConfigOverview.ts` with:

```ts
import type { PreflightReport, SidecarState } from "./sidecar";
import type { ProbeResult } from "./status";
import type { DesktopSettings } from "./storage";

export type SafeConfigOverviewInput = {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
};

export type SafeConfigItem = {
  label: string;
  value: string;
  tone?: "ok" | "warning" | "critical";
};

export type SafeConfigSection = {
  title: string;
  items: SafeConfigItem[];
};

export type SafeConfigNote = {
  title: string;
  detail: string;
  tone: "ok" | "warning" | "critical";
};

export type SafeConfigOverview = {
  sections: SafeConfigSection[];
  notes: SafeConfigNote[];
};

export function buildSafeConfigOverview(input: SafeConfigOverviewInput): SafeConfigOverview {
  const status = input.probe?.status;
  const preflightErrors = input.preflight?.checks.filter((check) => check.severity === "error").length ?? 0;
  const preflightWarnings = input.preflight?.checks.filter((check) => check.severity === "warning").length ?? 0;

  return {
    sections: [
      {
        title: "Launch profile",
        items: [
          { label: "Base URL", value: sanitizeBaseUrl(input.settings.baseUrl), tone: isLocalBaseUrl(input.settings.baseUrl) ? "ok" : "warning" },
          { label: "Binary", value: fileNameOrState(input.settings.binaryPath), tone: input.settings.binaryPath ? "ok" : "critical" },
          { label: "Config", value: fileNameOrState(input.settings.configPath), tone: input.settings.configPath ? "ok" : "critical" },
          { label: "Local model", value: enabled(input.settings.localModel) },
          { label: "Auto start", value: enabled(input.settings.autoStart) },
        ],
      },
      {
        title: "Runtime",
        items: [
          { label: "Native phase", value: input.state.phase },
          { label: "HTTP probe", value: input.probe ? (input.probe.ok ? "Ready" : "Unavailable") : "Not checked", tone: input.probe?.ok ? "ok" : "warning" },
          { label: "Server host", value: status?.server?.host ?? "Unavailable" },
          { label: "Server port", value: status?.server?.port ? String(status.server.port) : "Unavailable" },
          { label: "TUI mode", value: enabled(status?.runtime?.tuiMode) },
          { label: "Standalone", value: enabled(status?.runtime?.standalone) },
        ],
      },
      {
        title: "Providers",
        items: [
          { label: "Gemini API keys", value: count(status?.providers?.geminiApiKeys) },
          { label: "Codex API keys", value: count(status?.providers?.codexApiKeys) },
          { label: "Claude API keys", value: count(status?.providers?.claudeApiKeys) },
          { label: "OpenAI compatibility", value: count(status?.providers?.openaiCompatibilityEntries) },
          { label: "Vertex API keys", value: count(status?.providers?.vertexApiKeys) },
          { label: "OAuth aliases", value: count(status?.providers?.oauthModelAliases) },
        ],
      },
      {
        title: "Management",
        items: [
          { label: "Available", value: enabled(status?.management?.available), tone: status?.management?.available ? "ok" : "warning" },
          { label: "Local password", value: enabled(status?.management?.localPasswordAvailable) },
          { label: "Remote allowed", value: enabled(status?.management?.remoteManagementAllowed), tone: status?.management?.remoteManagementAllowed ? "warning" : "ok" },
          { label: "Request logging", value: enabled(status?.management?.requestLogEnabled), tone: status?.management?.requestLogEnabled ? "warning" : "ok" },
          { label: "File logging", value: enabled(status?.management?.loggingToFileEnabled), tone: status?.management?.loggingToFileEnabled ? "warning" : undefined },
          { label: "TLS", value: enabled(status?.management?.tlsEnabled) },
        ],
      },
      {
        title: "Preflight",
        items: [
          { label: "Can start", value: input.preflight ? yesNo(input.preflight.canStart) : "Not checked", tone: input.preflight?.canStart ? "ok" : "warning" },
          { label: "Errors", value: String(preflightErrors), tone: preflightErrors > 0 ? "critical" : "ok" },
          { label: "Warnings", value: String(preflightWarnings), tone: preflightWarnings > 0 ? "warning" : "ok" },
        ],
      },
    ],
    notes: buildNotes(input),
  };
}

function buildNotes(input: SafeConfigOverviewInput): SafeConfigNote[] {
  const status = input.probe?.status;
  const notes: SafeConfigNote[] = [];

  if (!input.settings.binaryPath || !input.settings.configPath) {
    notes.push({ title: "Setup is incomplete", detail: "Choose the cli_LH binary and config.yaml before starting the sidecar.", tone: "critical" });
  }

  if (!isLocalBaseUrl(input.settings.baseUrl)) {
    notes.push({ title: "Base URL is not local-only", detail: "For beginner desktop use, prefer 127.0.0.1 or localhost unless remote access is intentional.", tone: "warning" });
  }

  if (status?.management?.remoteManagementAllowed) {
    notes.push({ title: "Remote management is enabled", detail: "Keep management credentials private and expose the port only when you understand the network boundary.", tone: "warning" });
  }

  if (status?.management?.requestLogEnabled || status?.management?.loggingToFileEnabled) {
    notes.push({ title: "Logging may contain operational data", detail: "Review log-sharing practices before sending files to others.", tone: "warning" });
  }

  if (!input.probe?.status) {
    notes.push({ title: "Live sidecar status is unavailable", detail: "Start the sidecar or fix probe errors to populate runtime, provider, and management facts.", tone: "warning" });
  }

  if (notes.length === 0) {
    notes.push({ title: "Overview is safe to share at a glance", detail: "This panel shows counts, booleans, and file names only. It does not display secrets or full config contents.", tone: "ok" });
  }

  return notes;
}

function sanitizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value || "Unavailable";
  }
}

function isLocalBaseUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

function fileNameOrState(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Not configured";
  const parts = trimmed.split(/[\\/]+/);
  return parts[parts.length - 1] || "Configured";
}

function enabled(value?: boolean): string {
  if (value === undefined) return "Unavailable";
  return value ? "Enabled" : "Disabled";
}

function count(value?: number): string {
  return typeof value === "number" ? String(value) : "Unavailable";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
```

- [ ] **Step 2: Run frontend typecheck**

Run: `npm --prefix desktop run typecheck`

Expected: PASS with `tsc --noEmit` and no TypeScript errors.

- [ ] **Step 3: Commit**

Run:

```bash
git add desktop/src/lib/safeConfigOverview.ts
git commit -m "feat(desktop): add safe config overview model"
```

## Task 2: Safe Config Overview Panel UI

**Files:**
- Create: `desktop/src/components/SafeConfigOverviewPanel.tsx`
- Modify: `desktop/src/App.tsx`
- Modify: `desktop/src/styles.css`

- [ ] **Step 1: Create the React panel**

Create `desktop/src/components/SafeConfigOverviewPanel.tsx` with:

```tsx
import { AlertTriangle, CheckCircle2, FileText, Info } from "lucide-react";
import { buildSafeConfigOverview, type SafeConfigOverviewInput, type SafeConfigNote } from "../lib/safeConfigOverview";

export function SafeConfigOverviewPanel(props: SafeConfigOverviewInput) {
  const overview = buildSafeConfigOverview(props);

  return (
    <section className="panel safe-config-panel">
      <div className="panel-heading">
        <span>Safe Config Overview</span>
        <strong>read-only</strong>
      </div>
      <div className="safe-config-grid">
        {overview.sections.map((section) => (
          <div className="safe-config-section" key={section.title}>
            <div className="safe-config-section-title">
              <FileText size={18} />
              <strong>{section.title}</strong>
            </div>
            <dl>
              {section.items.map((item) => (
                <div className={`safe-config-item ${item.tone ? `safe-config-${item.tone}` : ""}`} key={`${section.title}-${item.label}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div className="safe-config-notes">
        {overview.notes.map((note) => (
          <SafeConfigNoteCard note={note} key={note.title} />
        ))}
      </div>
    </section>
  );
}

function SafeConfigNoteCard({ note }: { note: SafeConfigNote }) {
  const Icon = note.tone === "ok" ? CheckCircle2 : note.tone === "critical" ? AlertTriangle : Info;
  return (
    <div className={`safe-config-note safe-config-note-${note.tone}`}>
      <Icon size={18} />
      <div>
        <strong>{note.title}</strong>
        <p>{note.detail}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire panel into App**

Modify `desktop/src/App.tsx` imports:

```ts
import { SafeConfigOverviewPanel } from "./components/SafeConfigOverviewPanel";
```

Place this JSX after `RuntimeSummaryPanel` and before `ActivityOverviewPanel`:

```tsx
<SafeConfigOverviewPanel
  settings={normalizedSettings}
  state={state}
  preflight={preflight}
  probe={probe}
/>
```

- [ ] **Step 3: Add CSS**

Add to `desktop/src/styles.css` near other panel-specific styles:

```css
.safe-config-panel { grid-column: span 2; }
.safe-config-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.safe-config-section { border: 1px solid var(--line); border-radius: 18px; padding: 14px; background: rgba(255,255,255,0.035); }
.safe-config-section-title { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.safe-config-section-title svg { color: var(--cyan); }
.safe-config-section dl { display: grid; gap: 8px; margin: 0; }
.safe-config-item { display: grid; gap: 3px; }
.safe-config-item dt { color: var(--text-muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
.safe-config-item dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #dff4ef; }
.safe-config-ok dd { color: var(--green); }
.safe-config-warning dd { color: var(--amber); }
.safe-config-critical dd { color: var(--red); }
.safe-config-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.safe-config-note { display: grid; grid-template-columns: auto 1fr; gap: 10px; border: 1px solid var(--line); border-radius: 16px; padding: 12px; background: rgba(255,255,255,0.035); }
.safe-config-note svg { margin-top: 2px; color: var(--cyan); }
.safe-config-note strong { display: block; margin-bottom: 4px; }
.safe-config-note p { margin: 0; color: var(--text-muted); line-height: 1.45; }
.safe-config-note-ok { border-color: rgba(125,255,157,0.28); }
.safe-config-note-ok svg { color: var(--green); }
.safe-config-note-warning { border-color: rgba(255,189,74,0.35); }
.safe-config-note-warning svg { color: var(--amber); }
.safe-config-note-critical { border-color: rgba(255,95,109,0.35); }
.safe-config-note-critical svg { color: var(--red); }
```

Extend the existing media query so `.safe-config-grid` and `.safe-config-notes` collapse to one column:

```css
@media (max-width: 1120px) { .app-shell { grid-template-columns: 1fr; } .sidebar { position: static; } .dashboard-grid { grid-template-columns: 1fr; } .activity-grid, .safe-config-grid, .safe-config-notes { grid-template-columns: 1fr; } body { min-width: 0; } }
```

- [ ] **Step 4: Run frontend checks**

Run:

```bash
npm --prefix desktop run typecheck
npm --prefix desktop run build
```

Expected: both commands PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add desktop/src/components/SafeConfigOverviewPanel.tsx desktop/src/App.tsx desktop/src/styles.css
git commit -m "feat(desktop): show safe config overview"
```

## Task 3: Documentation and Verification

**Files:**
- Modify: `desktop/README.md`

- [ ] **Step 1: Document the new panel**

Add this section to `desktop/README.md` after the Diagnostics Export Panel section:

```md
## Safe Config Overview Panel

The **Safe Config Overview** panel summarizes configuration facts that are safe for beginners to inspect.

It shows only file names, counts, booleans, and safe runtime facts from the current desktop state and `/statusz`. It does not parse or display full `config.yaml`, API keys, OAuth tokens, management passwords, auth files, request bodies, prompts, or responses.

The panel warns when the Base URL is not local-only, setup paths are missing, remote management is enabled, or request/file logging may require extra care before sharing logs.
```

- [ ] **Step 2: Run final verification**

Run:

```bash
npm --prefix desktop run typecheck
npm --prefix desktop run build
npm --prefix desktop run tauri:check
```

Expected: all commands PASS.

- [ ] **Step 3: Commit documentation**

Run:

```bash
git add desktop/README.md
git commit -m "docs(desktop): document safe config overview"
```

- [ ] **Step 4: Push all Stage 3.8 commits**

Run:

```bash
git push
git status --short
git log -3 --oneline
```

Expected: push succeeds and `git status --short` prints no tracked or untracked changes.

## Self-Review

- Spec coverage: the plan implements the safe read-only panel, data flow, missing data handling, and documentation boundary.
- Placeholder scan: no TBD/TODO/implement-later placeholders remain.
- Type consistency: `SafeConfigOverviewInput`, `SafeConfigSection`, `SafeConfigItem`, and `SafeConfigNote` are defined before component usage.
- Scope check: no backend or config parsing is included, matching the design boundary.
