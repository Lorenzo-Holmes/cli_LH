# Desktop Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add practical polish to the `desktop/` reference shell: Tauri verification scripts/docs, file chooser controls, launch profile auto-discovery, and tray state synchronization.

**Architecture:** Keep all changes isolated under `desktop/`. React owns form interactions and invokes Tauri commands. Rust owns native filesystem discovery, file dialogs, process lifecycle, and tray state updates.

**Tech Stack:** React 18, TypeScript, Vite, Tauri 2, Rust, npm.

---

## File Structure

- Modify `desktop/package.json`: add `tauri:check` script.
- Modify `desktop/README.md`: document Rust/Cargo installation and `tauri:check` verification.
- Modify `desktop/src/lib/sidecar.ts`: add wrappers for selecting binary/config and discovering defaults.
- Modify `desktop/src/components/ConfigPanel.tsx`: add Browse and Auto-detect controls.
- Modify `desktop/src/App.tsx`: wire selection/discovery actions.
- Modify `desktop/src/styles.css`: style grouped field actions.
- Modify `desktop/src-tauri/src/sidecar.rs`: add native commands for file dialogs and default launch profile discovery.
- Modify `desktop/src-tauri/src/lib.rs`: register new commands.
- Modify `desktop/src-tauri/src/tray.rs`: keep tray menu enabled/disabled state and tooltip synchronized with sidecar phase.

---

### Task 1: Add Verification Script and Docs

- [ ] Add `tauri:check` to `desktop/package.json` as `tauri info && cd src-tauri && cargo check`.
- [ ] Update `desktop/README.md` with Windows Rust installation command and the `npm run tauri:check` workflow.
- [ ] Run `npm --prefix desktop run typecheck`.
- [ ] Commit docs/script changes.

### Task 2: Add Native Profile Helpers

- [ ] Add Tauri commands in `desktop/src-tauri/src/sidecar.rs`:
  - `select_binary_path(app)` opens a file picker for executables.
  - `select_config_path(app)` opens a file picker for YAML config files.
  - `discover_launch_profile(app)` checks likely repository-local paths for binary/config defaults.
- [ ] Register the commands in `desktop/src-tauri/src/lib.rs`.
- [ ] Add TypeScript wrappers in `desktop/src/lib/sidecar.ts` with browser fallbacks.
- [ ] Run frontend typecheck.
- [ ] Commit native helper changes.

### Task 3: Add Config Panel Controls

- [ ] Add Browse buttons beside binary/config fields in `ConfigPanel.tsx`.
- [ ] Add Auto-detect button to populate detected paths without overwriting unrelated settings.
- [ ] Wire actions in `App.tsx`.
- [ ] Update CSS for field/action layout.
- [ ] Run frontend build.
- [ ] Commit UI changes.

### Task 4: Synchronize Tray State

- [ ] Update `tray.rs` to keep menu items and tooltip in a managed `TrayController`.
- [ ] Call tray synchronization whenever `SidecarManager` changes state.
- [ ] Keep show/start/stop/restart/quit actions unchanged.
- [ ] Run available verification.
- [ ] Commit tray synchronization.

### Task 5: Final Verification and Push

- [ ] Run `npm --prefix desktop run typecheck`.
- [ ] Run `npm --prefix desktop run build`.
- [ ] Run `go test ./...`.
- [ ] Run `go build -o test-output ./cmd/server`, then remove `test-output`.
- [ ] Check `rustc --version` and `cargo --version`; run `npm --prefix desktop run tauri:check` only if available.
- [ ] Push `main`.
