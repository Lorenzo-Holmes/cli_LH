use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{BufRead, BufReader},
    net::TcpListener,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use crate::tray;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;

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
    pub exit_code: Option<i32>,
}

impl Default for SidecarStateSnapshot {
    fn default() -> Self {
        Self {
            phase: "idle".to_string(),
            pid: None,
            message: None,
            started_at: None,
            stopped_at: None,
            exit_code: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    pub source: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightCheck {
    pub id: String,
    pub label: String,
    pub severity: String,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightReport {
    pub can_start: bool,
    pub checks: Vec<PreflightCheck>,
}

pub struct SidecarManager {
    child: Arc<Mutex<Option<Child>>>,
    state: Arc<Mutex<SidecarStateSnapshot>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            state: Arc::new(Mutex::new(SidecarStateSnapshot::default())),
        }
    }

    fn set_state(&self, app: &AppHandle, state: SidecarStateSnapshot) -> Result<SidecarStateSnapshot, String> {
        let mut guard = self.state.lock().map_err(|_| "state lock poisoned".to_string())?;
        *guard = state.clone();
        let _ = app.emit("sidecar://state", state.clone());
        tray::sync_tray_state(app, &state.phase);
        Ok(state)
    }

    pub(crate) fn current_state(&self) -> Result<SidecarStateSnapshot, String> {
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
        let preflight = build_preflight_report(settings.clone());
        if !preflight.can_start {
            let message = preflight.checks.iter()
                .find(|check| check.severity == "error")
                .map(|check| check.message.clone())
                .unwrap_or_else(|| "launch profile is not ready".to_string());
            return Err(message);
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
                exit_code: None,
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

        let started_at = now_string();
        let mut child_guard = self.child.lock().map_err(|_| "child lock poisoned".to_string())?;
        *child_guard = Some(child);
        drop(child_guard);

        spawn_exit_watcher(
            app.clone(),
            Arc::clone(&self.child),
            Arc::clone(&self.state),
            pid,
            started_at.clone(),
        );

        self.set_state(app, SidecarStateSnapshot {
            phase: "starting".to_string(),
            pid: Some(pid),
            message: Some("process started; waiting for HTTP readiness".to_string()),
            started_at: Some(started_at),
            stopped_at: None,
            exit_code: None,
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
            exit_code: None,
        })
    }

    pub fn restart(&self, app: &AppHandle, settings: DesktopSettings) -> Result<SidecarStateSnapshot, String> {
        let _ = self.stop(app);
        self.start(app, settings)
    }
}

fn spawn_exit_watcher(
    app: AppHandle,
    child: Arc<Mutex<Option<Child>>>,
    state: Arc<Mutex<SidecarStateSnapshot>>,
    pid: u32,
    started_at: String,
) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(750));

        let exit_status = {
            let mut child_guard = match child.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };
            let Some(process) = child_guard.as_mut() else {
                return;
            };
            match process.try_wait() {
                Ok(Some(status)) => {
                    let _ = child_guard.take();
                    status
                }
                Ok(None) => continue,
                Err(err) => {
                    let _ = child_guard.take();
                    let snapshot = SidecarStateSnapshot {
                        phase: "error".to_string(),
                        pid: None,
                        message: Some(format!("sidecar status check failed: {err}")),
                        started_at: Some(started_at.clone()),
                        stopped_at: Some(now_string()),
                        exit_code: None,
                    };
                    if let Ok(mut state_guard) = state.lock() {
                        *state_guard = snapshot.clone();
                    }
                    let _ = app.emit("sidecar://state", snapshot.clone());
                    tray::sync_tray_state(&app, &snapshot.phase);
                    return;
                }
            }
        };

        let exit_code = exit_status.code();
        let phase = if exit_status.success() { "stopped" } else { "error" }.to_string();
        let message = match exit_code {
            Some(code) => format!("sidecar process {pid} exited with code {code}"),
            None => format!("sidecar process {pid} exited"),
        };
        let snapshot = SidecarStateSnapshot {
            phase,
            pid: None,
            message: Some(message.clone()),
            started_at: Some(started_at.clone()),
            stopped_at: Some(now_string()),
            exit_code,
        };
        if let Ok(mut state_guard) = state.lock() {
            *state_guard = snapshot.clone();
        }
        SidecarManager::emit_log(&app, "system", message);
        let _ = app.emit("sidecar://state", snapshot.clone());
        tray::sync_tray_state(&app, &snapshot.phase);
        return;
    });
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

