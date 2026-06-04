mod sidecar;
mod tray;

use sidecar::{
    clear_logs, discover_launch_profile, get_settings, get_sidecar_state, restart_sidecar,
    save_settings, start_sidecar, stop_sidecar, SidecarManager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SidecarManager::new())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_sidecar_state,
            start_sidecar,
            stop_sidecar,
            restart_sidecar,
            clear_logs,
            discover_launch_profile
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running cli_LH desktop cockpit");
}
