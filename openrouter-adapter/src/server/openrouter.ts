// OpenRouter chat-completions tool loop (OpenAI-compatible).
//
// Runs a multi-turn loop: the model is given the Paperclip tool schemas,
// emits tool_calls, we execute them against Paperclip's API, feed results
// back, and continue until the model returns a final text answer, maxTurns
// is hit, or a repeat-call guard trips.

import { OPENROUTER_CHAT_ENDPOINT, OPENROUTER_GENERATION_ENDPOINT } from "../index.js";
import { toolSchemas, findTool, type Tool } from "./tools.js";

export interface RunOptions {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  tools: Tool[];
  maxTurns: number;
  temperature: number;
  maxTokens: number;
  onAssistant?: (text: string) => void;
  onToolCall?: (name: string, args: string) => void;
  onToolResult?: (name: string, content: string, isError: boolean) => void;
}

export interface RunResult {
  finalText: string;
  lastGenerationId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  turns: number;
}

interface ToolCall {
  id: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export async function runOpenRouterAgent(opts: RunOptions): Promise<RunResult> {
  const messages: ChatMessage[] = [];
  if (opts.systemPrompt) messages.push({ role: "system", content: opts.systemPrompt });
  messages.push({ role: "user", content: opts.userPrompt });

  const schemas = toolSchemas(opts.tools);

  let finalText = "";
  let lastGenerationId: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  let turns = 0;

  // Repeat-call guard: stop if the model fires the identical tool+args twice
  // in a row, which usually means it is stuck.
  let lastSignature: string | null = null;
  let repeatCount = 0;

  for (turns = 0; turns < opts.maxTurns; turns++) {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      usage: { include: true },
    };
    if (schemas.length > 0) {
      body.tools = schemas;
      body.tool_choice = "auto";
    }

    const res = await fetch(OPENROUTER_CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://paperclip.ing",
        "X-Title": "Paperclip",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
    }

    const data = (await res.json()) as {
      id?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
      error?: { message?: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message ?? "unknown"}`);
    if (data.id) lastGenerationId = data.id;
    if (data.usage) {
      inputTokens += data.usage.prompt_tokens ?? 0;
      outputTokens += data.usage.completion_tokens ?? 0;
      if (typeof data.usage.cost === "number") costUsd += data.usage.cost;
    }

    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("OpenRouter returned no message in the first choice.");

    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length > 0) {
      messages.push({ role: "assistant", content: message.content ?? null, tool_calls: toolCalls });

      const signature = JSON.stringify(
        toolCalls.map((tc) => `${tc.function?.name}:${tc.function?.arguments}`),
      );
      if (signature === lastSignature) {
        repeatCount += 1;
        if (repeatCount >= 2) {
          throw new Error("Model is stuck repeating the same tool call; aborting run.");
        }
      } else {
        repeatCount = 0;
        lastSignature = signature;
      }

      for (const tc of toolCalls) {
        const name = tc.function?.name ?? "";
        const argStr = tc.function?.arguments ?? "{}";
        opts.onToolCall?.(name, argStr);

        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(argStr) as Record<string, unknown>;
        } catch {
          parsed = {};
        }

        const tool = findTool(opts.tools, name);
        let content: string;
        let isError = false;
        if (!tool) {
          content = JSON.stringify({ error: `Unknown tool: ${name}` });
          isError = true;
        } else {
          const result = await tool.execute(parsed);
          content = result.content;
          isError = result.isError;
        }

        opts.onToolResult?.(name, content, isError);
        messages.push({ role: "tool", tool_call_id: tc.id, name, content });
      }
      continue;
    }

    // No tool calls — this is the final answer.
    finalText = typeof message.content === "string" ? message.content : "";
    if (finalText) opts.onAssistant?.(finalText);
    break;
  }

  // Best-effort cost backfill from the generation endpoint when the inline
  // usage block didn't carry a cost.
  if (costUsd === 0 && lastGenerationId) {
    try {
      const r = await fetch(
        `${OPENROUTER_GENERATION_ENDPOINT}?id=${encodeURIComponent(lastGenerationId)}`,
        { headers: { Authorization: `Bearer ${opts.apiKey}` } },
      );
      if (r.ok) {
        const d = (await r.json()) as { data?: { total_cost?: number } };
        costUsd = d.data?.total_cost ?? 0;
      }
    } catch {
      // ignore — cost is best-effort
    }
  }

  return { finalText, lastGenerationId, inputTokens, outputTokens, costUsd, turns: turns + 1 };
}
