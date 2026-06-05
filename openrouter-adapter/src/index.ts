// ─────────────────────────────────────────────────────────────────
// @paperclipai/adapter-openrouter — Root metadata (src/index.ts)
// Shared across server entry points — keep dependency-free.
// ─────────────────────────────────────────────────────────────────

import type { AdapterModel } from "@paperclipai/adapter-utils";

export const type = "openrouter" as const;
export const label = "OpenRouter";

export const DEFAULT_MODEL = "openrouter/auto";

// Static fallback model list (shown when the live list is unavailable).
export const models: AdapterModel[] = [
  // Auto + free tier
  { id: "openrouter/auto", label: "Auto (best route)" },
  { id: "meta-llama/llama-4-maverick:free", label: "Llama 4 Maverick (free)" },
  { id: "meta-llama/llama-4-scout:free", label: "Llama 4 Scout (free)" },
  { id: "google/gemma-3-27b-it:free", label: "Gemma 3 27B (free)" },
  { id: "deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3 0324 (free)" },
  { id: "qwen/qwen3-235b-a22b:free", label: "Qwen3 235B (free)" },
  { id: "openai/gpt-oss-120b:free", label: "gpt-oss 120B (free)" },
  // Paid — strong tool-calling
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { id: "openai/gpt-4.1", label: "GPT-4.1" },
  { id: "openai/gpt-4.1-mini", label: "GPT-4.1 mini" },
  { id: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-2.5-pro-preview", label: "Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "mistralai/mistral-medium-3", label: "Mistral Medium 3" },
];

// OpenRouter API endpoints (OpenAI-compatible).
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODELS_ENDPOINT = `${OPENROUTER_BASE_URL}/models`;
export const OPENROUTER_CHAT_ENDPOINT = `${OPENROUTER_BASE_URL}/chat/completions`;
export const OPENROUTER_GENERATION_ENDPOINT = `${OPENROUTER_BASE_URL}/generation`;

export const agentConfigurationDoc = `# OpenRouter adapter configuration

## Use when
- You want access to 300+ models (free AND paid) from a single API key.
- You want OpenRouter auto-routing for cost-optimized inference.
- You need models not available via the native local adapters.

## Core fields
- \`model\` (string) — OpenRouter model id, e.g. "openai/gpt-4o-mini" or "openrouter/auto".
  Append ":free" to any model id for free-tier routing.
- \`apiKey\` (string) — OpenRouter API key (sk-or-v1-...). Falls back to the
  OPENROUTER_API_KEY environment variable when omitted.
- \`systemPrompt\` (string, optional) — prepended to every run.
- \`temperature\` (number, optional, default 0.7).
- \`maxTokens\` (number, optional, default 4096).
- \`maxTurns\` (number, optional, default 25) — max tool-calling turns per run.
- \`autoApprove\` (boolean, optional, default false) — when false, hire_agent
  and similar mutating tools are routed through Paperclip's approval system.

## Tools
The agent has the Paperclip API tools: get_issue, update_issue_status,
add_comment, list_comments, create_sub_issue, list_issues, list_agents,
hire_agent, request_approval. Every action is attributed to this agent.
`;

export interface OpenRouterConfig {
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  maxTurns?: number;
  autoApprove?: boolean;
}
