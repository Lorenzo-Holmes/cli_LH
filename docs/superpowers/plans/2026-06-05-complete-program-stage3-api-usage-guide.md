# Stage 3.4 API Usage Guide Plan

## Goal

Add a beginner-friendly desktop panel that explains how to use the running `cli_LH` sidecar from compatible client tools.

## Why This Stage Exists

After the desktop app can start and probe the sidecar, a beginner still needs one more bridge: “What URL do I paste into my client?” This panel turns the configured Base URL into a few safe, copyable endpoint examples.

## Chosen Approach

Implement a read-only React panel under `desktop/` only.

- `desktop/src/lib/apiUsageGuide.ts` builds endpoint metadata from the launch settings and probe state.
- `desktop/src/components/ApiUsageGuidePanel.tsx` renders the Base URL, common compatible endpoint URLs, and copy buttons.
- `desktop/src/App.tsx` wires the panel into the existing dashboard.
- `desktop/src/styles.css` adds focused panel styling.
- `desktop/README.md` explains the purpose for beginners.

## Alternatives Considered

### Option A: Static documentation only

Pros:
- No UI code required.
- Lowest implementation risk.

Cons:
- Users must leave the cockpit to find usage information.
- The examples can drift from the currently configured Base URL.

### Option B: Full SDK example generator

Pros:
- Could generate curl, JavaScript, Python, and tool-specific snippets.

Cons:
- More surface area to maintain.
- Risks implying one API key pattern works for every user.
- Too much detail for the first beginner bridge.

### Option C: Read-only in-app guide with copyable URLs

Pros:
- Keeps the guide close to the current sidecar state.
- Does not expose or store secrets.
- Simple enough for beginners.
- Small, testable change.

Cons:
- Still does not teach every SDK.
- Clipboard copying may be unavailable in some browser preview contexts.

Chosen: Option C.

## Self-Review

- No secrets are read or displayed.
- The panel derives URLs from existing normalized settings.
- It does not introduce new backend APIs.
- It keeps the scope to “what URL should I use next,” not full client onboarding.
