#!/usr/bin/env node
// Build-time installer: wires the vendored @paperclipai/adapter-openrouter
// package into a freshly-cloned Paperclip tree.
//
//   1. Adds a workspace dependency to server/package.json.
//   2. Patches server/src/adapters/registry.ts to register the adapter as a
//      built-in (imports + ServerAdapterModule entry + registration list).
//
// The adapter package itself is expected to already exist at
//   <paperclip>/packages/adapters/openrouter
// (copied in by the Dockerfile before this script runs).
//
// Idempotent: re-running is a no-op once patched. Fails loudly if an expected
// anchor is missing, so a Paperclip version drift can't silently no-op.

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || "/paperclip";

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, s) {
  fs.writeFileSync(p, s);
  console.log(`[install-openrouter] wrote ${p}`);
}
function fail(msg) {
  console.error(`[install-openrouter] ERROR: ${msg}`);
  process.exit(1);
}

// ── 0. Sanity: adapter package present ──────────────────────────────────────
const pkgDir = path.join(root, "packages/adapters/openrouter");
if (!fs.existsSync(path.join(pkgDir, "package.json"))) {
  fail(`adapter package not found at ${pkgDir}`);
}

// ── 1. server/package.json dependency ───────────────────────────────────────
const serverPkgPath = path.join(root, "server/package.json");
const serverPkg = JSON.parse(read(serverPkgPath));
serverPkg.dependencies ||= {};
if (!serverPkg.dependencies["@paperclipai/adapter-openrouter"]) {
  serverPkg.dependencies["@paperclipai/adapter-openrouter"] = "workspace:*";
  write(serverPkgPath, JSON.stringify(serverPkg, null, 2) + "\n");
} else {
  console.log("[install-openrouter] server dependency already present");
}

// ── 2. Patch the server adapter registry ────────────────────────────────────
const regPath = path.join(root, "server/src/adapters/registry.ts");
let reg = read(regPath);

if (reg.includes("openrouterAdapter")) {
  console.log("[install-openrouter] registry already patched");
} else {
  const importAnchor = `import type { ServerAdapterModule } from "./types.js";`;
  if (!reg.includes(importAnchor)) fail("import anchor not found in registry.ts");
  const imports =
    `\nimport {\n` +
    `  execute as openrouterExecute,\n` +
    `  testEnvironment as openrouterTestEnvironment,\n` +
    `  sessionCodec as openrouterSessionCodec,\n` +
    `  getConfigSchema as openrouterGetConfigSchema,\n` +
    `  listOpenRouterModels as openrouterListModels,\n` +
    `} from "@paperclipai/adapter-openrouter/server";\n` +
    `import {\n` +
    `  type as openrouterType,\n` +
    `  models as openrouterModels,\n` +
    `  agentConfigurationDoc as openrouterAgentConfigurationDoc,\n` +
    `} from "@paperclipai/adapter-openrouter";`;
  reg = reg.replace(importAnchor, importAnchor + imports);

  const constAnchor = `const adaptersByType = new Map<string, ServerAdapterModule>();`;
  if (!reg.includes(constAnchor)) fail("const anchor (adaptersByType) not found in registry.ts");
  const def =
    `const openrouterAdapter: ServerAdapterModule = {\n` +
    `  type: openrouterType,\n` +
    `  execute: openrouterExecute,\n` +
    `  testEnvironment: openrouterTestEnvironment,\n` +
    `  sessionCodec: openrouterSessionCodec,\n` +
    `  models: openrouterModels,\n` +
    `  listModels: () => openrouterListModels(),\n` +
    `  agentConfigurationDoc: openrouterAgentConfigurationDoc,\n` +
    `  getConfigSchema: openrouterGetConfigSchema,\n` +
    `  supportsLocalAgentJwt: true,\n` +
    `};\n\n`;
  reg = reg.replace(constAnchor, def + constAnchor);

  const listAnchor = `    httpAdapter,\n  ]) {`;
  if (!reg.includes(listAnchor)) fail("registration-list anchor (httpAdapter) not found in registry.ts");
  reg = reg.replace(listAnchor, `    httpAdapter,\n    openrouterAdapter,\n  ]) {`);

  write(regPath, reg);
}

console.log("[install-openrouter] done.");
