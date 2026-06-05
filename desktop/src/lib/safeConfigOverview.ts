import type { PreflightReport, SidecarState } from "./sidecar";
import type { ProbeResult } from "./status";
import type { DesktopSettings } from "./storage";

export type SafeConfigOverviewInput = {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
};

export type SafeConfigItem = {
  label: string;
  value: string;
  tone?: "ok" | "warning" | "critical";
};

export type SafeConfigSection = {
  title: string;
  items: SafeConfigItem[];
};

export type SafeConfigNote = {
  title: string;
  detail: string;
  tone: "ok" | "warning" | "critical";
};

export type SafeConfigOverview = {
  sections: SafeConfigSection[];
  notes: SafeConfigNote[];
};

export function buildSafeConfigOverview(input: SafeConfigOverviewInput): SafeConfigOverview {
  const status = input.probe?.status;
  const preflightErrors = input.preflight?.checks.filter((check) => check.severity === "error").length ?? 0;
  const preflightWarnings = input.preflight?.checks.filter((check) => check.severity === "warning").length ?? 0;

  return {
    sections: [
      {
        title: "Launch profile",
        items: [
          { label: "Base URL", value: sanitizeBaseUrl(input.settings.baseUrl), tone: isLocalBaseUrl(input.settings.baseUrl) ? "ok" : "warning" },
          { label: "Binary", value: fileNameOrState(input.settings.binaryPath), tone: input.settings.binaryPath ? "ok" : "critical" },
          { label: "Config", value: fileNameOrState(input.settings.configPath), tone: input.settings.configPath ? "ok" : "critical" },
          { label: "Local model", value: enabled(input.settings.localModel) },
          { label: "Auto start", value: enabled(input.settings.autoStart) },
        ],
      },
      {
        title: "Runtime",
        items: [
          { label: "Native phase", value: input.state.phase },
          { label: "HTTP probe", value: input.probe ? (input.probe.ok ? "Ready" : "Unavailable") : "Not checked", tone: input.probe?.ok ? "ok" : "warning" },
          { label: "Server host", value: status?.server?.host ?? "Unavailable" },
          { label: "Server port", value: status?.server?.port ? String(status.server.port) : "Unavailable" },
          { label: "TUI mode", value: enabled(status?.runtime?.tuiMode) },
          { label: "Standalone", value: enabled(status?.runtime?.standalone) },
        ],
      },
      {
        title: "Providers",
        items: [
          { label: "Gemini API keys", value: count(status?.providers?.geminiApiKeys) },
          { label: "Codex API keys", value: count(status?.providers?.codexApiKeys) },
          { label: "Claude API keys", value: count(status?.providers?.claudeApiKeys) },
          { label: "OpenAI compatibility", value: count(status?.providers?.openaiCompatibilityEntries) },
          { label: "Vertex API keys", value: count(status?.providers?.vertexApiKeys) },
          { label: "OAuth aliases", value: count(status?.providers?.oauthModelAliases) },
        ],
      },
      {
        title: "Management",
        items: [
          { label: "Available", value: enabled(status?.management?.available), tone: status?.management?.available ? "ok" : "warning" },
          { label: "Local password", value: enabled(status?.management?.localPasswordAvailable) },
          { label: "Remote allowed", value: enabled(status?.management?.remoteManagementAllowed), tone: status?.management?.remoteManagementAllowed ? "warning" : "ok" },
          { label: "Request logging", value: enabled(status?.management?.requestLogEnabled), tone: status?.management?.requestLogEnabled ? "warning" : "ok" },
          { label: "File logging", value: enabled(status?.management?.loggingToFileEnabled), tone: status?.management?.loggingToFileEnabled ? "warning" : undefined },
          { label: "TLS", value: enabled(status?.management?.tlsEnabled) },
        ],
      },
      {
        title: "Preflight",
        items: [
          { label: "Can start", value: input.preflight ? yesNo(input.preflight.canStart) : "Not checked", tone: input.preflight?.canStart ? "ok" : "warning" },
          { label: "Errors", value: String(preflightErrors), tone: preflightErrors > 0 ? "critical" : "ok" },
          { label: "Warnings", value: String(preflightWarnings), tone: preflightWarnings > 0 ? "warning" : "ok" },
        ],
      },
    ],
    notes: buildNotes(input),
  };
}

function buildNotes(input: SafeConfigOverviewInput): SafeConfigNote[] {
  const status = input.probe?.status;
  const notes: SafeConfigNote[] = [];

  if (!input.settings.binaryPath || !input.settings.configPath) {
    notes.push({ title: "Setup is incomplete", detail: "Choose the cli_LH binary and config.yaml before starting the sidecar.", tone: "critical" });
  }

  if (!isLocalBaseUrl(input.settings.baseUrl)) {
    notes.push({ title: "Base URL is not local-only", detail: "For beginner desktop use, prefer 127.0.0.1 or localhost unless remote access is intentional.", tone: "warning" });
  }

  if (status?.management?.remoteManagementAllowed) {
    notes.push({ title: "Remote management is enabled", detail: "Keep management credentials private and expose the port only when you understand the network boundary.", tone: "warning" });
  }

  if (status?.management?.requestLogEnabled || status?.management?.loggingToFileEnabled) {
    notes.push({ title: "Logging may contain operational data", detail: "Review log-sharing practices before sending files to others.", tone: "warning" });
  }

  if (!input.probe?.status) {
    notes.push({ title: "Live sidecar status is unavailable", detail: "Start the sidecar or fix probe errors to populate runtime, provider, and management facts.", tone: "warning" });
  }

  if (notes.length === 0) {
    notes.push({ title: "Overview is safe to share at a glance", detail: "This panel shows counts, booleans, and file names only. It does not display secrets or full config contents.", tone: "ok" });
  }

  return notes;
}

function sanitizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value || "Unavailable";
  }
}

function isLocalBaseUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

function fileNameOrState(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Not configured";
  const parts = trimmed.split(/[\\/]+/);
  return parts[parts.length - 1] || "Configured";
}

function enabled(value?: boolean): string {
  if (value === undefined) return "Unavailable";
  return value ? "Enabled" : "Disabled";
}

function count(value?: number): string {
  return typeof value === "number" ? String(value) : "Unavailable";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
