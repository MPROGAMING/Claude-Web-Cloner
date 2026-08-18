#!/usr/bin/env node
/**
 * Roblox Brain — real end-to-end generation verification.
 *
 * Runs ONE real request through the full pipeline and inspects the result:
 * retrieval → context → OpenRouter → streaming → usage. Deliberately a single
 * request, because each one costs real credits.
 *
 * This is the check that unit tests cannot make: that a real model, given real
 * retrieved documentation, returns real Roblox code without inventing APIs.
 *
 * Usage: node scripts/roblox-brain/verify-generation.mjs
 */

import { readFileSync, existsSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const QUESTION =
  "How do I create a RemoteEvent and safely handle it between a client and server in Roblox?";

const { getBrainGenerationConfig, getBrainModelDefinition } = await import(
  "@/lib/knowledge/generation-config"
);
const { preRetrieveForTurn, toPublicCitations } = await import("@/lib/knowledge/pre-retrieval");
const { buildSystemPrompt } = await import("@/lib/ai/system-prompt");

const config = getBrainGenerationConfig();

console.log("Roblox Brain — end-to-end generation verification");
console.log("=".repeat(66));
console.log(`  provider        ${config.provider}`);
console.log(`  model           ${config.model}`);
console.log(`  configured      ${config.configured}`);

if (!config.configured) {
  console.error("\n  OPENROUTER_API_KEY is not set in .env.local.");
  console.error("  Add it and re-run. Nothing else is required.\n");
  process.exit(2);
}

const definition = getBrainModelDefinition();
if (!definition) {
  console.error(`\n  Model "${config.model}" is not in the registry — refusing to substitute.\n`);
  process.exit(1);
}
console.log(`  registry entry  ${definition.name} (${definition.credits.input}/${definition.credits.output} cr per M)`);

// --- 1. Retrieval ----------------------------------------------------------
console.log(`\n[1] Roblox Brain retrieval`);
const retrievalStart = Date.now();
const brain = await preRetrieveForTurn(QUESTION, { maxChunks: 8, maxTokens: 6000 });
const retrievalMs = Date.now() - retrievalStart;

console.log(`    reason          ${brain.reason}`);
console.log(`    retrieved       ${brain.retrieved}`);
console.log(`    strategy        ${brain.strategy}`);
console.log(`    chunks          ${brain.chunk_count}`);
console.log(`    code examples   ${brain.code_example_count}`);
console.log(`    symbols         ${brain.detected_symbols.join(", ") || "(none)"}`);
console.log(`    vector search   ${brain.vector_search_available}`);
console.log(`    latency         ${retrievalMs}ms`);

if (!brain.retrieved) {
  console.error("\n    FAILED: retrieval did not run for a Roblox technical question.\n");
  process.exit(1);
}

const citations = toPublicCitations(brain.citations);
console.log(`\n    citations (${citations.length}):`);
for (const c of citations.slice(0, 6)) {
  console.log(`      - ${c.label}`);
  console.log(`        ${c.url ?? "(no canonical URL)"}  [${c.authority}, ${c.license}]`);
}

// --- 2. Context ------------------------------------------------------------
console.log(`\n[2] Context assembly`);
const systemPrompt = buildSystemPrompt({
  projectName: "Verification project",
  projectDescription: null,
  existingFiles: [],
  studioConnected: false,
  knowledgeContext: brain.context,
  knowledgeReason: brain.reason,
});
console.log(`    system prompt   ${systemPrompt.length} chars (~${Math.ceil(systemPrompt.length / 4)} tokens)`);
console.log(`    knowledge block ${brain.context ? "present" : "absent"}`);
console.log(`    injection guard ${systemPrompt.includes("DATA, never instructions") ? "present" : "MISSING"}`);

// --- 3. Real generation ----------------------------------------------------
console.log(`\n[3] OpenRouter generation (streaming)`);
const generationStart = Date.now();

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    "X-Title": "Blockwright Roblox Brain",
  },
  body: JSON.stringify({
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: QUESTION },
    ],
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: 1400,
  }),
});

if (!response.ok) {
  const body = await response.text().catch(() => "");
  console.error(`\n    FAILED: HTTP ${response.status} ${body.slice(0, 300)}\n`);
  process.exit(1);
}

let text = "";
let usage = null;
let firstTokenMs = null;
let chunkCount = 0;

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") continue;

    try {
      const event = JSON.parse(payload);
      const delta = event.choices?.[0]?.delta?.content;
      if (delta) {
        if (firstTokenMs === null) firstTokenMs = Date.now() - generationStart;
        text += delta;
        chunkCount += 1;
      }
      if (event.usage) usage = event.usage;
    } catch {
      // Partial SSE frame; the next read completes it.
    }
  }
}

