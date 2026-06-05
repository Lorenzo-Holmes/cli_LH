# Complete Program Stage 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Stage 1 foundation for a complete beginner-friendly desktop program by tightening the existing desktop cockpit loop and documenting exactly how to verify it.

**Architecture:** Keep Stage 1 centered in `desktop/`. React renders setup, controls, diagnostics, logs, and profiles. Tauri/Rust owns native process lifecycle, preflight validation, tray actions, file reveals, and app-data operations. The Go server remains the independent sidecar and is only verified through existing build and health/status contracts.

**Tech Stack:** Go 1.26+, React 18, TypeScript, Vite, Tauri 2, Rust/Cargo, Windows PowerShell.

---

## Current Baseline

The repository already contains most of the earlier desktop next-stage work:

- `desktop/src-tauri/src/sidecar.rs` already has sidecar state metadata, preflight validation, available-port recommendation, profile persistence, native reveal/open commands, and an exit watcher.
- `desktop/src-tauri/src/lib.rs` already registers the desktop commands.
- `desktop/src-tauri/src/tray.rs` already exposes tray actions for show, open management UI, open app data, start, stop, restart, and quit.
- `desktop/src/lib/sidecar.ts` already has typed wrappers for settings, profiles, preflight, logs, and native utility commands.
- `desktop/src/App.tsx` already wires setup wizard, control panel, status panel, config panel, profile panel, preflight panel, and log panel.
- `desktop/PACKAGING.md` already documents Windows packaging and local installer validation.

The first implementation pass should therefore be a focused hardening pass, not a rewrite.

## File Structure

- Modify `desktop/src-tauri/src/sidecar.rs`: add unit tests for pure preflight URL/port helpers and fix only behavior proven by those tests.
- Modify `desktop/src-tauri/src/tray.rs`: make tray tooltip include the state message when available and add native reveal actions for config and binary paths.
- Modify `desktop/src-tauri/src/lib.rs`: register any new tray-driven command helpers only if needed.
- Modify `desktop/src/lib/sidecar.ts`: add browser-preview fallback logs for tray-action events so tray no-ops are visible in UI logs.
- Modify `desktop/src/App.tsx`: subscribe to tray-action events as system logs if not already covered.
- Modify `desktop/src/components/ControlPanel.tsx`: keep beginner recovery guidance visible and verify it maps to state messages.
- Modify `desktop/README.md`: add a beginner “what each layer does” section and link the full roadmap spec.
- Modify `docs/superpowers/specs/2026-06-05-complete-program-roadmap-design.md` only if implementation discovers a contradiction.

---

### Task 1: Add Rust Unit Tests for Preflight URL and Port Helpers

**Files:**
- Modify: `desktop/src-tauri/src/sidecar.rs`

- [ ] **Step 1: Add focused tests at the bottom of `desktop/src-tauri/src/sidecar.rs`**

