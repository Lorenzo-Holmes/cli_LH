use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    pub binary_path: String,
    pub config_path: String,
    pub base_url: String,
    pub local_model: bool,
    pub auto_start: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            binary_path: String::new(),
            config_path: String::new(),
            base_url: "http://127.0.0.1:8317".to_string(),
            local_model: false,
            auto_start: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStateSnapshot {
    pub phase: String,
    pub pid: Option<u32>,
    pub message: Option<String>,
    pub started_at: Option<String>,
    pub stopped_at: Option<String>,
}

impl Default for SidecarStateSnapshot {
    fn default() -> Self {
        Self {
            phase: "idle".to_string(),
            pid: None,
            message: None,
            started_at: None,
            stopped_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LogLine {
    pub source: String,
    pub message: String,
    pub timestamp: String,
}

pub struct SidecarManager {
    child: Mutex<Option<Child>>,
    state: Mutex<SidecarStateSnapshot>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            state: Mutex::new(SidecarStateSnapshot::default()),
        }
    }

    fn set_state(&self, app: &AppHandle, state: SidecarStateSnapshot) -> Result<SidecarStateSnapshot, String> {
        let mut guard = self.state.lock().map_err(|_| "state lock poisoned".to_string())?;
        *guard = state.clone();
        let _ = app.emit("sidecar://state", state.clone());
        Ok(state)
    }

    fn current_state(&self) -> Result<SidecarStateSnapshot, String> {
        self.state.lock().map(|state| state.clone()).map_err(|_| "state lock poisoned".to_string())
    }

    fn emit_log(app: &AppHandle, source: &str, message: impl Into<String>) {
        let line = LogLine {
            source: source.to_string(),
            message: message.into(),
            timestamp: now_string(),
        };
        let event = match source {
            "stdout" => "sidecar://stdout",
            "stderr" => "sidecar://stderr",
            _ => "sidecar://error",
        };
        let _ = app.emit(event, line);
    }

    pub fn start(&self, app: &AppHandle, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
        let settings = normalize_settings(settings);
        if settings.binary_path.is_empty() {
            return Err("cli_LH binary path is required".to_string());
        }
        if settings.config_path.is_empty() {
            return Err("config.yaml path is required".to_string());
        }

        {
            let child_guard = self.child.lock().map_err(|_| "child lock poisoned".to_string())?;
            if child_guard.is_some() {
                return self.current_state();
            }
        }

        self.set_state(app, SidecarStateSnapshot {
            phase: "starting".to_string(),
            message: Some("launching cli_LH".to_string()),
            started_at: Some(now_string()),
            ..SidecarStateSnapshot::default()
        })?;

        let mut command = Command::new(&settings.binary_path);
        command.arg("--config").arg(&settings.config_path);
        if settings.local_model {
            command.arg("--local-model");
        }
        command.stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::null());

        let mut child = command.spawn().map_err(|err| {
            let message = format!("start sidecar: {err}");
            let _ = self.set_state(app, SidecarStateSnapshot {
                phase: "error".to_string(),
                pid: None,
                message: Some(message.clone()),
                started_at: None,
                stopped_at: Some(now_string()),
            });
            message
        })?;
        let pid = child.id();

        if let Some(stdout) = child.stdout.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    SidecarManager::emit_log(&app_clone, "stdout", line);
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    SidecarManager::emit_log(&app_clone, "stderr", line);
                }
            });
        }

        let mut child_guard = self.child.lock().map_err(|_| "child lock poisoned".to_string())?;
        *child_guard = Some(child);

        self.set_state(app, SidecarStateSnapshot {
            phase: "starting".to_string(),
            pid: Some(pid),
            message: Some("process started; waiting for HTTP readiness".to_string()),
            started_at: Some(now_string()),
            stopped_at: None,
        })
    }

    pub fn stop(&self, app: &AppHandle) -> Result<SidecarStateSnapshot, String> {
        let current = self.current_state()?;
        self.set_state(app, SidecarStateSnapshot {
            phase: "stopping".to_string(),
            message: Some("stopping sidecar".to_string()),
            ..current
        })?;

        let mut child_guard = self.child.lock().map_err(|_| "child lock poisoned".to_string())?;
        if let Some(mut child) = child_guard.take() {
            child.kill().map_err(|err| format!("stop sidecar: {err}"))?;
            let _ = child.wait();
        }

        self.set_state(app, SidecarStateSnapshot {
            phase: "stopped".to_string(),
            pid: None,
            message: Some("sidecar stopped".to_string()),
            started_at: None,
            stopped_at: Some(now_string()),
        })
    }

    pub fn restart(&self, app: &AppHandle, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
        let _ = self.stop(app);
        self.start(app, settings)
    }
}

#[tauri::command]
pub fn get_sidecar_state(manager: State<'_, SidecarManager>) -> Result<SidecarStateSnapshot, String> {
    manager.current_state()
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<DesktopSettings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(DesktopSettings::default());
    }
    let raw = fs::read_to_string(path).map_err(|err| format!("read settings: {err}"))?;
    serde_json::from_str(&raw).map_err(|err| format!("parse settings: {err}"))
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: DesktopSettings) -> Result<DesktopSettings, String> {
    let normalized = normalize_settings(settings);
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("create settings dir: {err}"))?;
    }
    let raw = serde_json::to_string_pretty(&normalized).map_err(|err| format!("serialize settings: {err}"))?;
    fs::write(path, raw).map_err(|err| format!("write settings: {err}"))?;
    Ok(normalized)
}

#[tauri::command]
pub fn start_sidecar(app: AppHandle, manager: State<'_, SidecarManager>, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
    manager.start(&app, settings)
}

#[tauri::command]
pub fn stop_sidecar(app: AppHandle, manager: State<'_, SidecarManager>) -> Result<SidecarStateSnapshot, String> {
    manager.stop(&app)
}

#[tauri::command]
pub fn restart_sidecar(app: AppHandle, manager: State<'_, SidecarManager>, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
    manager.restart(&app, settings)
}

#[tauri::command]
pub fn clear_logs() -> Result<(), String> {
    Ok(())
}

fn normalize_settings(mut settings: DesktopSettings) -> DesktopSettings {
    settings.binary_path = settings.binary_path.trim().to_string();
    settings.config_path = settings.config_path.trim().to_string();
    settings.base_url = settings.base_url.trim().trim_end_matches('/').to_string();
    if settings.base_url.is_empty() {
        settings.base_url = "http://127.0.0.1:8317".to_string();
    }
    settings
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| format!("resolve app config dir: {err}"))?;
    Ok(dir.join("settings.json"))
}

fn now_string() -> String {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or_default();
    millis.to_string()
}