#[tauri::command]
pub fn export_logs(app: AppHandle, lines: Vec<LogLine>) -> Result<String, String> {
    let dir = app.path().app_log_dir().map_err(|err| format!("resolve app log dir: {err}"))?;
    fs::create_dir_all(&dir).map_err(|err| format!("create app log dir: {err}"))?;
    let path = dir.join(format!("diagnostics-{}.log", now_string()));
    let mut content = String::new();
    for line in lines {
        content.push_str(&format!("[{}] {:>6} {}\n", line.timestamp, line.source, line.message));
    }
    fs::write(&path, content).map_err(|err| format!("write diagnostics log: {err}"))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn discover_launch_profile(app: AppHandle) -> Result<DesktopSettings, String> {
    let mut settings = get_settings(app.clone()).unwrap_or_default();
    let mut roots = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd);
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            roots.push(parent.to_path_buf());
        }
    }

    if settings.binary_path.trim().is_empty() {
        if let Some(binary) = find_first_existing(&roots, binary_candidates()) {
            settings.binary_path = binary.to_string_lossy().to_string();
        }
    }
    if settings.config_path.trim().is_empty() {
        if let Some(config) = find_first_existing(&roots, &["config.yaml", "../config.yaml", "../../config.yaml"] ) {
            settings.config_path = config.to_string_lossy().to_string();
        }
    }

    Ok(normalize_settings(settings))
}

#[tauri::command]
pub fn validate_launch_profile(settings: DesktopSettings) -> Result<PreflightReport, String> {
    Ok(build_preflight_report(settings))
}

#[tauri::command]
pub fn recommend_available_port(settings: DesktopSettings) -> Result<DesktopSettings, String> {
    let mut normalized = normalize_settings(settings);
    let (host, current_port) = parse_base_url_host_port(&normalized.base_url)?;
    let mut selected = None;

    for port in current_port.saturating_add(1)..=65535 {
        if is_port_available(&host, port) {
            selected = Some(port);
            break;
        }
    }
    if selected.is_none() {
        for port in 1024..current_port {
            if is_port_available(&host, port) {
                selected = Some(port);
                break;
            }
        }
    }

    let port = selected.ok_or_else(|| format!("no available port found for {host}"))?;
    normalized.base_url = replace_base_url_port(&normalized.base_url, port)?;
    Ok(normalized)
}

#[tauri::command]
pub fn open_management_page(app: AppHandle, settings: DesktopSettings) -> Result<(), String> {
    let settings = normalize_settings(settings);
    let url = format!("{}/management", settings.base_url.trim_end_matches('/'));
    app.opener().open_url(url, None::<&str>).map_err(|err| format!("open management page: {err}"))
}

#[tauri::command]
pub fn reveal_config_path(app: AppHandle, settings: DesktopSettings) -> Result<(), String> {
    reveal_path(&app, &settings.config_path, "config.yaml")
}

#[tauri::command]
pub fn reveal_binary_path(app: AppHandle, settings: DesktopSettings) -> Result<(), String> {
    reveal_path(&app, &settings.binary_path, "cli_LH binary")
}

#[tauri::command]
pub fn open_app_data_dir(app: AppHandle) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|err| format!("resolve app config dir: {err}"))?;
    fs::create_dir_all(&dir).map_err(|err| format!("create app config dir: {err}"))?;
    app.opener().open_path(dir.to_string_lossy().to_string(), None::<&str>).map_err(|err| format!("open app data dir: {err}"))
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

fn reveal_path(app: &AppHandle, path: &str, label: &str) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} path is required"));
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() {
        return Err(format!("{label} was not found at {trimmed}"));
    }
    app.opener().reveal_item_in_dir(path).map_err(|err| format!("reveal {label}: {err}"))
}

fn check_file_path(id: &str, label: &str, value: &str, missing_message: &str, missing_suggestion: &str) -> PreflightCheck {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return PreflightCheck {
            id: id.to_string(),
            label: label.to_string(),
            severity: "error".to_string(),
            message: missing_message.to_string(),
            suggestion: Some(missing_suggestion.to_string()),
        };
    }

    let path = PathBuf::from(trimmed);
    if path.is_file() {
        return PreflightCheck {
            id: id.to_string(),
            label: label.to_string(),
            severity: "ok".to_string(),
            message: format!("{label} exists"),
            suggestion: None,
        };
    }

    PreflightCheck {
        id: id.to_string(),
        label: label.to_string(),
        severity: "error".to_string(),
        message: format!("{label} was not found at {trimmed}"),
        suggestion: Some(format!("Choose an existing {label} path or run Auto-detect.")),
    }
}

fn parse_base_url_host_port(base_url: &str) -> Result<(String, u16), String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let without_scheme = trimmed.strip_prefix("http://").or_else(|| trimmed.strip_prefix("https://"))
        .ok_or_else(|| "Base URL must start with http:// or https://".to_string())?;
    let authority = without_scheme.split('/').next().unwrap_or_default();
    let authority = authority.rsplit('@').next().unwrap_or(authority);

    let (host, port_text) = if authority.starts_with('[') {
        let end = authority.find(']').ok_or_else(|| "IPv6 host is missing closing bracket".to_string())?;
        let host = authority[1..end].to_string();
        let rest = &authority[end + 1..];
        let port = rest.strip_prefix(':').ok_or_else(|| "Base URL must include an explicit port".to_string())?;
        (host, port.to_string())
    } else {
        let (host, port) = authority.rsplit_once(':').ok_or_else(|| "Base URL must include an explicit port".to_string())?;
        (host.to_string(), port.to_string())
    };

    if host.trim().is_empty() {
        return Err("Base URL host is empty".to_string());
    }
    let port = port_text.parse::<u16>().map_err(|_| "Base URL port must be between 1 and 65535".to_string())?;
    Ok((host, port))
}

