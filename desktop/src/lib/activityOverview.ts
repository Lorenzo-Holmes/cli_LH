import type { SidecarState } from "./sidecar";
import type { ProbeResult } from "./status";

export type ActivityOverviewItem = {
  label: string;
  value: string;
  detail: string;
  tone: "ok" | "warning" | "muted";
};

export type ActivityOverview = {
  headline: string;
  detail: string;
  items: ActivityOverviewItem[];
};

export function buildActivityOverview(state: SidecarState, probe?: ProbeResult): ActivityOverview {
  const management = probe?.status?.management;
  const statusReady = probe?.ok === true;
  const checked = probe?.checkedAt ? new Date(probe.checkedAt).toLocaleTimeString() : "never";

  return {
    headline: statusReady ? "Safe activity signals are available" : "Activity signals are waiting for the sidecar",
    detail: statusReady
      ? "This panel shows only safe capability and probe metadata. It does not read request bodies, prompts, tokens, or API keys."
      : "Start the sidecar and run a probe before expecting runtime activity signals.",
    items: [
      {
        label: "Process phase",
        value: state.phase,
        detail: state.message ?? "Native sidecar lifecycle state from Tauri.",
        tone: state.phase === "ready" ? "ok" : state.phase === "error" ? "warning" : "muted",
      },
      {
        label: "Last probe",
        value: checked,
        detail: probe ? `${probe.latencyMs}ms local HTTP check` : "No local HTTP probe has completed yet.",
        tone: statusReady ? "ok" : "muted",
      },
      {
        label: "Usage statistics",
        value: enabledText(management?.usageStatisticsEnabled),
        detail: "Whether the sidecar is configured to collect aggregate usage statistics.",
        tone: management?.usageStatisticsEnabled ? "ok" : "muted",
      },
      {
        label: "Request logging",
        value: enabledText(management?.requestLogEnabled),
        detail: "Whether request logging is enabled in configuration. This panel does not display log contents.",
        tone: management?.requestLogEnabled ? "warning" : "muted",
      },
      {
        label: "File logging",
        value: enabledText(management?.loggingToFileEnabled),
        detail: "Whether logs may also be written to files by the sidecar.",
        tone: management?.loggingToFileEnabled ? "ok" : "muted",
      },
    ],
  };
}

function enabledText(value?: boolean): string {
  if (value === undefined) return "Unknown";
  return value ? "Enabled" : "Disabled";
}
