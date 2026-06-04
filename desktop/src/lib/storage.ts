export type DesktopSettings = {
  binaryPath: string;
  configPath: string;
  baseUrl: string;
  localModel: boolean;
  autoStart: boolean;
};

export const defaultSettings: DesktopSettings = {
  binaryPath: "",
  configPath: "",
  baseUrl: "http://127.0.0.1:8317",
  localModel: false,
  autoStart: false,
};

export function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return defaultSettings.baseUrl;
  }
  return trimmed.replace(/\/+$/, "");
}

export function normalizeSettings(settings: DesktopSettings): DesktopSettings {
  return {
    binaryPath: settings.binaryPath.trim(),
    configPath: settings.configPath.trim(),
    baseUrl: normalizeBaseUrl(settings.baseUrl),
    localModel: settings.localModel,
    autoStart: settings.autoStart,
  };
}
