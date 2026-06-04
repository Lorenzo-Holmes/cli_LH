# cli_LH Desktop Cockpit

First-party reference desktop shell for controlling a local `cli_LH` sidecar.

## Responsibilities

- React renders the control cockpit.
- Tauri/Rust owns native process lifecycle and tray controls.
- `cli_LH` remains the Go proxy core and is launched through `--config <path>`.

## Current Environment

Frontend verification requires Node.js and npm:

```text
npm install
npm run typecheck
npm run build
```

Full Tauri verification additionally requires Rust and Cargo on PATH:

```text
npm run tauri dev
npm run tauri build
```

If `rustc` and `cargo` are not available, the frontend build can still be verified.
