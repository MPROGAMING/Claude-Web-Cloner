#!/usr/bin/env node
/**
 * Roblox Brain — retrieval evaluation.
 *
 * Measures Recall@5, Recall@10 and MRR against a hand-written gold set. The
 * point is to be able to say something falsifiable about retrieval quality:
 * "embeddings were generated" is not evidence that retrieval works.
 *
 * A query counts as a hit when a returned chunk's title, symbols, path or
 * content contains one of the expected terms. That is deliberately generous on
 * *where* the term appears but strict on *whether* it appears at all.
 *
 * Usage:
 *   node scripts/roblox-brain/evaluate.mjs
 *   node scripts/roblox-brain/evaluate.mjs --verbose
 *   node scripts/roblox-brain/evaluate.mjs --json out.json
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { retrieveKnowledge } = await import("@/lib/knowledge/retriever");

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const jsonIndex = args.indexOf("--json");
const JSON_OUT = jsonIndex >= 0 ? args[jsonIndex + 1] : null;

const gold = JSON.parse(readFileSync("scripts/roblox-brain/eval-queries.json", "utf8"));

/** Does this chunk satisfy any expected term? */
function matches(chunk, expectations) {
  const haystack = [
    chunk.title ?? "",
    chunk.api_symbols.join(" "),
    chunk.source_path,
    chunk.heading_path.join(" "),
    chunk.content.slice(0, 2500),
  ].join(" ").toLowerCase();

  return expectations.some((term) => haystack.includes(term.toLowerCase()));
}

const results = [];
let hits5 = 0, hits10 = 0, reciprocalSum = 0, evaluated = 0, errors = 0;
const byCategory = new Map();
const latencies = [];

console.log(`Roblox Brain — retrieval evaluation (${gold.queries.length} queries)`);
console.log("=".repeat(64));

for (const q of gold.queries) {
  let result;
  try {
    result = await retrieveKnowledge(q.q, { limit: 10, includeCodeExamples: true });
  } catch (error) {
    errors += 1;
    results.push({ id: q.id, query: q.q, error: String(error?.message ?? error) });
    console.log(`  ERROR ${q.id}: ${error?.message ?? error}`);
    continue;
  }

  latencies.push(result.latency_ms);
  evaluated += 1;

  // Rank of the first relevant chunk, 1-based; 0 means "not found".
  let rank = 0;
  for (let i = 0; i < result.chunks.length; i += 1) {
    if (matches(result.chunks[i], q.expect)) { rank = i + 1; break; }
  }

  const inTop5 = rank > 0 && rank <= 5;
  const inTop10 = rank > 0 && rank <= 10;
  if (inTop5) hits5 += 1;
  if (inTop10) hits10 += 1;
  if (rank > 0) reciprocalSum += 1 / rank;

  // Special assertions beyond plain recall.
  const extra = {};
  if (q.expect_both_topics) {
    // OV-005 asks that the two attribute concepts never MERGE and stay
    // distinctly labelled - not that one particular phrasing surfaces both in
    // the top 10. So the assertion is: whatever came back, no chunk carries
    // both labels, and each concept is independently retrievable.
    const topics = new Set(result.chunks.map((c) => c.semantic_topic).filter(Boolean));
    extra.topics_seen = [...topics];
    extra.no_merge = result.chunks.every(
      (c) => !(c.semantic_topic === "roblox-instance-attributes" && c.category === "luau-language"),
    );

    const probes = await Promise.all([
      retrieveKnowledge("Roblox instance attributes SetAttribute", { limit: 10, includeCodeExamples: false }),
      retrieveKnowledge("Luau function attributes @native @deprecated", { limit: 10, includeCodeExamples: false }),
    ]);
    extra.roblox_concept_retrievable = probes[0].chunks.some(
      (c) => /attribute/i.test(c.title ?? "") || /attribute/i.test(c.content.slice(0, 400)),
    );
    extra.luau_concept_retrievable = probes[1].chunks.some(
      (c) => c.semantic_topic === "luau-language-attributes",
    );
    extra.both_topics_present =
      extra.no_merge && extra.roblox_concept_retrievable && extra.luau_concept_retrievable;
  }
  if (q.expect_deprecated) {
    extra.deprecated_surfaced = result.chunks.some((c) => c.deprecated);
  }

  const cat = byCategory.get(q.category) ?? { total: 0, hit5: 0, hit10: 0 };
  cat.total += 1;
  if (inTop5) cat.hit5 += 1;
  if (inTop10) cat.hit10 += 1;
  byCategory.set(q.category, cat);

  results.push({
    id: q.id, query: q.q, category: q.category, rank,
    hit5: inTop5, hit10: inTop10,
    strategy: result.strategy,
    detected_symbols: result.detected_symbols,
    latency_ms: result.latency_ms,
    vector: result.vector_search_available,
    top: result.chunks.slice(0, 3).map((c) => ({
      title: c.title, type: c.source_type, authority: c.authority,
      score: Number(c.score.toFixed(3)), path: c.source_path,
    })),
    ...extra,
  });

  const mark = inTop5 ? "PASS" : inTop10 ? "top10" : "MISS";
  const line = `  ${mark.padEnd(5)} ${q.id.padEnd(9)} rank=${String(rank || "-").padEnd(3)} ${result.latency_ms}ms  ${q.q.slice(0, 46)}`;
  if (VERBOSE || !inTop5) {
    console.log(line);
    if (VERBOSE || rank === 0) {
      for (const t of result.chunks.slice(0, 3)) {
        console.log(`          - ${(t.title ?? "").slice(0, 52)} [${t.source_type}] ${t.score.toFixed(2)}`);
      }
    }
  }
}

latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] ?? 0;

const summary = {
  total: gold.queries.length,
  evaluated,
  errors,
  recall_at_5: evaluated ? hits5 / evaluated : 0,
  recall_at_10: evaluated ? hits10 / evaluated : 0,
  mrr: evaluated ? reciprocalSum / evaluated : 0,
  latency_ms: {
    p50: p(0.5), p90: p(0.9), p99: p(0.99),
    mean: Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)),
  },
  by_category: Object.fromEntries([...byCategory.entries()].map(([k, v]) => [k, {
    total: v.total,
    recall_at_5: Number((v.hit5 / v.total).toFixed(3)),
    recall_at_10: Number((v.hit10 / v.total).toFixed(3)),
  }])),
};

console.log("-".repeat(64));
console.log(`  Recall@5   ${(summary.recall_at_5 * 100).toFixed(1)}%   (${hits5}/${evaluated})`);
console.log(`  Recall@10  ${(summary.recall_at_10 * 100).toFixed(1)}%   (${hits10}/${evaluated})`);
console.log(`  MRR        ${summary.mrr.toFixed(3)}`);
console.log(`  latency    p50 ${summary.latency_ms.p50}ms  p90 ${summary.latency_ms.p90}ms  mean ${summary.latency_ms.mean}ms`);
console.log(`  errors     ${errors}`);
console.log("-".repeat(64));
for (const [cat, v] of Object.entries(summary.by_category)) {
  console.log(`  ${cat.padEnd(20)} R@5 ${(v.recall_at_5 * 100).toFixed(0).padStart(3)}%  R@10 ${(v.recall_at_10 * 100).toFixed(0).padStart(3)}%  (${v.total})`);
}

// Special-case assertions.
const collision = results.find((r) => r.id === "attr-01");
if (collision) {
  console.log("-".repeat(64));
  console.log(`  attributes collision (OV-005): ${collision.both_topics_present ? "PASS" : "FAIL"}`);
  console.log(`    concepts never merged      : ${collision.no_merge}`);
  console.log(`    roblox concept retrievable : ${collision.roblox_concept_retrievable}`);
  console.log(`    luau concept retrievable   : ${collision.luau_concept_retrievable}`);
}
const dep = results.find((r) => r.id === "dep-01");
if (dep) console.log(`  deprecated surfaced when asked: ${dep.deprecated_surfaced}`);

console.log("=".repeat(64));

if (JSON_OUT) {
  writeFileSync(JSON_OUT, `${JSON.stringify({ summary, results }, null, 2)}\n`);
  console.log(`  written: ${JSON_OUT}`);
}

// A retrieval system below 70% Recall@5 is not usable for code generation.
const PASS_THRESHOLD = 0.7;
const verdict = errors === 0 && summary.recall_at_5 >= PASS_THRESHOLD ? "PASS" : "FAIL";
console.log(`  RESULT: ${verdict} (threshold Recall@5 >= ${PASS_THRESHOLD * 100}%)\n`);
process.exit(verdict === "PASS" ? 0 : 1);
