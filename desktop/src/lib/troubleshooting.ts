import type { PreflightReport, SidecarState } from "./sidecar";
import type { ProbeResult } from "./status";
import type { DesktopSettings } from "./storage";

export type TroubleshootingStep = {
  id: string;
  title: string;
  symptom: string;
  check: string;
  fix: string;
  tone: "ok" | "warning" | "critical" | "muted";
};

export type TroubleshootingGuide = {
  headline: string;
  detail: string;
  steps: TroubleshootingStep[];
};

type TroubleshootingInput = {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
};

export function buildTroubleshootingGuide({ settings, state, preflight, probe }: TroubleshootingInput): TroubleshootingGuide {
  const hasPathIssue = !settings.binaryPath || !settings.configPath;
  const preflightErrors = preflight?.checks.filter((check) => check.severity === "error") ?? [];
  const hasProbeError = probe?.ok === false;
  const isReady = state.phase === "ready" && probe?.ok === true;

  return {
    headline: isReady ? "No urgent desktop issues detected" : "Start here when the sidecar does not work",
    detail: isReady
      ? "The local process and HTTP probes look healthy. Keep this checklist for future setup, port, or management problems."
      : "Work from top to bottom. Each card explains the symptom, what to check, and the safest beginner fix.",
    steps: [
      {
        id: "paths",
        title: "1. Binary or config path is missing",
        symptom: hasPathIssue ? "The setup is incomplete." : "The setup paths are present.",
        check: "Open the setup wizard and confirm the cli_LH binary plus config.yaml paths.",
        fix: "Use Auto-detect first. If that fails, choose the server executable and config.yaml manually.",
        tone: hasPathIssue ? "critical" : "ok",
      },
      {
        id: "preflight",
        title: "2. Preflight blocks launch",
        symptom: preflightErrors.length > 0 ? `${preflightErrors.length} preflight check(s) need attention.` : "No blocking preflight errors are known.",
        check: "Read the Launch readiness panel. Error cards usually point to missing files, invalid base URL, or port conflicts.",
        fix: "Fix the first error, then press Recheck. Do not change multiple things at once when learning.",
        tone: preflightErrors.length > 0 ? "critical" : preflight ? "ok" : "muted",
      },
      {
        id: "port",
        title: "3. Port or Base URL cannot be reached",
        symptom: hasProbeError ? probe?.error ?? "The local HTTP probe failed." : "The latest HTTP probe is not reporting a port problem.",
        check: "Confirm the Base URL matches the port in config.yaml, usually http://127.0.0.1:8317.",
        fix: "Use the available-port suggestion if another program already uses the configured port.",
        tone: hasProbeError ? "warning" : probe?.ok ? "ok" : "muted",
      },
      {
        id: "process",
        title: "4. Sidecar process exits or stays stuck",
        symptom: state.phase === "error" ? state.message ?? "The native sidecar state reports an error." : `Current native phase is ${state.phase}.`,
        check: "Look at the log panel for recent system, stdout, and stderr lines around the failed start.",
        fix: "Export logs before changing settings, then restart after fixing the first visible error.",
        tone: state.phase === "error" ? "critical" : state.phase === "starting" ? "warning" : "muted",
      },
      {
        id: "management",
        title: "5. Management page or key does not work",
        symptom: probe?.status?.management?.available === false ? "Management is not available in the current sidecar status." : "Management availability depends on config and password settings.",
        check: "Check the Management summary first. Only verify the key if local management is enabled.",
        fix: "Clear the in-memory session and re-enter the management key. The desktop app does not save that key.",
        tone: probe?.status?.management?.available ? "ok" : "muted",
      },
    ],
  };
}
