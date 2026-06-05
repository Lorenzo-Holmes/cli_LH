mod sidecar;
mod tray;

use sidecar::{
    clear_logs, discover_launch_profile, export_logs, get_settings, get_sidecar_state, open_app_data_dir,
    open_management_page, recommend_available_port, restart_sidecar, list_profiles, reveal_binary_path,
    reveal_config_path, save_profile, save_settings, start_sidecar, stop_sidecar, validate_launch_profile,
    SidecarManager,
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
            list_profiles,
            save_profile,
            get_sidecar_state,
            start_sidecar,
            stop_sidecar,
            restart_sidecar,
            clear_logs,
            export_logs,
            discover_launch_profile,
            validate_launch_profile,
            recommend_available_port,
            open_management_page,
            reveal_config_path,
            reveal_binary_path,
            open_app_data_dir
        ])
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running cli_LH desktop cockpit");
}
