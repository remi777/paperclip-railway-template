// Declarative config schema. The Paperclip UI renders these fields generically
// via SchemaConfigFields, so no React component ships with this adapter.

import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";
import { models, DEFAULT_MODEL } from "../index.js";

export function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "apiKey",
        label: "OpenRouter API Key",
        type: "text",
        required: false,
        hint: "sk-or-v1-… Get one at https://openrouter.ai/keys. Falls back to the OPENROUTER_API_KEY env var.",
      },
      {
        key: "model",
        label: "Model",
        type: "combobox",
        required: true,
        default: DEFAULT_MODEL,
        options: models.map((m) => ({ value: m.id, label: m.label })),
        hint: 'Any OpenRouter model id. Use "openrouter/auto" for auto-routing or append ":free" for free tier.',
      },
      {
        key: "systemPrompt",
        label: "System Prompt",
        type: "textarea",
        required: false,
        hint: "Optional. Prepended to every run.",
      },
      {
        key: "temperature",
        label: "Temperature",
        type: "number",
        default: 0.7,
        hint: "Sampling temperature 0–2.",
      },
      {
        key: "maxTokens",
        label: "Max Tokens",
        type: "number",
        default: 4096,
        hint: "Max completion tokens per turn.",
      },
      {
        key: "maxTurns",
        label: "Max Tool Turns",
        type: "number",
        default: 25,
        hint: "Maximum tool-calling turns per run.",
      },
      {
        key: "autoApprove",
        label: "Auto-approve hires",
        type: "toggle",
        default: false,
        hint: "When off, hire_agent and similar actions are routed through Paperclip's approval system.",
      },
    ],
  };
}