Append this test module after `now_string()`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_base_url_host_port_accepts_ipv4_localhost() {
        let (host, port) = parse_base_url_host_port("http://127.0.0.1:8317").expect("parse base url");

        assert_eq!(host, "127.0.0.1");
        assert_eq!(port, 8317);
    }

    #[test]
    fn parse_base_url_host_port_accepts_ipv6_brackets() {
        let (host, port) = parse_base_url_host_port("http://[::1]:8317").expect("parse ipv6 base url");

        assert_eq!(host, "::1");
        assert_eq!(port, 8317);
    }

    #[test]
    fn parse_base_url_host_port_rejects_missing_port() {
        let err = parse_base_url_host_port("http://127.0.0.1").expect_err("missing port should fail");

        assert_eq!(err, "Base URL must include an explicit port");
    }

    #[test]
    fn replace_base_url_port_preserves_scheme_host_and_path() {
        let updated = replace_base_url_port("http://127.0.0.1:8317/custom", 8320).expect("replace port");

        assert_eq!(updated, "http://127.0.0.1:8320/custom");
    }

    #[test]
    fn build_preflight_report_blocks_missing_binary_and_config() {
        let report = build_preflight_report(DesktopSettings {
            binary_path: String::new(),
            config_path: String::new(),
            base_url: "http://127.0.0.1:8317".to_string(),
            local_model: false,
            auto_start: false,
        });

        assert!(!report.can_start);
        assert!(report.checks.iter().any(|check| check.id == "binaryPath" && check.severity == "error"));
        assert!(report.checks.iter().any(|check| check.id == "configPath" && check.severity == "error"));
    }
}
```

- [ ] **Step 2: Run the new Rust tests and verify they compile/fail only if behavior is wrong**

Run from repository root:

```text
cargo test --manifest-path desktop/src-tauri/Cargo.toml sidecar::tests
```

Expected if current behavior is correct: all listed tests pass.

If a test fails, fix only the helper behavior that the failing test describes, then rerun the same command.

- [ ] **Step 3: Run desktop native check**

Run:

```text
npm --prefix desktop run tauri:check
```

Expected: command exits 0.

- [ ] **Step 4: Commit Task 1**

Run:

```text
git add desktop/src-tauri/src/sidecar.rs
git commit -m "test(desktop): cover launch preflight helpers"
```

---

### Task 2: Make Tray Actions More Useful Without Opening the Window

**Files:**
- Modify: `desktop/src-tauri/src/tray.rs`
- Modify: `desktop/src-tauri/src/sidecar.rs` only if command visibility requires a small helper

- [ ] **Step 1: Extend imports in `desktop/src-tauri/src/tray.rs`**

Change the first import line from:

```rust
use crate::sidecar::{get_settings, open_app_data_dir, open_management_page, SidecarManager};
```

to:

```rust
use crate::sidecar::{
    get_settings, open_app_data_dir, open_management_page, reveal_binary_path, reveal_config_path,
    SidecarManager, SidecarStateSnapshot,
};
```

- [ ] **Step 2: Add tray menu items for opening selected paths**

In `setup_tray`, after `open_app_data`, add:

```rust
    let open_config = MenuItem::with_id(app, "open_config", "Open Config Location", true, None::<&str>)?;
    let open_binary = MenuItem::with_id(app, "open_binary", "Open Binary Location", true, None::<&str>)?;
```

Then include `&open_config` and `&open_binary` in the menu item array after `&open_app_data`.

- [ ] **Step 3: Handle the new tray actions**

In the `on_menu_event` match, after the `open_app_data` branch, add:

```rust
            "open_config" => {
                let _ = get_settings(app.clone())
                    .and_then(|settings| reveal_config_path(app.clone(), settings));
            }
            "open_binary" => {
                let _ = get_settings(app.clone())
                    .and_then(|settings| reveal_binary_path(app.clone(), settings));
            }
```

- [ ] **Step 4: Include state messages in tray tooltip**

Replace `sync_tray_state` with:

```rust
pub fn sync_tray_state(app: &AppHandle, phase: &str) {
    let tooltip = app
        .state::<SidecarManager>()
        .current_state()
        .ok()
        .map(|state| tooltip_for_state(&state))
        .unwrap_or_else(|| format!("cli_LH Cockpit: {phase}"));

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_tooltip(Some(&tooltip));
    }
}

fn tooltip_for_state(state: &SidecarStateSnapshot) -> String {
    match state.message.as_deref() {
        Some(message) if !message.trim().is_empty() => {
            format!("cli_LH Cockpit: {} - {}", state.phase, message)
        }
        _ => format!("cli_LH Cockpit: {}", state.phase),
    }
}
```

- [ ] **Step 5: Run verification**

Run:

```text
cargo check --manifest-path desktop/src-tauri/Cargo.toml
npm --prefix desktop run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit Task 2**

Run:

```text
git add desktop/src-tauri/src/tray.rs
git commit -m "feat(desktop): expand tray recovery actions"
```

---

### Task 3: Surface Tray No-Op Actions in the Log Stream

**Files:**
- Modify: `desktop/src/lib/sidecar.ts`

- [ ] **Step 1: Extend `subscribeSidecarEvents` to listen for tray no-op events**

In `desktop/src/lib/sidecar.ts`, inside `subscribeSidecarEvents`, after `unlistenError`, add:

```ts
  const unlistenTrayAction = await listen<string>("sidecar://tray-action", (event) => {
    handlers.onLog({
      source: "system",
      message: `Tray action ignored: ${event.payload}`,
      timestamp: new Date().toISOString(),
    });
  });
```

Then change the return line from:

```ts
  return [unlistenState, unlistenStdout, unlistenStderr, unlistenError];
```

to:

```ts
  return [unlistenState, unlistenStdout, unlistenStderr, unlistenError, unlistenTrayAction];
```

- [ ] **Step 2: Run TypeScript verification**

Run:

```text
npm --prefix desktop run typecheck
```

Expected: command exits 0.

