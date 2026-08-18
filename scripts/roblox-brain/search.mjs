#!/usr/bin/env node
/**
 * Roblox Brain — CLI search.
 *
 * Inspects what the retriever actually returns for a query, including the
 * per-signal score breakdown. Built for debugging ranking: if a result looks
 * wrong, this shows whether it came from the symbol index, full-text or the
 * vector branch.
 *
 * Usage:
 *   npm run brain:search -- "how do I detect when a player joins"
 *   npm run brain:search -- "Players.PlayerAdded" --limit 5 --context
 */

import { readFileSync, existsSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { retrieveKnowledge } = await import("@/lib/knowledge/retriever");
const { buildKnowledgeContext } = await import("@/lib/knowledge/context-builder");

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const limitIdx = argv.indexOf("--limit");
const catIdx = argv.indexOf("--category");
const query = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--limit" && argv[i - 1] !== "--category").join(" ");

if (!query) {
  console.error('Usage: npm run brain:search -- "your question" [--limit N] [--category engine-api] [--context] [--deprecated]');
  process.exit(2);
}

const result = await retrieveKnowledge(query, {
  limit: limitIdx >= 0 ? Number(argv[limitIdx + 1]) : 8,
  category: catIdx >= 0 ? argv[catIdx + 1] : undefined,
  includeDeprecated: flags.has("--deprecated"),
  includeCodeExamples: true,
});

console.log(`\nQuery      ${result.query}`);
console.log(`Strategy   ${result.strategy}`);
console.log(`Symbols    ${result.detected_symbols.join(", ") || "(none detected)"}`);
console.log(`Vector     ${result.vector_search_available ? result.embedding_version : "unavailable"}`);
console.log(`Latency    ${result.latency_ms}ms`);
console.log("=".repeat(78));

result.chunks.forEach((c, i) => {
  const s = c.signals;
  console.log(`\n${String(i + 1).padStart(2)}. ${c.title ?? "(untitled)"}`);
  console.log(`    score ${c.score.toFixed(3)}  [sym ${s.exact_symbol.toFixed(2)} | lex ${s.lexical.toFixed(3)} | vec ${s.vector.toFixed(3)} | auth ${s.authority.toFixed(2)}${s.deprecation_penalty < 1 ? " | DEPRECATED" : ""}]`);
  console.log(`    ${c.source_type}  ${c.authority}  ${c.category}${c.semantic_topic ? `  topic=${c.semantic_topic}` : ""}`);
  console.log(`    ${c.source_url ?? c.source_path}`);
  const preview = c.content.replace(/\s+/g, " ").slice(0, 160);
  console.log(`    "${preview}..."`);
});

if (result.code_examples.length) {
  console.log(`\n${"-".repeat(78)}\nCODE EXAMPLES`);
  result.code_examples.forEach((e, i) => {
    console.log(`\n${i + 1}. [${e.language ?? "luau"}] ${e.context ?? ""}  (score ${e.score.toFixed(2)})`);
    console.log(`   ${e.source_url ?? e.source_path}`);
    console.log(`   ${e.code.split("\n").slice(0, 4).map((l) => `   ${l}`).join("\n")}`);
  });
}

if (flags.has("--context")) {
  const ctx = buildKnowledgeContext(result, { maxChunks: 6, maxTokens: 4000 });
  console.log(`\n${"=".repeat(78)}\nASSEMBLED CONTEXT (${ctx.token_estimate} tokens, ${ctx.chunk_count} chunks, truncated=${ctx.truncated})`);
  console.log("=".repeat(78));
  console.log(ctx.text.slice(0, 4000));
  console.log(`\nCITATIONS (${ctx.citations.length}):`);
  for (const c of ctx.citations) {
    console.log(`  - ${c.title}  [${c.authority}, ${c.license}]  ${c.sourceUrl ?? c.sourcePath}`);
  }
}

console.log(`\n${"=".repeat(78)}`);
console.log(`${result.chunks.length} chunks, ${result.code_examples.length} code examples\n`);
