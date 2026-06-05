import type { PreflightReport, SidecarState } from "./sidecar";
import type { ProbeResult } from "./status";
import type { DesktopSettings } from "./storage";

export type NextActionKind = "setup" | "preflight" | "start" | "probe" | "management" | "observe" | "logs";

export type NextAction = {
  kind: NextActionKind;
  title: string;
  detail: string;
  cta: string;
  priority: "critical" | "warning" | "ready" | "info";
};

export function buildNextActions(input: {
  settings: DesktopSettings;
  state: SidecarState;
  preflight?: PreflightReport;
  probe?: ProbeResult;
}): NextAction[] {
  const actions: NextAction[] = [];
  const settingsReady = input.settings.binaryPath.trim() !== "" && input.settings.configPath.trim() !== "";
  const preflightErrors = input.preflight?.checks.filter((check) => check.severity === "error") ?? [];
  const sidecarReady = input.state.phase === "ready" || input.probe?.ok === true;

  if (!settingsReady) {
    actions.push({
      kind: "setup",
      title: "Finish first-time setup",
      detail: "Choose the cli_LH binary and config.yaml before starting the local proxy engine.",
      cta: "Open setup wizard",
      priority: "critical",
    });
  }

  if (settingsReady && preflightErrors.length > 0) {
    actions.push({
      kind: "preflight",
      title: "Fix launch checks",
      detail: `${preflightErrors.length} required check${preflightErrors.length === 1 ? "" : "s"} must pass before the sidecar can start reliably.`,
      cta: "Review preflight",
      priority: "critical",
    });
  }

  if (settingsReady && input.preflight?.canStart && (input.state.phase === "idle" || input.state.phase === "stopped")) {
    actions.push({
      kind: "start",
      title: "Start the sidecar",
      detail: "The desktop shell is configured. Start the Go sidecar so API clients can connect through cli_LH.",
      cta: "Click Start",
      priority: "ready",
    });
  }

  if (input.state.phase === "starting" && input.probe?.ok !== true) {
    actions.push({
      kind: "probe",
      title: "Wait for HTTP readiness",
      detail: "The process is starting. The app will mark it ready when /healthz and /statusz respond.",
      cta: "Probe now",
      priority: "info",
    });
  }

  if (sidecarReady && input.probe?.status?.management?.available) {
    actions.push({
      kind: "management",
      title: "Open the management UI",
      detail: "The local engine is ready and management access is configured, so advanced controls are available.",
      cta: "Open management",
      priority: "ready",
    });
  }

  if (sidecarReady && input.probe?.status?.management?.available === false) {
    actions.push({
      kind: "observe",
      title: "Use read-only dashboard mode",
      detail: "The proxy is ready, but management access is locked. Status panels still show safe runtime information.",
      cta: "Review dashboard",
      priority: "info",
    });
  }

  if (input.state.phase === "error" || input.probe?.error) {
    actions.push({
      kind: "logs",
      title: "Check logs and base URL",
      detail: input.probe?.error ?? input.state.message ?? "The sidecar reported an error. Inspect logs for the first failing step.",
      cta: "Inspect logs",
      priority: "warning",
    });
  }

  if (actions.length === 0) {
    actions.push({
      kind: "observe",
      title: "Monitor the cockpit",
      detail: "No urgent action is needed. Keep an eye on telemetry, providers, management, and logs.",
      cta: "Observe",
      priority: "info",
    });
  }

  return actions.slice(0, 3);
}