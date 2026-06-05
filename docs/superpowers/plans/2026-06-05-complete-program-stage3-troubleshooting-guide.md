# Stage 3.6 Troubleshooting Guide Plan

## Goal

Add a beginner-friendly troubleshooting panel to the desktop cockpit. The panel should teach users what to check first when the sidecar cannot start, probes fail, or management is unavailable.

## Why This Stage Exists

A complete desktop program needs an obvious recovery path. Beginners should not have to read source code or guess which log line matters. They need a short, ordered checklist that explains the symptom, the check, and the safest first fix.

## Chosen Approach

Use a static plus state-aware React panel:

- `desktop/src/lib/troubleshooting.ts` builds a small ordered guide from existing desktop state.
- `desktop/src/components/TroubleshootingGuidePanel.tsx` renders cards for setup paths, preflight, port/Base URL, process state, and management access.
- `desktop/src/App.tsx` places it near the Next Actions guide.
- `desktop/src/styles.css` adds the visual treatment.
- `desktop/README.md` explains the beginner workflow.

The panel does not perform automatic fixes. It points users to existing safe actions such as setup wizard, preflight recheck, status probe, and log export.

## Alternatives and Trade-Offs

### Option A: README-only troubleshooting

Pros:
- Very low implementation cost.
- No UI risk.

Cons:
- Users must leave the app to find help.
- Does not react to current app state.

### Option B: State-aware guide cards

Pros:
- Visible inside the app.
- Uses current state to highlight likely problems.
- Safe and beginner-friendly.
- Reuses existing setup/probe/preflight/log concepts.

Cons:
- Does not automatically repair problems.
- Still relies on users reading and following steps.

### Option C: One-click automatic repair flow

Pros:
- Fastest path for experienced users if correct.

Cons:
- Risky for beginners because it may change settings too quickly.
- Needs stronger validation and rollback.
- Too large for this stage.

Chosen: Option B.

## Self-Review

- The guide reads only existing safe state, preflight, probe, and management booleans.
- It does not read secrets, config contents, auth files, OAuth files, request bodies, or prompts.
- It does not mutate settings by itself.
- It keeps troubleshooting ordered: setup paths, preflight, port, process, management.
- It complements, rather than duplicates, the Next Actions panel.
