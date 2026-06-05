use crate::sidecar::{
    get_settings, open_app_data_dir, open_management_page, reveal_binary_path, reveal_config_path,
    SidecarManager, SidecarStateSnapshot,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager,
};

const TRAY_ID: &str = "main-tray";

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let open_ui = MenuItem::with_id(app, "open_ui", "Open Management UI", true, None::<&str>)?;
    let open_app_data =
        MenuItem::with_id(app, "open_app_data", "Open App Data", true, None::<&str>)?;
    let open_config = MenuItem::with_id(app, "open_config", "Open Config Location", true, None::<&str>)?;
    let open_binary = MenuItem::with_id(app, "open_binary", "Open Binary Location", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start Sidecar", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop Sidecar", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart Sidecar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &open_ui,
            &open_app_data,
            &open_config,
            &open_binary,
            &start,
            &stop,
            &restart,
            &quit,
        ],
    )?;

    TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("cli_LH Cockpit: idle")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "open_ui" => {
                let _ = get_settings(app.clone())
                    .and_then(|settings| open_management_page(app.clone(), settings));
            }
            "open_app_data" => {
                let _ = open_app_data_dir(app.clone());
            }
            "open_config" => {
                let _ = get_settings(app.clone())
                    .and_then(|settings| reveal_config_path(app.clone(), settings));
            }
            "open_binary" => {
                let _ = get_settings(app.clone())
                    .and_then(|settings| reveal_binary_path(app.clone(), settings));
            }
            "start" => {
                let manager = app.state::<SidecarManager>();
                if !can_start(&manager) {
                    let _ = app.emit("sidecar://tray-action", "start:no-op");
                    return;
                }
                let _ = get_settings(app.clone()).and_then(|settings| {
                    let manager = app.state::<SidecarManager>();
                    manager.start(app, settings).map(|_| ())
                });
            }
            "stop" => {
                let manager = app.state::<SidecarManager>();
                if !can_stop(&manager) {
                    let _ = app.emit("sidecar://tray-action", "stop:no-op");
                    return;
                }
                let _ = manager.stop(app);
            }
            "restart" => {
                let manager = app.state::<SidecarManager>();
                if !can_restart(&manager) {
                    let _ = app.emit("sidecar://tray-action", "restart:no-op");
                    return;
                }
                let _ = get_settings(app.clone()).and_then(|settings| {
                    let manager = app.state::<SidecarManager>();
                    manager.restart(app, settings).map(|_| ())
                });
            }
            "quit" => {
                let manager = app.state::<SidecarManager>();
                let _ = manager.stop(app);
                app.exit(0);
            }
            action => {
                let _ = app.emit("sidecar://tray-action", action);
            }
        })
        .build(app)?;

    sync_tray_state(app.handle(), "idle");

    Ok(())
}

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

fn current_phase(manager: &SidecarManager) -> Option<String> {
    manager.current_state().ok().map(|state| state.phase)
}

fn can_start(manager: &SidecarManager) -> bool {
    matches!(
        current_phase(manager).as_deref(),
        Some("idle" | "stopped" | "error") | None
    )
}

fn can_stop(manager: &SidecarManager) -> bool {
    matches!(
        current_phase(manager).as_deref(),
        Some("starting" | "ready")
    )
}

fn can_restart(manager: &SidecarManager) -> bool {
    matches!(
        current_phase(manager).as_deref(),
        Some("starting" | "ready" | "error" | "stopped" | "idle") | None
    )
}