- [ ] **Step 3: Commit Task 3**

Run:

```text
git add desktop/src/lib/sidecar.ts
git commit -m "feat(desktop): log ignored tray actions"
```

---

### Task 4: Improve Beginner Documentation for the Complete Program

**Files:**
- Modify: `desktop/README.md`

- [ ] **Step 1: Add a beginner mental model section after the opening paragraph**

Insert after `Packaging and release guidance is documented in [`PACKAGING.md`](./PACKAGING.md).`:

```markdown

## Beginner Mental Model

The desktop app is split into three simple parts:

- **React UI** is what the user sees: setup, buttons, status cards, logs, and diagnostics.
- **Tauri/Rust backend** performs local desktop actions: save settings, start or stop the sidecar process, update the tray menu, and reveal files.
- **Go cli_LH sidecar** is the proxy engine. It serves `/healthz`, `/statusz`, and the compatible model APIs.

This separation keeps the proxy usable from the command line while still allowing a beginner-friendly desktop program.

The complete product roadmap is documented in [`../docs/superpowers/specs/2026-06-05-complete-program-roadmap-design.md`](../docs/superpowers/specs/2026-06-05-complete-program-roadmap-design.md).
```

- [ ] **Step 2: Add a Stage 1 checklist section before `## Verification`**

Insert:

```markdown

## Stage 1 Desktop Loop

The first complete-program milestone is the local desktop loop:

1. Configure the `cli_LH` binary and `config.yaml`.
2. Run preflight checks before launch.
3. Start, stop, and restart the sidecar.
4. Probe `/healthz` and `/statusz`.
5. Show beginner-friendly recovery suggestions.
6. Keep useful tray actions available when the window is hidden.
7. Export or inspect logs when troubleshooting.

This milestone matters because users must be able to run and repair the program before advanced dashboard features are useful.
```

- [ ] **Step 3: Run documentation sanity check**

Run:

```text
git diff -- desktop/README.md
```

Expected: only the beginner mental model and Stage 1 checklist were added.

- [ ] **Step 4: Commit Task 4**

Run:

```text
git add desktop/README.md
git commit -m "docs(desktop): explain complete program desktop loop"
```

---

### Task 5: Run Full Stage 1 Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run Go formatting check by formatting the workspace if Go changed**

If no Go files changed, skip this step and record “No Go changes.”

If Go files changed, run:

```text
gofmt -w .
```

- [ ] **Step 2: Run Go compile verification**

Run from repository root:

```text
go build -o test-output ./cmd/server
```

Then remove the temporary binary:

```text
Remove-Item test-output
```

Expected: build exits 0 and `test-output` is removed.

- [ ] **Step 3: Run desktop TypeScript verification**

Run:

```text
npm --prefix desktop run typecheck
```

Expected: command exits 0.

- [ ] **Step 4: Run desktop production build**

Run:

```text
npm --prefix desktop run build
```

Expected: Vite build exits 0 and writes `desktop/dist`.

- [ ] **Step 5: Run Tauri native verification**

Run:

```text
npm --prefix desktop run tauri:check
```

Expected: command exits 0 when Rust/Cargo are installed.

If the environment reports missing Rust/Cargo, stop and ask the user whether to install prerequisites or rely on CI.

- [ ] **Step 6: Commit only if verification created intentional documentation updates**

Run:

```text
git status --porcelain=v1
```

Expected: no uncommitted source changes.

If `desktop/dist` appears as ignored or generated output, do not commit it unless the repository already tracks it.

---

## Plan Self-Review

### Spec Coverage

- Stage 1 process loop: covered by Tasks 1-3 and full verification.
- Beginner-understandable documentation: covered by Task 4.
- Go independence: preserved because no Go production change is planned in Stage 1 foundation.
- Testing and verification: covered by Tasks 1 and 5.
- Tray usefulness: covered by Task 2 and Task 3.

### Trade-Offs

#### Advantages

- Starts from the existing working desktop foundation instead of rewriting it.
- Adds tests around risky helper logic before changing behavior.
- Keeps beginner-facing docs close to the desktop app.
- Produces small commits that can be reviewed separately.

#### Disadvantages

- It does not yet add a rich dashboard panel; that belongs to Stage 3.
- It depends on local Rust/Cargo for native verification.
- It improves the Stage 1 foundation but does not replace manual UI smoke testing.

### Recommendation

Execute this plan inline in the current workspace because subagent execution failed due to quota limits. Keep each task small and verify after each one.