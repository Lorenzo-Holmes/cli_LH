import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { defaultSettings, type DesktopSettings } from "./storage";

export type SidecarPhase = "idle" | "starting" | "ready" | "stopping" | "stopped" | "error";

export type SidecarState = {
  phase: SidecarPhase;
  pid?: number;
  message?: string;
  startedAt?: string;
  stoppedAt?: string;
};

export type LogLine = {
  source: "stdout" | "stderr" | "system";
  message: string;
  timestamp: string;
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
  return [unlistenState, unlistenStdout, unlistenStderr, unlistenError];
}
