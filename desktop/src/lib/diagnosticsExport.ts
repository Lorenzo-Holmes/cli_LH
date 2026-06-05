import type { LogLine, PreflightReport, SidecarState } from "./sidecar";
import type { ProbeResult, SidecarStatusResponse } from "./status";
import type { DesktopSettings } from "./storage";

export type DiagnosticsReportInput = {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
  logs: LogLine[];
};

const MAX_LOG_LINES = 80;
const MAX_LOG_MESSAGE_LENGTH = 280;
const SENSITIVE_LINE_PATTERN = /\b(api[_-]?key|authorization|bearer|oauth|access[_-]?token|refresh[_-]?token|password|secret|prompt|request body|response text)\b/i;

export function buildDiagnosticsReport(input: DiagnosticsReportInput): string {
  const generatedAt = new Date().toISOString();
  const status = input.probe?.status;

  return [
    "# cli_LH Cockpit Safe Diagnostics Report",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## Privacy Boundary",
    "",
    "This report is built from already-visible desktop state, preflight summaries, safe `/statusz` counts/booleans, and redacted recent process lines.",
    "It intentionally excludes API keys, OAuth tokens, management passwords, request bodies, prompts, responses, auth files, and full config contents.",
    "",
    "## Launch Profile Summary",
    "",
    `- Base URL: ${sanitizeBaseUrl(input.settings.baseUrl)}`,
    `- Binary configured: ${yesNo(Boolean(input.settings.binaryPath))}`,
    `- Binary file: ${fileNameOrMissing(input.settings.binaryPath)}`,
    `- Config configured: ${yesNo(Boolean(input.settings.configPath))}`,
    `- Config file: ${fileNameOrMissing(input.settings.configPath)}`,
    `- Local model flag: ${enabled(input.settings.localModel)}`,
    `- Auto start flag: ${enabled(input.settings.autoStart)}`,
    "",
    "## Native Sidecar State",
    "",
    `- Phase: ${input.state.phase}`,
    `- PID present: ${yesNo(typeof input.state.pid === "number")}`,
    `- Message: ${safeText(input.state.message ?? "-")}`,
    `- Started at: ${input.state.startedAt ?? "-"}`,
    `- Stopped at: ${input.state.stoppedAt ?? "-"}`,
    `- Exit code: ${typeof input.state.exitCode === "number" ? input.state.exitCode : "-"}`,
    "",
    buildPreflightSection(input.preflight),
    buildProbeSection(input.probe),
    buildStatusSection(status),
    buildLogSection(input.logs),
  ].join("\n");
}

export function buildDiagnosticsSummary(input: DiagnosticsReportInput): { headline: string; detail: string; logLines: number; warnings: number } {
  const warnings = input.preflight?.checks.filter((check) => check.severity !== "ok").length ?? 0;
  const logLines = input.logs.slice(-MAX_LOG_LINES).length;
  const headline = input.probe?.ok ? "Ready to export a safe report" : "Export a report for troubleshooting";
  const detail = input.probe?.ok
    ? "The report captures the current healthy state without secrets."
    : "The report captures current setup, probe, preflight, and redacted recent logs.";
  return { headline, detail, logLines, warnings };
}

function buildPreflightSection(preflight?: PreflightReport): string {
  if (!preflight) {
    return ["## Preflight", "", "- Status: not run", ""].join("\n");
  }

  return [
    "## Preflight",
    "",
    `- Can start: ${yesNo(preflight.canStart)}`,
    ...preflight.checks.flatMap((check) => [
      `- ${check.label}: ${check.severity}`,
      `  - Message: ${safeText(check.message)}`,
      `  - Suggestion: ${safeText(check.suggestion ?? "-")}`,
    ]),
    "",
  ].join("\n");
}

