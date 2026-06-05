# Stage 3.5 Activity Overview Plan

## Goal

Add a safe, read-only activity overview to the desktop cockpit so beginners can understand whether the local sidecar is active and which activity-related capabilities are enabled.

## Why This Stage Exists

A complete program should not only start a service; it should also explain what the service is doing at a safe level. Beginners need simple signals such as “ready,” “last probe,” “usage statistics enabled,” and “request logging enabled” before they inspect detailed logs or configuration.

## Safety Boundary

This stage uses only existing safe data:

- native sidecar phase from Tauri state,
- last local probe time and latency,
- `/statusz` management booleans.

It must not read or show:

- request bodies,
- prompts,
- response text,
- API keys,
- OAuth tokens,
- auth JSON files,
- full `config.yaml`.

## Chosen Approach

Implement a React-only read-only panel:

- `desktop/src/lib/activityOverview.ts` converts existing state/probe data into display items.
- `desktop/src/components/ActivityOverviewPanel.tsx` renders cards for process phase, last probe, usage statistics, request logging, and file logging.
- `desktop/src/App.tsx` places the panel near runtime/API guide panels.
- `desktop/src/styles.css` styles the activity cards.
- `desktop/README.md` explains the safe boundary.

## Alternatives Considered

### Option A: Add a backend request activity API

Pros:
- Could show real counts and recent request timing.

Cons:
- Needs new Go storage or aggregation behavior.
- Higher privacy risk if designed too broadly.
- Too large for this beginner-facing increment.

### Option B: Read management usage queue directly

Pros:
- Reuses an existing management area if configured.

Cons:
- Requires management auth and may consume queue data.
- Not suitable as a passive dashboard panel.
- Riskier than a safe overview.

### Option C: Use existing status/probe signals only

Pros:
- No new backend API.
- No secrets or request content involved.
- Easy to explain and verify.
- Fits the current dashboard style.

Cons:
- Does not show real request counts yet.
- Depends on `/statusz` capability booleans, not detailed activity history.

Chosen: Option C.

## Self-Review

- The panel displays only safe state and booleans.
- It does not fetch new endpoints.
- It does not persist any data.
- It teaches beginners what the signals mean without overpromising full analytics.