fn check_base_url(base_url: &str) -> PreflightCheck {
    match parse_base_url_host_port(base_url) {
        Ok((host, port)) => PreflightCheck {
            id: "baseUrl".to_string(),
            label: "Base URL".to_string(),
            severity: "ok".to_string(),
            message: format!("Base URL points to {host}:{port}"),
            suggestion: None,
        },
        Err(err) => PreflightCheck {
            id: "baseUrl".to_string(),
            label: "Base URL".to_string(),
            severity: "error".to_string(),
            message: err,
            suggestion: Some("Use a URL such as http://127.0.0.1:8317.".to_string()),
        },
    }
}

fn check_port_available(base_url: &str) -> PreflightCheck {
    let (host, port) = match parse_base_url_host_port(base_url) {
        Ok(parsed) => parsed,
        Err(err) => {
            return PreflightCheck {
                id: "port".to_string(),
                label: "Port".to_string(),
                severity: "warning".to_string(),
                message: format!("Port check skipped: {err}"),
                suggestion: Some("Fix the Base URL before starting the sidecar.".to_string()),
            };
        }
    };

    if is_port_available(&host, port) {
        PreflightCheck {
            id: "port".to_string(),
            label: "Port".to_string(),
            severity: "ok".to_string(),
            message: format!("{host}:{port} appears available"),
            suggestion: None,
        }
    } else {
        PreflightCheck {
            id: "port".to_string(),
            label: "Port".to_string(),
            severity: "warning".to_string(),
            message: format!("{host}:{port} is already accepting connections"),
            suggestion: Some("If cli_LH is already running, use Probe now. Otherwise stop the process using this port or change the configured port.".to_string()),
        }
    }
}

fn is_port_available(host: &str, port: u16) -> bool {
    TcpListener::bind((host, port)).is_ok()
}

fn replace_base_url_port(base_url: &str, port: u16) -> Result<String, String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let (scheme, rest) = trimmed.split_once("://").ok_or_else(|| "Base URL must include a scheme".to_string())?;
    let (authority, path) = rest.split_once('/').map_or((rest, ""), |(authority, path)| (authority, path));
    let without_userinfo = authority.rsplit('@').next().unwrap_or(authority);
    let prefix_len = authority.len() - without_userinfo.len();
    let prefix = &authority[..prefix_len];
    let host = if without_userinfo.starts_with('[') {
        let end = without_userinfo.find(']').ok_or_else(|| "IPv6 host is missing closing bracket".to_string())?;
        &without_userinfo[..=end]
    } else {
        without_userinfo.rsplit_once(':').map(|(host, _)| host).unwrap_or(without_userinfo)
    };
    let path_suffix = if path.is_empty() { String::new() } else { format!("/{path}") };
    Ok(format!("{scheme}://{prefix}{host}:{port}{path_suffix}"))
}

fn build_preflight_report(settings: DesktopSettings) -> PreflightReport {
    let normalized = normalize_settings(settings);
    let checks = vec![
        check_file_path(
            "binaryPath",
            "Binary",
            &normalized.binary_path,
            "cli_LH binary path is required",
            "Choose cli_LH.exe or run Auto-detect.",
        ),
        check_file_path(
            "configPath",
            "Config",
            &normalized.config_path,
            "config.yaml path is required",
            "Choose config.yaml or run Auto-detect.",
        ),
        check_base_url(&normalized.base_url),
        check_port_available(&normalized.base_url),
    ];
    let can_start = checks.iter().all(|check| check.severity != "error");
    PreflightReport { can_start, checks }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| format!("resolve app config dir: {err}"))?;
    Ok(dir.join("settings.json"))
}

#[cfg(windows)]
fn binary_candidates() -> &'static [&'static str] {
    &["cli_LH.exe", "server.exe", "bin/server.exe", "../cli_LH.exe", "../server.exe", "../bin/server.exe"]
}

#[cfg(not(windows))]
fn binary_candidates() -> &'static [&'static str] {
    &["cli_LH", "server", "bin/server", "../cli_LH", "../server", "../bin/server"]
}

fn find_first_existing(roots: &[PathBuf], candidates: &[&str]) -> Option<PathBuf> {
    roots.iter().flat_map(|root| candidates.iter().map(move |candidate| normalize_path(root.join(candidate))))
        .find(|path| path.is_file())
}

fn normalize_path(path: PathBuf) -> PathBuf {
    path.canonicalize().unwrap_or(path)
}

fn now_string() -> String {
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or_default();
    millis.to_string()
}
