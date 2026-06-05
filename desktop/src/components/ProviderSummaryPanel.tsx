import { KeyRound } from "lucide-react";
import type { ProbeResult } from "../lib/status";

export function ProviderSummaryPanel({ probe }: { probe?: ProbeResult }) {
  const providers = probe?.status?.providers;
  const items = [
    { label: "Gemini keys", value: providers?.geminiApiKeys ?? 0 },
    { label: "Codex keys", value: providers?.codexApiKeys ?? 0 },
    { label: "Claude keys", value: providers?.claudeApiKeys ?? 0 },
    { label: "OpenAI compat", value: providers?.openaiCompatibilityEntries ?? 0 },
    { label: "Vertex keys", value: providers?.vertexApiKeys ?? 0 },
    { label: "OAuth aliases", value: providers?.oauthModelAliases ?? 0 },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="panel summary-panel">
      <div className="panel-heading">
        <span>Providers</span>
        <strong>{total} entries</strong>
      </div>
      <div className="summary-card hero-summary">
        <KeyRound />
        <div>
          <strong>{total > 0 ? "Provider routing configured" : "No provider entries detected"}</strong>
          <p>Counts only. API keys and OAuth tokens are never shown here.</p>
        </div>
      </div>
      <div className="metadata-grid compact">
        {items.map((item) => (
          <FragmentRow key={item.label} label={item.label} value={String(item.value)} />
        ))}
        <FragmentRow label="Home mode" value={providers?.homeEnabled ? "Enabled" : "Disabled"} />
      </div>
    </section>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
    </>
  );
}