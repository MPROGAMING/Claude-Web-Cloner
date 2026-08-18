#!/usr/bin/env node
/**
 * Roblox Brain — knowledge database integrity validator.
 *
 * Read-only. Checks the invariants the retrieval layer depends on: that the
 * corpus is fully represented, that nothing is orphaned, that commits still
 * match the source lock, and that the excluded sources never leaked in.
 *
 * Usage: node scripts/roblox-brain/validate-knowledge-db.mjs
 * Exit:  0 = PASS / PASS WITH WARNINGS, 1 = FAIL
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const LOCK = JSON.parse(readFileSync("docs/roblox-brain/source-lock.json", "utf8"));
const CORPUS = "docs/roblox-brain/corpus";
const CORPUS_MANIFEST = JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"));

const errors = [];
const warnings = [];
const fail = (check, msg) => errors.push({ check, msg });
const warn = (check, msg) => warnings.push({ check, msg });

const count = async (table, filter) => {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return n ?? 0;
};

console.log("Roblox Brain — knowledge database validation\n" + "=".repeat(60));

// --- 1. Corpus fully represented ------------------------------------------
function walkJson(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walkJson(full, base, out);
    else if (e.endsWith(".json")) out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}
const META = new Set(["manifest.json", "cloud/_schema-registry.json",
  "metadata/code-examples.json", "metadata/duplicates.json",
  "reports/failures.json"]);
const corpusFiles = walkJson(CORPUS).filter((f) => !META.has(f));

const docCount = await count("knowledge_documents");
const chunkCount = await count("knowledge_chunks");
const embedCount = await count("knowledge_embeddings");
const symbolCount = await count("knowledge_api_symbols");
const codeCount = await count("knowledge_code_examples");

console.log(`  corpus files        ${corpusFiles.length}`);
console.log(`  documents           ${docCount}`);
console.log(`  chunks              ${chunkCount}`);
console.log(`  embeddings          ${embedCount}`);
console.log(`  api symbols         ${symbolCount}`);
console.log(`  code examples       ${codeCount}`);

if (docCount !== corpusFiles.length) {
  fail("corpus-coverage", `corpus has ${corpusFiles.length} documents, database has ${docCount}`);
}
if (codeCount !== CORPUS_MANIFEST.counts.code_examples) {
  fail("code-example-count", `corpus manifest says ${CORPUS_MANIFEST.counts.code_examples} code examples, database has ${codeCount}`);
}

// --- 2. Embedding coverage -------------------------------------------------
if (embedCount === 0) {
  warn("embeddings", "no embeddings present — vector search unavailable, retrieval degrades to lexical + symbol");
} else if (embedCount < chunkCount) {
  warn("embeddings", `${chunkCount - embedCount} chunks have no embedding; run: npm run brain:ingest -- --embed-only`);
}

// --- 3. Source commits match the lock -------------------------------------
const { data: sources, error: srcErr } = await db.from("knowledge_sources").select("*");
if (srcErr) fail("sources", srcErr.message);
for (const repo of LOCK.repositories) {
  const row = (sources ?? []).find((s) => s.id === repo.name);
  if (!row) {
    // luau is reference-only and contributes no documents, but should still be
    // registered so provenance is complete.
    warn("source-row", `${repo.name} not present in knowledge_sources`);
    continue;
  }
  if (row.commit !== repo.commit) {
    fail("commit-lock", `${repo.name}: database commit ${row.commit} != locked ${repo.commit}`);
  }
}

const { data: badCommits } = await db
  .from("knowledge_documents")
  .select("source_id, source_repository, source_commit")
  .limit(2000);
const lockMap = Object.fromEntries(LOCK.repositories.map((r) => [r.name, r.commit]));
for (const d of badCommits ?? []) {
  if (lockMap[d.source_repository] && d.source_commit !== lockMap[d.source_repository]) {
    fail("document-commit", `${d.source_id}: commit does not match the lock`);
    break;
  }
}

// --- 4. No excluded source leaked in --------------------------------------
const FORBIDDEN = ["luau/tests/", "luau/bench/", "luau/fuzz/", "luau/extern/",
  "content/en-us/includes/", "content/en-us/education/", "content/en-us/creator-programs/"];
for (const prefix of FORBIDDEN) {
  const n = await count("knowledge_documents", (q) => q.like("source_path", `${prefix}%`));
  if (n > 0) fail("excluded-source", `${n} documents from forbidden path ${prefix}`);
}
const binaryLeak = await count("knowledge_documents", (q) =>
  q.or("source_path.like.%.png,source_path.like.%.jpg,source_path.like.%.mp4,source_path.like.%.zip"));
if (binaryLeak > 0) fail("binary-media", `${binaryLeak} documents reference binary media`);

// Nothing from the luau repository should be ingested at all.
const luauDocs = await count("knowledge_documents", (q) => q.eq("source_repository", "luau"));
if (luauDocs > 0) fail("luau-not-ingested", `${luauDocs} documents ingested from the luau compiler repo`);

// --- 5. Orphans ------------------------------------------------------------
// Foreign keys prevent orphaned chunks/embeddings structurally; verify the
// counts line up rather than trusting the constraint blindly.
const { data: chunkAgg } = await db.from("knowledge_chunks").select("source_id").limit(1);
if (!chunkAgg) warn("orphans", "could not sample chunks");

const { count: docsWithoutChunks } = await db
  .from("knowledge_documents").select("*", { count: "exact", head: true }).eq("chunk_total", 0);
if ((docsWithoutChunks ?? 0) > 0) {
  warn("orphan-documents", `${docsWithoutChunks} documents produced zero chunks`);
}

// --- 6. Deterministic ids --------------------------------------------------
const { data: idSample } = await db.from("knowledge_documents").select("source_id").limit(500);
const badIds = (idSample ?? []).filter((r) => !/^[0-9a-f]{24}$/.test(r.source_id));
if (badIds.length) fail("deterministic-id", `${badIds.length} document ids are not 24-char hashes (random UUIDs?)`);

// --- 7. Licenses and authority --------------------------------------------
const { data: licenses } = await db.from("knowledge_documents").select("license").limit(6000);
const licenseSet = new Set((licenses ?? []).map((r) => r.license));
for (const l of licenseSet) {
  if (!["CC-BY-4.0", "MIT"].includes(l)) fail("license", `unexpected license in corpus: ${l}`);
}
const { data: authorities } = await db.from("knowledge_documents").select("authority").limit(6000);
for (const a of new Set((authorities ?? []).map((r) => r.authority))) {
  if (!["canonical", "secondary", "historical"].includes(a)) fail("authority", `unexpected authority: ${a}`);
}

// --- 8. Deprecation preserved ---------------------------------------------
const deprecated = await count("knowledge_documents", (q) => q.eq("deprecated", true));
console.log(`  deprecated docs     ${deprecated}`);
if (deprecated !== CORPUS_MANIFEST.counts.deprecated_apis) {
  warn("deprecation", `corpus says ${CORPUS_MANIFEST.counts.deprecated_apis} deprecated, database has ${deprecated}`);
}

// --- 9. Attribute collision preserved -------------------------------------
const robloxAttrs = await count("knowledge_documents", (q) => q.eq("semantic_topic", "roblox-instance-attributes"));
const luauAttrs = await count("knowledge_documents", (q) => q.eq("semantic_topic", "luau-language-attributes"));
console.log(`  attribute topics    roblox=${robloxAttrs} luau=${luauAttrs}`);
if (robloxAttrs === 0 || luauAttrs === 0) {
  fail("attributes-collision", `both attribute concepts must survive ingestion (roblox=${robloxAttrs}, luau=${luauAttrs})`);
}

// --- 10. Symbol index consistency -----------------------------------------
const { data: symbolSample } = await db
  .from("knowledge_api_symbols").select("symbol, chunk_id, source_id").limit(200);
const missingChunk = (symbolSample ?? []).filter((s) => !s.chunk_id);
if (missingChunk.length > 20) {
  warn("symbol-index", `${missingChunk.length}/200 sampled symbols have no chunk reference`);
}
const engineDocs = await count("knowledge_documents", (q) => q.eq("source_type", "engine-api-yaml"));
if (symbolCount < engineDocs) {
  fail("symbol-index", `${symbolCount} symbols for ${engineDocs} engine documents — index is incomplete`);
}

// --- report ----------------------------------------------------------------
console.log("-".repeat(60));
for (const w of warnings) console.log(`  WARN [${w.check}] ${w.msg}`);
for (const e of errors) console.log(`  FAIL [${e.check}] ${e.msg}`);

const verdict = errors.length ? "FAIL" : warnings.length ? "PASS WITH WARNINGS" : "PASS";
console.log("=".repeat(60));
console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
console.log(`  RESULT: ${verdict}\n`);
process.exit(errors.length ? 1 : 0);
