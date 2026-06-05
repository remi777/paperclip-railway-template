// Environment diagnostics: validate the OpenRouter API key by listing models.

import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
  AdapterModel,
} from "@paperclipai/adapter-utils";
import { OPENROUTER_MODELS_ENDPOINT } from "../index.js";

function summarize(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const apiKey =
    (typeof ctx.config.apiKey === "string" && ctx.config.apiKey.length > 0
      ? ctx.config.apiKey
      : "") || process.env.OPENROUTER_API_KEY || "";

  if (!apiKey) {
    checks.push({
      code: "api_key",
      level: "error",
      message: "No OpenRouter API key configured.",
      hint: "Set the API key in the agent config or the OPENROUTER_API_KEY environment variable.",
    });
  } else {
    try {
      const res = await fetch(OPENROUTER_MODELS_ENDPOINT, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: unknown[] };
        const count = Array.isArray(data.data) ? data.data.length : 0;
        checks.push({
          code: "api_key",
          level: "info",
          message: `OpenRouter reachable — ${count} models available.`,
        });
      } else {
        const body = await res.text().catch(() => "");
        checks.push({
          code: "api_key",
          level: "error",
          message: `OpenRouter returned ${res.status} ${res.statusText}.`,
          detail: body.slice(0, 200) || null,
          hint: "Check that the API key is valid and has not been revoked.",
        });
      }
    } catch (err) {
      checks.push({
        code: "network",
        level: "error",
        message: `Could not reach OpenRouter: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarize(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

// Live model discovery used by listModels in the registry entry.
// OpenRouter's /models endpoint is public — no API key is required — so this
// returns the full catalogue (300+ models) even before a key is configured.
// A key is sent when available (lets OpenRouter scope/personalize the list).
export async function listOpenRouterModels(apiKey?: string): Promise<AdapterModel[]> {
  const key = apiKey || process.env.OPENROUTER_API_KEY || "";
  try {
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(OPENROUTER_MODELS_ENDPOINT, { headers });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ id?: string; name?: string; pricing?: { prompt?: string; completion?: string } }>;
    };
    if (!Array.isArray(data.data)) return [];

    const isFree = (m: { id?: string; pricing?: { prompt?: string; completion?: string } }) =>
      (m.id ?? "").endsWith(":free") ||
      (m.pricing?.prompt === "0" && m.pricing?.completion === "0");

    return data.data
      .filter((m): m is { id: string; name?: string; pricing?: { prompt?: string; completion?: string } } =>
        typeof m.id === "string",
      )
      .map((m) => ({
        id: m.id,
        label: `${m.name ?? m.id}${isFree(m) ? " (free)" : ""}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}
