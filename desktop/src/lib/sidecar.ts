import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { defaultSettings, normalizeSettings, type DesktopSettings } from "./storage";

export type SidecarPhase = "idle" | "starting" | "ready" | "stopping" | "stopped" | "error";

export type SidecarState = {
  phase: SidecarPhase;
  pid?: number;
  message?: string;
  startedAt?: string;
  stoppedAt?: string;
  exitCode?: number;
};

export type LogLine = {
  source: "stdout" | "stderr" | "system";
  message: string;
  timestamp: string;
};

export type PreflightSeverity = "ok" | "warning" | "error";

export type PreflightCheck = {
  id: string;
  label: string;
  severity: PreflightSeverity;
  message: string;
  suggestion?: string;
};

export type PreflightReport = {
  canStart: boolean;
  checks: PreflightCheck[];
};

export type LaunchProfile = {
  name: string;
  settings: DesktopSettings;
};

function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getSettings(): Promise<DesktopSettings> {
  if (!inTauri()) {
    return defaultSettings;
  }
  return invoke<DesktopSettings>("get_settings");
}

export async function saveSettings(settings: DesktopSettings): Promise<DesktopSettings> {
  if (!inTauri()) {
    return settings;
  }
  return invoke<DesktopSettings>("save_settings", { settings });
}

export async function listProfiles(): Promise<LaunchProfile[]> {
  if (!inTauri()) {
    return [];
  }
  return invoke<LaunchProfile[]>("list_profiles");
}

export async function saveProfile(name: string, settings: DesktopSettings): Promise<LaunchProfile[]> {
  if (!inTauri()) {
    return [{ name, settings: normalizeSettings(settings) }];
  }
  return invoke<LaunchProfile[]>("save_profile", { name, settings: normalizeSettings(settings) });
}

export async function renameProfile(oldName: string, newName: string): Promise<LaunchProfile[]> {
  if (!inTauri()) {
    return [];
  }
  return invoke<LaunchProfile[]>("rename_profile", { oldName, newName });
}

export async function deleteProfile(name: string): Promise<LaunchProfile[]> {
  if (!inTauri()) {
    return [];
  }
  return invoke<LaunchProfile[]>("delete_profile", { name });
}

export async function getSidecarState(): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "idle", message: "Browser preview mode" };
  }
  return invoke<SidecarState>("get_sidecar_state");
}

export async function startSidecar(settings: DesktopSettings): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "starting", message: "Start is available inside Tauri" };
  }
  return invoke<SidecarState>("start_sidecar", { settings });
}

export async function stopSidecar(): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "stopped", message: "Stop is available inside Tauri" };
  }
  return invoke<SidecarState>("stop_sidecar");
}

export async function restartSidecar(settings: DesktopSettings): Promise<SidecarState> {
  if (!inTauri()) {
    return { phase: "starting", message: "Restart is available inside Tauri" };
  }
  return invoke<SidecarState>("restart_sidecar", { settings });
}

export async function clearLogs(): Promise<void> {
  if (!inTauri()) {
    return;
  }
  await invoke("clear_logs");
}

export async function exportLogs(lines: LogLine[]): Promise<string> {
  if (!inTauri()) {
    const blob = new Blob([lines.map((line) => `[${line.timestamp}] ${line.source} ${line.message}`).join("\n")], { type: "text/plain" });
    return URL.createObjectURL(blob);
  }
  return invoke<string>("export_logs", { lines });
}

export async function exportTextFile(fileName: string, content: string): Promise<string> {
  if (!inTauri()) {
    const blob = new Blob([content], { type: "text/plain" });
    return URL.createObjectURL(blob);
  }
  return invoke<string>("export_text_file", { fileName, content });
}

export async function selectBinaryPath(): Promise<string | undefined> {
  if (!inTauri()) {
    return undefined;
  }
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Select cli_LH binary",
    filters: [{ name: "Executable", extensions: ["exe"] }],
  });
  return typeof selected === "string" ? selected : undefined;
}

