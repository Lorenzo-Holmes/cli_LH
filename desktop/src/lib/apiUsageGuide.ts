import type { SidecarPhase } from "./sidecar";
import type { ProbeResult } from "./status";
import { normalizeSettings, type DesktopSettings } from "./storage";

export type ApiUsageEndpoint = {
  label: string;
  path: string;
  description: string;
};

export type ApiUsageGuide = {
  baseUrl: string;
  ready: boolean;
  readinessLabel: string;
  endpoints: ApiUsageEndpoint[];
};

export function buildApiUsageGuide(settings: DesktopSettings, phase: SidecarPhase, probe?: ProbeResult): ApiUsageGuide {
  const normalized = normalizeSettings(settings);
  const baseUrl = normalized.baseUrl.replace(/\/+$/, "");
  const ready = phase === "ready" && probe?.ok === true;

  return {
    baseUrl,
    ready,
    readinessLabel: ready ? "ready to use" : "start and probe first",
    endpoints: [
      {
        label: "OpenAI compatible",
        path: "/v1/chat/completions",
        description: "Use this in OpenAI-compatible SDKs and tools as the chat completions endpoint.",
      },
      {
        label: "Responses compatible",
        path: "/v1/responses",
        description: "Use this for clients that support the OpenAI Responses API shape.",
      },
      {
        label: "Health check",
        path: "/healthz",
        description: "Use this only to confirm the local sidecar is alive.",
      },
      {
        label: "Safe status",
        path: "/statusz",
        description: "Use this to inspect safe runtime information without exposing secrets.",
      },
    ],
  };
}
