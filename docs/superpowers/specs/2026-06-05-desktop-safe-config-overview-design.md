# Desktop Safe Config Overview Design

## Goal

Add a beginner-friendly, read-only **Safe Config Overview** panel to `cli_LH Cockpit`.

The panel should answer: “What safe configuration facts can I understand at a glance?” It must not expose API keys, OAuth tokens, management passwords, auth files, request bodies, prompts, responses, or full `config.yaml` contents.

## Scope

The first version uses only information that is already available in desktop state or safe `/statusz` payloads:

- configured Base URL, normalized and shown without URL credentials,
- binary/config path presence, shown as file names only,
- local model and auto-start flags,
- sidecar-reported server host/port when available,
- sidecar-reported runtime flags,
- provider counts from `/statusz`,
- management capability booleans from `/statusz`,
- a short list of safety notes and warnings.

The panel does not parse `config.yaml`. It does not read `auths/`. It does not display full local paths.

## Architecture

Add two small frontend units:

- `desktop/src/lib/safeConfigOverview.ts`
  - Converts `DesktopSettings`, `SidecarState`, `PreflightReport`, and `ProbeResult` into safe view-model cards.
  - Centralizes sanitization for Base URL and file-name-only path display.
  - Computes safety notes such as “Base URL is not localhost” or “Management remote access is enabled.”

- `desktop/src/components/SafeConfigOverviewPanel.tsx`
  - Renders launch profile, runtime, providers, management, and safety notes.
  - Uses existing dashboard card styling patterns.

`desktop/src/App.tsx` places the panel near runtime/provider/management summaries so users can compare safe configuration facts with live status.

## Data Flow

```text
React App state
  settings + sidecar state + preflight + probe
        |
        v
safeConfigOverview view-model builder
        |
        v
SafeConfigOverviewPanel
```

The panel never performs native file reads and never calls management endpoints directly.

## Error Handling

Missing data should be rendered as “Unavailable” or “Not checked” instead of failing. If `/statusz` is unavailable, the panel still shows local launch settings and explains that live sidecar facts are unavailable until the sidecar responds.

## Testing and Verification

- TypeScript typecheck must pass.
- Frontend build must pass.
- Tauri check must pass because `App.tsx` changes are part of desktop integration.
- Go tests/build are not required for this stage unless backend files change.

## Self-Review

- No placeholders remain.
- The design is intentionally read-only.
- The first version avoids parsing `config.yaml`, reducing secret-leak risk.
- The scope is small enough for one implementation plan.
- The safety boundary is explicit and consistent with Stage 3 diagnostics export.
