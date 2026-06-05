// Server barrel for the OpenRouter adapter.
//
// Exposes everything the Paperclip server registry needs:
//   - execute          — the agent run loop (OpenRouter tool-calling)
//   - testEnvironment   — env diagnostics + model reachability check
//   - sessionCodec      — persist the last OpenRouter generation id
//   - getConfigSchema   — declarative UI fields (rendered generically)

import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

export { execute } from "./execute.js";
export { testEnvironment, listOpenRouterModels } from "./test.js";
export { getConfigSchema } from "./config-schema.js";

export const sessionCodec: AdapterSessionCodec = {
  deserialize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = (raw as Record<string, unknown>).lastGenerationId;
    return typeof id === "string" && id.length > 0 ? { lastGenerationId: id } : null;
  },
  serialize(params) {
    if (!params || typeof params !== "object") return null;
    const id = (params as Record<string, unknown>).lastGenerationId;
    return typeof id === "string" && id.length > 0 ? { lastGenerationId: id } : null;
  },
  getDisplayId(params) {
    if (!params) return null;
    const id = (params as Record<string, unknown>).lastGenerationId;
    return typeof id === "string" && id.length > 0 ? id : null;
  },
};
