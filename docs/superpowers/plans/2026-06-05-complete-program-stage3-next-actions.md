# Stage 3.2 Next Actions Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beginner-friendly “Next Actions” panel that tells users what to do next based on current desktop settings, preflight checks, sidecar phase, and safe `/statusz` probe results.

**Architecture:** Keep the feature frontend-only and read-only. Add a small pure helper that turns existing app state into human-readable action cards, then render those cards in a new React panel. The panel does not call authenticated management endpoints, does not edit config, and does not show secrets.

**Tech Stack:** React 18, TypeScript, Vite, existing Tauri desktop app, existing `ProbeResult`, `PreflightReport`, `SidecarState`, and `DesktopSettings` types.

---

## Recommended Approach

Use existing data already available in `App.tsx`:

- `settings`: whether binary/config/base URL are present.
- `preflight`: whether launch checks say the sidecar can start.
- `state`: whether the sidecar is idle, starting, ready, stopped, or error.
- `probe`: whether `/healthz` and `/statusz` are responding.

The panel should produce simple guidance such as:

1. Missing binary/config path → open Setup Wizard.
2. Preflight errors → inspect Preflight panel.
3. Sidecar stopped but startable → click Start.
4. Sidecar ready and management available → open Management UI.
5. Sidecar ready but management locked → dashboard is usable, advanced management needs key/password.
6. Probe error → verify base URL or check logs.

## Alternatives Considered

### Option A: Frontend-only rule panel — recommended

**Pros:** safest, fast, no backend risk, beginner-friendly, easy to verify.

**Cons:** does not diagnose deep backend internals.

### Option B: Add a backend diagnostic endpoint

**Pros:** could provide richer diagnosis later.

**Cons:** more API surface, more tests, more security review; unnecessary for the first beginner guide.

### Option C: Add an interactive repair wizard

**Pros:** most helpful long-term.

**Cons:** higher risk because it changes settings and can affect launch behavior; should wait until guidance is proven useful.

## Design Decision

Implement Option A now. It advances the complete-program goal without increasing security or configuration risk.

## Files

- Create `desktop/src/lib/nextActions.ts`
  - Pure rule helper and exported types.
- Create `desktop/src/components/NextActionsPanel.tsx`
  - Visual action cards with short explanations.
- Modify `desktop/src/App.tsx`
  - Render `NextActionsPanel` near the top and wire existing callbacks.
- Modify `desktop/src/styles.css`
  - Add next-action card styles.
- Modify `desktop/README.md`
  - Explain the beginner guidance panel.

## Implementation Tasks

### Task 1: Add pure next-action rules

Create `desktop/src/lib/nextActions.ts` with a pure `buildNextActions()` function.

The helper should return a prioritized list of action cards and should not import React.

### Task 2: Add the React panel

Create `desktop/src/components/NextActionsPanel.tsx`.

The panel should receive the existing state objects and callbacks from `App.tsx`, call `buildNextActions()`, and render up to three action cards.

### Task 3: Wire into the dashboard

Modify `desktop/src/App.tsx` to render the panel immediately after `ControlPanel`. This makes the beginner flow visible before advanced details.

### Task 4: Style and document

Modify `desktop/src/styles.css` and `desktop/README.md`.

### Task 5: Verify and commit

Run:

```text
npm --prefix desktop run typecheck
npm --prefix desktop run build
npm --prefix desktop run tauri:check
go test ./...
go build -o test-output ./cmd/server
```

Then remove `test-output`, check `git status --short`, and commit.

## Self-Review

- No secrets are displayed.
- No authenticated endpoints are called.
- No settings are changed automatically.
- No new dependency or test framework is introduced.
- The feature teaches beginners why each next step matters.
