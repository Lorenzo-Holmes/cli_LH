use crate::sidecar::{get_settings, restart_sidecar, start_sidecar, stop_sidecar, SidecarManager};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager,
};

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start Sidecar", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop Sidecar", true, None::<&str>)?;
    let restart = MenuItem::with_id(app, "restart", "Restart Sidecar", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &start, &stop, &restart, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
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
            "start" => {
                let _ = get_settings(app.clone()).and_then(|settings| {
                    let manager = app.state::<SidecarManager>();
                    start_sidecar(app.clone(), manager, settings).map(|_| ())
                });
            }
            "stop" => {
                let manager = app.state::<SidecarManager>();
                let _ = stop_sidecar(app.clone(), manager);
            }
            "restart" => {
                let _ = get_settings(app.clone()).and_then(|settings| {
                    let manager = app.state::<SidecarManager>();
                    restart_sidecar(app.clone(), manager, settings).map(|_| ())
                });
            }
            "quit" => {
                let manager = app.state::<SidecarManager>();
                let _ = stop_sidecar(app.clone(), manager);
                app.exit(0);
            }
            action => {
                let _ = app.emit("sidecar://tray-action", action);
            }
        })
        .build(app)?;

    Ok(())
}