function buildProbeSection(probe?: ProbeResult): string {
  if (!probe) {
    return ["## HTTP Probe", "", "- Status: not run", ""].join("\n");
  }

  return [
    "## HTTP Probe",
    "",
    `- OK: ${yesNo(probe.ok)}`,
    `- Checked at: ${probe.checkedAt}`,
    `- Latency: ${probe.latencyMs} ms`,
    `- Error: ${safeText(probe.error ?? "-")}`,
    "",
  ].join("\n");
}

function buildStatusSection(status?: SidecarStatusResponse): string {
  if (!status) {
    return ["## Safe `/statusz` Summary", "", "- Status payload: unavailable", ""].join("\n");
  }

  return [
    "## Safe `/statusz` Summary",
    "",
    `- Service: ${safeText(status.service)}`,
    `- Status: ${safeText(status.status)}`,
    `- Build version: ${safeText(status.build?.version ?? "-")}`,
    `- Server host: ${safeText(status.server?.host ?? "-")}`,
    `- Server port: ${status.server?.port ?? "-"}`,
    "",
    "### Provider Counts",
    "",
    `- Gemini API keys: ${status.providers?.geminiApiKeys ?? 0}`,
    `- Codex API keys: ${status.providers?.codexApiKeys ?? 0}`,
    `- Claude API keys: ${status.providers?.claudeApiKeys ?? 0}`,
    `- OpenAI compatibility entries: ${status.providers?.openaiCompatibilityEntries ?? 0}`,
    `- Vertex API keys: ${status.providers?.vertexApiKeys ?? 0}`,
    `- OAuth model aliases: ${status.providers?.oauthModelAliases ?? 0}`,
    `- Home enabled: ${enabled(status.providers?.homeEnabled)}`,
    "",
    "### Management Toggles",
    "",
    `- Available: ${enabled(status.management?.available)}`,
    `- Local password available: ${enabled(status.management?.localPasswordAvailable)}`,
    `- Remote management allowed: ${enabled(status.management?.remoteManagementAllowed)}`,
    `- Control panel: ${enabled(status.management?.controlPanelEnabled)}`,
    `- Auto update panel: ${enabled(status.management?.autoUpdatePanelEnabled)}`,
    `- Usage statistics: ${enabled(status.management?.usageStatisticsEnabled)}`,
    `- Request logging: ${enabled(status.management?.requestLogEnabled)}`,
    `- File logging: ${enabled(status.management?.loggingToFileEnabled)}`,
    `- WebSocket auth: ${enabled(status.management?.websocketAuthEnabled)}`,
    `- TLS: ${enabled(status.management?.tlsEnabled)}`,
    "",
  ].join("\n");
}

function buildLogSection(logs: LogLine[]): string {
  const recent = logs.slice(-MAX_LOG_LINES);
  if (recent.length === 0) {
    return ["## Recent Redacted Process Lines", "", "No process lines are currently visible in the desktop session.", ""].join("\n");
  }

  return [
    "## Recent Redacted Process Lines",
    "",
    `Showing the last ${recent.length} visible desktop lines. Sensitive-looking lines are replaced instead of exported.`,
    "",
    ...recent.map((line) => `- [${line.timestamp}] ${line.source}: ${sanitizeLogMessage(line.message)}`),
    "",
  ].join("\n");
}

function sanitizeLogMessage(value: string): string {
  if (SENSITIVE_LINE_PATTERN.test(value)) {
    return "[redacted sensitive-looking log line]";
  }
  return truncate(safeText(value), MAX_LOG_MESSAGE_LENGTH);
}

function safeText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/C:\\Users\\[^\\\s]+/gi, "C:\\Users\\<user>")
    .replace(/auths[\\/][^\s]+/gi, "auths/[redacted]");
}

function sanitizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return safeText(value || "-");
  }
}

function fileNameOrMissing(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "not configured";
  const parts = trimmed.split(/[\\/]+/);
  return safeText(parts[parts.length - 1] || "configured");
}

function enabled(value?: boolean): string {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
