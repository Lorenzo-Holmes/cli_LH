export type SidecarStatusResponse = {
  status: string;
  service: string;
  build?: {
    version?: string;
    commit?: string;
    buildDate?: string;
  };
  server?: {
    host?: string;
    port?: number;
    configPath?: string;
    authDir?: string;
  };
  runtime?: {
    tuiMode?: boolean;
    standalone?: boolean;
    localModel?: boolean;
  };
  providers?: {
    geminiApiKeys?: number;
    codexApiKeys?: number;
    claudeApiKeys?: number;
    openaiCompatibilityEntries?: number;
    vertexApiKeys?: number;
    oauthModelAliases?: number;
    homeEnabled?: boolean;
  };
  management?: {
    available?: boolean;
    localPasswordAvailable?: boolean;
    remoteManagementAllowed?: boolean;
    controlPanelEnabled?: boolean;
    autoUpdatePanelEnabled?: boolean;
    usageStatisticsEnabled?: boolean;
    requestLogEnabled?: boolean;
    loggingToFileEnabled?: boolean;
    websocketAuthEnabled?: boolean;
    tlsEnabled?: boolean;
  };
};

export type ProbeResult = {
  ok: boolean;
  checkedAt: string;
  latencyMs: number;
  status?: SidecarStatusResponse;
  error?: string;
};

export async function probeSidecar(baseUrl: string): Promise<ProbeResult> {
  const started = performance.now();
  const checkedAt = new Date().toISOString();
  const root = baseUrl.replace(/\/+$/, "");

  try {
    const health = await fetch(`${root}/healthz`, { method: "GET" });
    if (!health.ok) {
      return {
        ok: false,
        checkedAt,
        latencyMs: Math.round(performance.now() - started),
        error: `/healthz returned ${health.status}`,
      };
    }

    const statusResponse = await fetch(`${root}/statusz`, { method: "GET" });
    if (!statusResponse.ok) {
      return {
        ok: false,
        checkedAt,
        latencyMs: Math.round(performance.now() - started),
        error: `/statusz returned ${statusResponse.status}`,
      };
    }

    const status = (await statusResponse.json()) as SidecarStatusResponse;
    return {
      ok: status.status === "ready",
      checkedAt,
      latencyMs: Math.round(performance.now() - started),
      status,
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt,
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