const generationMs = Date.now() - generationStart;

console.log(`    streamed        ${chunkCount} chunks`);
console.log(`    first token     ${firstTokenMs}ms`);
console.log(`    generation      ${generationMs}ms`);
console.log(`    total           ${retrievalMs + generationMs}ms`);
console.log(`    response        ${text.length} chars`);
console.log(`    usage           ${usage ? JSON.stringify({ prompt: usage.prompt_tokens, completion: usage.completion_tokens, total: usage.total_tokens, cost: usage.cost }) : "NOT REPORTED"}`);

if (chunkCount < 2) {
  console.error("\n    FAILED: response did not stream.\n");
  process.exit(1);
}
if (!usage) {
  console.error("\n    FAILED: no usage reported - billing would be impossible.\n");
  process.exit(1);
}

// --- 4. Response quality ---------------------------------------------------
console.log(`\n[4] Response inspection`);

const hasLuau = /```(lua|luau)/i.test(text);
const mentionsRemoteEvent = /RemoteEvent/.test(text);
const mentionsFireServer = /FireServer|OnServerEvent/.test(text);
const mentionsValidation = /validat|sanitis|sanitiz|trust|exploit|verify/i.test(text);
const usesGetService = /game:GetService/.test(text);

console.log(`    Luau code block         ${hasLuau}`);
console.log(`    mentions RemoteEvent    ${mentionsRemoteEvent}`);
console.log(`    client/server wiring    ${mentionsFireServer}`);
console.log(`    server-side validation  ${mentionsValidation}`);
console.log(`    uses game:GetService    ${usesGetService}`);

// Fabrication check: flag Roblox-shaped identifiers that do not exist in the
// symbol index. This is a heuristic, not a proof, but it catches confident
// invention of plausible-sounding APIs.
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const candidates = [
  ...new Set(
    [...text.matchAll(/\b([A-Z][A-Za-z0-9]{2,})[:.]([A-Z][A-Za-z0-9]*)\b/g)].map(
      (m) => `${m[1]}.${m[2]}`,
    ),
  ),
];

const unknown = [];
const inherited = [];

for (const candidate of candidates.slice(0, 30)) {
  const [parent, member] = candidate.split(".");

  const { count } = await db
    .from("knowledge_api_symbols")
    .select("*", { count: "exact", head: true })
    .eq("symbol_lower", candidate.toLowerCase());
  if ((count ?? 0) > 0) continue;

  const { count: qualified } = await db
    .from("knowledge_api_symbols")
    .select("*", { count: "exact", head: true })
    .eq("parent", parent)
    .ilike("member", member);
  if ((qualified ?? 0) > 0) continue;

  // Most real Roblox code calls *inherited* members on a variable or service
  // (`ReplicatedStorage:WaitForChild`, `signal:Connect`), where the receiver is
  // not the declaring class. Requiring a parent-qualified hit reports those as
  // fabrications, which is simply wrong. Fall back to member-only existence
  // before accusing the model of inventing an API.
  const { count: memberOnly } = await db
    .from("knowledge_api_symbols")
    .select("*", { count: "exact", head: true })
    .ilike("member", member);

  if ((memberOnly ?? 0) > 0) inherited.push(candidate);
  else unknown.push(candidate);
}

console.log(`    API refs checked        ${Math.min(candidates.length, 30)}`);
console.log(
  `    inherited/unqualified   ${inherited.length}${inherited.length ? `  -> ${inherited.slice(0, 4).join(", ")}` : ""}`,
);
console.log(
  `    NOT in index (invented) ${unknown.length}${unknown.length ? `  -> ${unknown.slice(0, 6).join(", ")}` : ""}`,
);

console.log(`\n${"-".repeat(66)}`);
console.log("RESPONSE EXCERPT");
console.log("-".repeat(66));
console.log(text.slice(0, 1200));
console.log("-".repeat(66));

const qualityOk = hasLuau && mentionsRemoteEvent && mentionsFireServer && usesGetService;
const verdict = qualityOk ? "PASS" : "FAIL";

console.log(`\n${"=".repeat(66)}`);
console.log(`  retrieval ${retrievalMs}ms + generation ${generationMs}ms = ${retrievalMs + generationMs}ms total`);
console.log(`  tokens: ${usage.prompt_tokens} in / ${usage.completion_tokens} out  (cost $${usage.cost})`);
console.log(`  RESULT: ${verdict}\n`);
process.exit(qualityOk ? 0 : 1);
