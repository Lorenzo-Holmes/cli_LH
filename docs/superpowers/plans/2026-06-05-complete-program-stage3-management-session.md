# Desktop Management Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a beginner-safe desktop management session panel that lets users verify a management key and view a small read-only operational summary.

**Architecture:** Keep the management key only in React memory. Probe authenticated endpoints with `Authorization: Bearer <key>` and display only safe scalar results from selected read-only endpoints plus already-safe `/statusz` metadata. Do not fetch `/v0/management/config`, `/config.yaml`, API-key endpoints, or OAuth/auth files.

**Tech Stack:** React 18, TypeScript, Vite, Tauri 2, existing Go management API.

---

## Self-check and option review

### Recommended option: in-memory login plus safe read-only endpoints

**Pros**
- Keeps secrets out of disk storage.
- Uses existing authenticated routes without backend changes.
- Gives beginners a clear concept: management is locked until a key is supplied.
- Low risk because it avoids full config and credential endpoints.

**Cons**
- The user must re-enter the key after app refresh/restart.
- Only shows a small subset of management data.
- Cannot edit config yet.

### Alternative A: store the management key in desktop settings

**Pros**
- More convenient.

**Cons**
- Higher security risk.
- Requires OS credential-store decisions.
- Too early for beginner-focused read-only dashboard.

### Alternative B: add a new backend summary endpoint

**Pros**
- Cleaner API shape.

**Cons**
- Requires Go changes and tests.
- Duplicates data already available from safe endpoints.
- Not needed for this incremental stage.

## Files

- Create: `desktop/src/lib/management.ts`
  - Authenticated fetch helper and safe summary loader.
- Create: `desktop/src/components/ManagementSessionPanel.tsx`
  - In-memory key input, verify/logout/refresh, and read-only summary cards.
- Modify: `desktop/src/App.tsx`
  - Hold management key/session state in memory and render the panel.
- Modify: `desktop/src/styles.css`
  - Add management session styles.
- Modify: `desktop/README.md`
  - Explain management session safety model.

## Tasks

### Task 1: Add management client helper

- [ ] Create `desktop/src/lib/management.ts` with:
  - `ManagementSessionState`
  - `ManagementSummary`
  - `loadManagementSummary(baseUrl, key)`
  - `clearManagementSession()`
- [ ] Only call:
  - `/v0/management/debug`
  - `/v0/management/logging-to-file`
  - `/v0/management/usage-statistics-enabled`
  - `/v0/management/ws-auth`
  - `/v0/management/proxy-url`
- [ ] Do not call sensitive endpoints.

### Task 2: Add management session panel

- [ ] Create `desktop/src/components/ManagementSessionPanel.tsx`.
- [ ] Use a password input for the key.
- [ ] Store key only through callbacks from `App.tsx`.
- [ ] Display auth status, safe fields, errors, and beginner explanation.

### Task 3: Wire into the dashboard

- [ ] Add memory-only state in `App.tsx`.
- [ ] Render the panel after `ManagementSummaryPanel`.
- [ ] Refresh data only when the user clicks verify/refresh.
- [ ] Clear the key and summary on logout.

### Task 4: Documentation

- [ ] Update `desktop/README.md` with:
  - key is memory-only,
  - no config/API key/OAuth secrets are fetched,
  - read-only summary is for learning before editing.

### Task 5: Verification and commit

- [ ] Run `npm --prefix desktop run typecheck`.
- [ ] Run `npm --prefix desktop run build`.
- [ ] Run `npm --prefix desktop run tauri:check`.
- [ ] Run `go test ./...`.
- [ ] Run `go build -o test-output ./cmd/server; if (Test-Path test-output) { Remove-Item test-output }`.
- [ ] Check `git status --short`.
- [ ] Commit as `feat(desktop): add management session panel`.
