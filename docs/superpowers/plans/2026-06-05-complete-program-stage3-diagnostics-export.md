# Stage 3.7 Diagnostics Export Plan

## Goal

Add a safe diagnostics export panel to the desktop cockpit. The exported report should help beginners or maintainers understand the current desktop/sidecar state without leaking credentials or private model traffic.

## Why This Stage Exists

A complete desktop program needs a support handoff. When something fails, a beginner should be able to export one report instead of guessing which screenshots or logs matter. The report must be useful, but it must also avoid secrets by design.

## Chosen Approach

Use a dedicated diagnostics report builder plus a small React panel:

- `desktop/src/lib/diagnosticsExport.ts` builds a Markdown report from existing in-memory state.
- `desktop/src/components/DiagnosticsExportPanel.tsx` explains what will be exported and provides one button.
- `desktop/src/lib/sidecar.ts` exposes a generic `exportTextFile` bridge.
- `desktop/src-tauri/src/sidecar.rs` writes the report into the app log directory with a sanitized file name.
- `desktop/src/App.tsx` wires the panel to existing settings, sidecar state, preflight, probe, and visible logs.

The report includes only safe summaries: Base URL without credentials, file names rather than full paths, native process phase, preflight messages, probe result, safe `/statusz` counts/booleans, and redacted recent visible process lines.

## Alternatives and Trade-Offs

### Option A: Reuse `exportLogs` by converting the report into log lines

Pros:
- Smallest code change.
- No Rust command changes.

Cons:
- Semantically awkward.
- Harder to reuse for future report exports.
- Log formatting is not ideal for Markdown.

### Option B: Add generic safe text export

Pros:
- Clean desktop API for diagnostics and future text reports.
- Keeps log export and report export separate.
- Allows Markdown output.
- Filename is sanitized in native code.

Cons:
- Requires one additional Tauri command.
- Needs Rust and frontend validation.

### Option C: Copy report to clipboard only

Pros:
- Very simple.
- No native file write.

Cons:
- Less useful for support handoff.
- Large reports are awkward to paste.
- Clipboard may expose content to other apps.

Chosen: Option B.

## Self-Review

- The report does not read `config.yaml`, auth files, OAuth files, or request logs from disk.
- The report uses file names instead of full configured paths.
- Recent visible process lines are capped and sensitive-looking lines are redacted.
- The report explicitly documents its privacy boundary.
- The native filename is sanitized before writing to the app log directory.
- The feature complements the Troubleshooting panel: troubleshooting explains what to check; diagnostics export packages the current safe evidence.
