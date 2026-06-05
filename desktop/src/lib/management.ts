export type ManagementSessionState = "signed-out" | "checking" | "signed-in" | "error";

export type ManagementSummary = {
  debug?: boolean;
  loggingToFile?: boolean;
  usageStatistics?: boolean;
  websocketAuth?: boolean;
  proxyUrlConfigured?: boolean;
  checkedAt: string;
};

type EndpointValue = boolean | string | null | undefined;

export async function loadManagementSummary(baseUrl: string, managementKey: string): Promise<ManagementSummary> {
  const root = baseUrl.replace(/\/+$/, "");
  const key = managementKey.trim();
  if (!key) {
    throw new Error("Management key is required");
  }

  const [debug, loggingToFile, usageStatistics, websocketAuth, proxyUrl] = await Promise.all([
    fetchManagementValue(root, key, "/debug", "debug"),
    fetchManagementValue(root, key, "/logging-to-file", "logging-to-file"),
    fetchManagementValue(root, key, "/usage-statistics-enabled", "usage-statistics-enabled"),
    fetchManagementValue(root, key, "/ws-auth", "ws-auth"),
    fetchManagementValue(root, key, "/proxy-url", "proxy-url"),
  ]);

  return {
    debug: asBoolean(debug),
    loggingToFile: asBoolean(loggingToFile),
    usageStatistics: asBoolean(usageStatistics),
    websocketAuth: asBoolean(websocketAuth),
    proxyUrlConfigured: typeof proxyUrl === "string" ? proxyUrl.trim() !== "" : false,
    checkedAt: new Date().toISOString(),
  };
}

async function fetchManagementValue(root: string, key: string, path: string, field: string): Promise<EndpointValue> {
  const response = await fetch(`${root}/v0/management${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`${path} returned ${response.status}${message ? `: ${message}` : ""}`);
  }

  const payload = (await response.json()) as Record<string, EndpointValue>;
  return payload[field];
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string; message?: string };
    return payload.message ?? payload.error ?? "";
  } catch {
    return "";
  }
}

function asBoolean(value: EndpointValue): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}