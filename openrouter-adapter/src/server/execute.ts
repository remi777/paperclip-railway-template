// OpenRouter adapter execute() — targets the v2026.4xx Paperclip adapter SDK.
//
// Reads config + wake payload from AdapterExecutionContext, runs the OpenRouter
// tool loop, manages issue state, posts the final output as a comment, and
// returns a fully-shaped AdapterExecutionResult.

import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  UsageSummary,
} from "@paperclipai/adapter-utils";
import {
  renderPaperclipWakePrompt,
  normalizePaperclipWakePayload,
} from "@paperclipai/adapter-utils/server-utils";

import { DEFAULT_MODEL } from "../index.js";
import { PaperclipApi } from "./paperclip-api.js";
import { buildTools } from "./tools.js";
import { runOpenRouterAgent } from "./openrouter.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { agent, config, context, onLog, authToken } = ctx;

  const log = (line: string) => {
    void onLog("stdout", line.endsWith("\n") ? line : `${line}\n`);
  };
  const logErr = (line: string) => {
    void onLog("stderr", line.endsWith("\n") ? line : `${line}\n`);
  };

  const model = asString(config.model, DEFAULT_MODEL);
  const apiKey = asString(config.apiKey) || process.env.OPENROUTER_API_KEY || "";
  const systemPrompt = asString(config.systemPrompt);
  const temperature = asNumber(config.temperature, 0.7);
  const maxTokens = asNumber(config.maxTokens, 4096);
  const maxTurns = asNumber(config.maxTurns, 25);
  const autoApprove = asBool(config.autoApprove, false);

  const usage: UsageSummary = { inputTokens: 0, outputTokens: 0 };

  if (!apiKey) {
    const msg = "No OpenRouter API key configured (set adapterConfig.apiKey or OPENROUTER_API_KEY).";
    logErr(msg);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: msg,
      errorCode: "missing_api_key",
      usage,
      model,
      provider: "openrouter",
    };
  }

  const wake = normalizePaperclipWakePayload(context);
  const issueId = wake?.issue?.id ?? null;
  const companyId = agent.companyId;
  const agentId = agent.id;

  const api = authToken ? new PaperclipApi({ authToken }) : null;
  if (!api) {
    log("No authToken on context — running without Paperclip API tools (model-only).");
  }
  const tools = api
    ? buildTools({ api, agentId, companyId, currentIssueId: issueId, autoApprove })
    : [];

  // Move the issue to in_progress (best-effort; checkout may already be held
  // by the heartbeat dispatcher).
  if (api && issueId) {
    try {
      await api.checkoutIssue(issueId, agentId).catch(() => undefined);
      await api.updateIssue(issueId, { status: "in_progress" });
    } catch (err) {
      log(`Could not set issue to in_progress: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const wakePrompt = renderPaperclipWakePrompt(context, {});
  const userPrompt = wakePrompt || asString((context as Record<string, unknown>).prompt) || "Continue your work on the assigned issue.";

  log(`OpenRouter run starting — model=${model}`);

  let finalText = "";
  let lastGenerationId: string | null = null;
  let costUsd = 0;
  try {
    const result = await runOpenRouterAgent({
      apiKey,
      model,
      systemPrompt: systemPrompt || undefined,
      userPrompt,
      tools,
      maxTurns,
      temperature,
      maxTokens,
      onAssistant: (text) => log(text),
      onToolCall: (name, args) => log(`→ tool ${name} ${args.slice(0, 300)}`),
      onToolResult: (name, content, isError) =>
        log(`← ${name}${isError ? " [error]" : ""}: ${content.slice(0, 500)}`),
    });
    finalText = result.finalText;
    lastGenerationId = result.lastGenerationId;
    usage.inputTokens = result.inputTokens;
    usage.outputTokens = result.outputTokens;
    costUsd = result.costUsd;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logErr(`OpenRouter run failed: ${msg}`);
    if (api && issueId) {
      try {
        await api.addIssueComment(issueId, { body: `OpenRouter run failed: ${msg}` });
        await api.updateIssue(issueId, { status: "blocked" });
      } catch {
        // ignore secondary failures
      }
    }
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: msg,
      errorCode: "openrouter_error",
      usage,
      model,
      costUsd,
      provider: "openrouter",
      biller: "openrouter",
    };
  }

  // Post the final assistant output and close out the issue.
  if (api && issueId) {
    try {
      await api.addIssueComment(issueId, { body: finalText || "_(No output from agent)_" });
      await api.updateIssue(issueId, { status: "done" });
    } catch (err) {
      log(`Could not finalize issue: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    usage,
    model,
    costUsd,
    provider: "openrouter",
    biller: "openrouter",
    sessionParams: lastGenerationId ? { lastGenerationId } : null,
    sessionDisplayId: lastGenerationId,
    summary: finalText ? finalText.slice(0, 200) : null,
  };
}