export async function selectConfigPath(): Promise<string | undefined> {
  if (!inTauri()) {
    return undefined;
  }
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Select config.yaml",
    filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
  });
  return typeof selected === "string" ? selected : undefined;
}

export async function discoverLaunchProfile(): Promise<DesktopSettings> {
  if (!inTauri()) {
    return defaultSettings;
  }
  return invoke<DesktopSettings>("discover_launch_profile");
}

export async function validateLaunchProfile(settings: DesktopSettings): Promise<PreflightReport> {
  if (!inTauri()) {
    const normalized = normalizeSettings(settings);
    const checks: PreflightCheck[] = [
      {
        id: "binaryPath",
        label: "Binary",
        severity: normalized.binaryPath ? "warning" : "error",
        message: normalized.binaryPath ? "Browser preview cannot verify local binary paths" : "cli_LH binary path is required",
        suggestion: "Run inside Tauri to verify the file path.",
      },
      {
        id: "configPath",
        label: "Config",
        severity: normalized.configPath ? "warning" : "error",
        message: normalized.configPath ? "Browser preview cannot verify local config paths" : "config.yaml path is required",
        suggestion: "Run inside Tauri to verify the file path.",
      },
      {
        id: "baseUrl",
        label: "Base URL",
        severity: normalized.baseUrl.startsWith("http") ? "ok" : "error",
        message: normalized.baseUrl.startsWith("http") ? `Base URL is ${normalized.baseUrl}` : "Base URL must start with http:// or https://",
        suggestion: "Use a URL such as http://127.0.0.1:8317.",
      },
    ];
    return { canStart: checks.every((check) => check.severity !== "error"), checks };
  }
  return invoke<PreflightReport>("validate_launch_profile", { settings: normalizeSettings(settings) });
}

export async function recommendAvailablePort(settings: DesktopSettings): Promise<DesktopSettings> {
  if (!inTauri()) {
    return normalizeSettings({ ...settings, baseUrl: "http://127.0.0.1:8318" });
  }
  return invoke<DesktopSettings>("recommend_available_port", { settings: normalizeSettings(settings) });
}

export async function openManagementPage(settings: DesktopSettings): Promise<void> {
  if (!inTauri()) {
    window.open(`${normalizeSettings(settings).baseUrl}/management`, "_blank", "noopener,noreferrer");
    return;
  }
  return invoke<void>("open_management_page", { settings: normalizeSettings(settings) });
}

export async function revealConfigPath(settings: DesktopSettings): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>("reveal_config_path", { settings: normalizeSettings(settings) });
}

export async function revealBinaryPath(settings: DesktopSettings): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>("reveal_binary_path", { settings: normalizeSettings(settings) });
}

export async function openAppDataDir(): Promise<void> {
  if (!inTauri()) return;
  return invoke<void>("open_app_data_dir");
}

export async function subscribeSidecarEvents(handlers: {
  onState: (state: SidecarState) => void;
  onLog: (line: LogLine) => void;
}): Promise<UnlistenFn[]> {
  if (!inTauri()) {
    return [];
  }

  const unlistenState = await listen<SidecarState>("sidecar://state", (event) => handlers.onState(event.payload));
  const unlistenStdout = await listen<LogLine>("sidecar://stdout", (event) => handlers.onLog(event.payload));
  const unlistenStderr = await listen<LogLine>("sidecar://stderr", (event) => handlers.onLog(event.payload));
  const unlistenError = await listen<LogLine>("sidecar://error", (event) => handlers.onLog(event.payload));
  const unlistenTrayAction = await listen<string>("sidecar://tray-action", (event) => {
    handlers.onLog({
      source: "system",
      message: `Tray action ignored: ${event.payload}`,
      timestamp: new Date().toISOString(),
    });
  });
  return [unlistenState, unlistenStdout, unlistenStderr, unlistenError, unlistenTrayAction];
}
