# OpenRouter adapter (fork addition)

This fork vendors a first-party-style OpenRouter adapter into the Paperclip
build so agents can run on any of OpenRouter's 300+ models.

## What changed vs. upstream template
- `openrouter-adapter/` — the adapter package (`@paperclipai/adapter-openrouter`),
  written against the Paperclip v2026.4xx adapter SDK (`ServerAdapterModule`,
  declarative `getConfigSchema`, OpenRouter OpenAI-compatible tool loop).
- `scripts/install-openrouter-adapter.mjs` — build-time installer that copies the
  adapter into `packages/adapters/openrouter`, adds the server workspace
  dependency, and registers it in `server/src/adapters/registry.ts`.
- `Dockerfile` — runs the installer after cloning upstream and installs with
  `--no-frozen-lockfile` (the new workspace package changes the lockfile).

The UI auto-registers the adapter via its generic schema-driven path
(`SchemaConfigFields`), so no UI/CLI patches are required.

## Configuration
Per-agent config (Hire Agent → adapter type **OpenRouter**): `model`, `apiKey`,
`systemPrompt`, `temperature`, `maxTokens`, `maxTurns`, `autoApprove`.

`apiKey` falls back to the `OPENROUTER_API_KEY` environment variable if omitted.
