#!/usr/bin/env node
/**
 * Roblox Brain — corpus ingestion into Postgres.
 *
 * Streams the local corpus into knowledge_* tables, builds the API symbol
 * index, then generates embeddings in a resumable second pass.
 *
 * Resumability matters here: embedding 20k chunks costs money and time, so a
 * crash at 90% must not restart from zero. Chunks already carrying an embedding
 * for the active version are skipped.
 *
 * Usage:
 *   node scripts/roblox-brain/ingest.mjs               full ingest + embeddings
 *   node scripts/roblox-brain/ingest.mjs --no-embed    structure only
 *   node scripts/roblox-brain/ingest.mjs --embed-only  resume embeddings
 *   node scripts/roblox-brain/ingest.mjs --incremental only changed documents
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local without a dependency.
for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const CORPUS = "docs/roblox-brain/corpus";
const LOCK = JSON.parse(readFileSync("docs/roblox-brain/source-lock.json", "utf8"));

const args = new Set(process.argv.slice(2));
const NO_EMBED = args.has("--no-embed");
const EMBED_ONLY = args.has("--embed-only");
const INCREMENTAL = args.has("--incremental");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// --- shared libraries -----------------------------------------------------
// Imported straight from src/lib/knowledge via the ts-loader hook, so chunking
// and symbol detection have exactly one implementation.
const { chunkDocument } = await import("@/lib/knowledge/chunker");
const symbols = await import("@/lib/knowledge/symbols");
const embeddings = await import("@/lib/knowledge/embeddings");

// ---------------------------------------------------------------------------
function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, base, out);
    else if (e.endsWith(".json")) out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

// Registry and report files are corpus *outputs*, not documents.
const META = new Set(["manifest.json", "cloud/_schema-registry.json",
  "metadata/code-examples.json", "metadata/duplicates.json",
  "reports/failures.json"]);

const report = {
  started_at: new Date().toISOString(),
  documents: 0, chunks: 0, api_symbols: 0, code_examples: 0,
  embedded: 0, embed_skipped: 0, failures: [], warnings: [],
};

const fail = (path, error) => report.failures.push({ path, error: String(error?.message ?? error) });

/**
 * Defensive within-batch dedupe. Postgres rejects an upsert that touches the
 * same conflict target twice in one statement, so the batch must be unique on
 * the natural key before it is sent.
 */
function dedupeSymbols(rows) {
  const seen = new Map();
  for (const r of rows) seen.set(`${r.source_id}|${r.symbol}|${r.symbol_kind}|${r.chunk_id}`, r);
  return [...seen.values()];
}

async function upsertChunked(table, rows, conflict, batch = 500) {
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch);
    const { error } = await db.from(table).upsert(slice, { onConflict: conflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// ===========================================================================
// 1. Sources
// ===========================================================================
async function ingestSources() {
  const rows = LOCK.repositories.map((r) => ({
    id: r.name,
    remote: r.remote,
    branch: r.branch,
    commit: r.commit,
    commit_date: r.commit_date,
    license: r.license.content,
    attribution_required: Boolean(r.license.attribution_required),
    retrieved_at: r.retrieved_at,
  }));
  await upsertChunked("knowledge_sources", rows, "id");
  console.log(`  sources: ${rows.length}`);
}

// ===========================================================================
// 2. Documents, chunks, symbol index
// ===========================================================================
function symbolKindFor(memberKey) {
  return { properties: "property", methods: "method", events: "event",
    callbacks: "callback", functions: "function", items: "item" }[memberKey] ?? "member";
}

async function ingestDocuments() {
  const files = walk(CORPUS).filter((f) => !META.has(f));
  console.log(`  corpus files: ${files.length}`);

  // Incremental mode compares content hashes so unchanged docs are untouched.
  let existingHashes = new Map();
  if (INCREMENTAL) {
    let from = 0;
    for (;;) {
      const { data, error } = await db.from("knowledge_documents")
        .select("source_id, content_hash").range(from, from + 999);
      if (error) throw new Error(error.message);
      if (!data?.length) break;
      for (const row of data) existingHashes.set(row.source_id, row.content_hash);
      if (data.length < 1000) break;
      from += 1000;
    }
    console.log(`  existing documents: ${existingHashes.size}`);
  }

  let docBatch = [];
  let chunkBatch = [];
  let symbolBatch = [];
  let processed = 0, unchanged = 0;

  const flush = async (force = false) => {
    if (force || docBatch.length >= 200) {
      if (docBatch.length) { await upsertChunked("knowledge_documents", docBatch, "source_id"); docBatch = []; }
      if (chunkBatch.length) { await upsertChunked("knowledge_chunks", chunkBatch, "id"); chunkBatch = []; }
      if (symbolBatch.length) { await upsertChunked("knowledge_api_symbols", dedupeSymbols(symbolBatch), "source_id,symbol,symbol_kind,chunk_id"); symbolBatch = []; }
    }
  };

  for (const rel of files) {
    let doc;
    try { doc = JSON.parse(readFileSync(join(CORPUS, rel), "utf8")); }
    catch (err) { fail(rel, err); continue; }

    const contentHash = doc.content_hash
      ?? Buffer.from(JSON.stringify(doc.content ?? doc.api ?? doc.openapi ?? "")).toString("base64").slice(0, 44);

    if (INCREMENTAL && existingHashes.get(doc.source_id) === contentHash) { unchanged += 1; continue; }

    let chunks;
    try { chunks = chunkDocument(doc); }
    catch (err) { fail(rel, err); continue; }
    if (!chunks.length) { report.warnings.push({ path: rel, message: "produced no chunks" }); continue; }

    docBatch.push({
      source_id: doc.source_id,
      source_repository: doc.source_repository,
      source_commit: doc.source_commit,
      source_path: doc.source_path,
      source_url: doc.source_url ?? null,
      source_type: doc.source_type,
      authority: doc.authority,
      license: doc.license,
      retrieved_at: doc.retrieved_at,
      content_date: doc.content_date,
      category: doc.category,
      topic: doc.topic,
      semantic_topic: doc.semantic_topic ?? null,
      deprecated: Boolean(doc.deprecated),
      title: doc.title ?? null,
      heading_path: doc.heading_path ?? null,
      structured: Boolean(doc.structured),
      payload: doc,
      content_hash: contentHash,
      chunk_total: chunks.length,
    });

    for (const c of chunks) {
      const chunkId = `${doc.source_id}:${c.chunk_index}`;
      chunkBatch.push({
        id: chunkId,
        source_id: doc.source_id,
        chunk_index: c.chunk_index,
        chunk_total: chunks.length,
        source_repository: doc.source_repository,
        source_type: doc.source_type,
        authority: doc.authority,
        category: doc.category,
        semantic_topic: doc.semantic_topic ?? null,
        deprecated: Boolean(doc.deprecated),
        title: c.title,
        heading_path: c.heading_path,
        heading_text: c.heading_path.join(" "),
        api_symbols: c.api_symbols,
        symbols_text: c.api_symbols.join(" "),
        content: c.content,
        token_estimate: c.token_estimate,
      });
      report.chunks += 1;
    }

    // Symbol index, built from the structured Engine API rather than guessed
    // from prose — this is what makes exact lookup reliable.
    if (doc.source_type === "engine-api-yaml" && doc.api) {
      const api = doc.api;
      const name = String(api.name ?? doc.title ?? "");
      const partition = (doc.source_path.split("/")[4]) ?? null;
      symbolBatch.push({
        symbol: name, symbol_lower: name.toLowerCase(), parent: null, member: null,
        symbol_kind: String(api.type ?? "class"), partition,
        source_id: doc.source_id, chunk_id: `${doc.source_id}:0`,
        deprecated: Boolean(doc.deprecated),
        summary: api.summary ? String(api.summary).slice(0, 500) : null,
      });
      report.api_symbols += 1;

      let idx = 1;
      for (const key of ["properties","methods","events","callbacks","functions","items"]) {
        if (!Array.isArray(api[key])) continue;
        for (const m of api[key]) {
          const raw = String(m.name ?? "");
          if (!raw) { idx += 1; continue; }
          const qualified = raw.includes(".") || raw.includes(":") ? raw : `${name}.${raw}`;
          const member = raw.includes(".") ? raw.split(".").pop() : raw.includes(":") ? raw.split(":").pop() : raw;
          symbolBatch.push({
            symbol: qualified, symbol_lower: qualified.toLowerCase(),
            parent: name, member, symbol_kind: symbolKindFor(key), partition,
            source_id: doc.source_id, chunk_id: `${doc.source_id}:${idx}`,
            deprecated: Boolean(m.deprecated) || Boolean(doc.deprecated),
            summary: m.summary ? String(m.summary).slice(0, 500) : null,
          });
          report.api_symbols += 1;
          idx += 1;
        }
      }
    }

    report.documents += 1;
    processed += 1;
    if (processed % 1000 === 0) console.log(`    ${processed} documents...`);
    await flush();
  }

  await flush(true);
  if (INCREMENTAL) console.log(`  unchanged (skipped): ${unchanged}`);
  console.log(`  documents: ${report.documents}  chunks: ${report.chunks}  symbols: ${report.api_symbols}`);
}

// ===========================================================================
// 3. Code examples
// ===========================================================================
async function ingestCodeExamples() {
  const path = join(CORPUS, "metadata", "code-examples.json");
  if (!existsSync(path)) { report.warnings.push({ path, message: "no code example registry" }); return; }
  const reg = JSON.parse(readFileSync(path, "utf8"));

  // PostgREST caps an unbounded select at 1000 rows. Paginating matters: a
  // truncated id set makes every later example look orphaned and silently
  // drops it.
  const knownIds = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("knowledge_documents")
      .select("source_id").order("source_id").range(from, from + 999);
    if (error) throw new Error(`document id scan: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) knownIds.add(row.source_id);
    if (data.length < 1000) break;
  }

  const rows = [];
  for (const ex of reg.examples) {
    // A code example must hang off a document that exists, or the FK fails.
    if (!knownIds.has(ex.source_id)) { report.warnings.push({ path: ex.source_path, message: `orphan code example ${ex.example_id}` }); continue; }
    const syms = symbols.extractIndexableSymbols(`${ex.context ?? ""} ${ex.code}`, 30);
    rows.push({
      example_id: ex.example_id,
      source_id: ex.source_id,
      source_repository: ex.source_repository,
      source_commit: ex.source_commit,
      source_path: ex.source_path,
      source_url: ex.source_url ?? null,
      language: ex.language ?? null,
      code: ex.code,
      context: ex.context ?? null,
      authority: ex.authority,
      license: ex.license,
      api_symbols: syms,
      symbols_text: syms.join(" "),
    });
  }
  await upsertChunked("knowledge_code_examples", rows, "example_id");
  report.code_examples = rows.length;
  console.log(`  code examples: ${rows.length}`);
}

// ===========================================================================
// 4. Embeddings (resumable)
// ===========================================================================
async function generateEmbeddings() {
  const config = embeddings.getEmbeddingConfig();
  if (!embeddings.isEmbeddingConfigured(config)) {
    report.warnings.push({ path: "-", message: "No embedding API key configured; vector search will be unavailable." });
    console.log("  embeddings: SKIPPED (no API key configured)");
    return;
  }

  console.log(`  embedding provider: ${config.provider} / ${config.model} (${config.dimensions}d)`);
  console.log(`  embedding version : ${config.version}`);

  // Resume: ask Postgres for chunks lacking an embedding at THIS version.
  // Done as a server-side anti-join — passing thousands of ids back through
  // PostgREST's query string overflows the URL and returns 400.
  const pending = [];
  let after = "";
  for (;;) {
    const { data, error } = await db.rpc("knowledge_pending_chunks", {
      p_version: config.version, p_limit: 1000, p_after: after,
    });
    if (error) throw new Error(`pending scan: ${error.message}`);
    if (!data?.length) break;
    pending.push(...data);
    after = data[data.length - 1].id;
    if (data.length < 1000) break;
  }
  const { count: totalChunks } = await db.from("knowledge_chunks").select("*", { count: "exact", head: true });
  report.embed_skipped = (totalChunks ?? 0) - pending.length;

  console.log(`  chunks to embed: ${pending.length} (already done: ${report.embed_skipped})`);
  if (!pending.length) return;

  // Prefix title/symbols so the vector reflects what the chunk is ABOUT, not
  // just its prose.
  const texts = pending.map((c) =>
    [c.title, c.symbols_text, c.content].filter(Boolean).join("\n").slice(0, 8000));

  const started = Date.now();
  await embeddings.embedTexts(texts, {
    config,
    onProgress: (done, total) => {
      if (done % (config.batchSize * 8) === 0 || done === total) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`    embedded ${done}/${total}  (${rate.toFixed(0)}/s)`);
      }
    },
    // Persist each batch as it lands: that is what makes this resumable.
    onBatch: async (offset, vectors) => {
      const rows = vectors.map((v, i) => ({
        chunk_id: pending[offset + i].id,
        embedding_version: config.version,
        embedding_model: config.model,
        embedding_dimensions: config.dimensions,
        embedding: JSON.stringify(v),
      }));
      // Sub-batch the write: a single statement carrying ~96 x 1536-float
      // vectors exceeds Postgres' statement timeout. Smaller statements keep
      // each write comfortably inside it.
      const WRITE_BATCH = 16;
      for (let i = 0; i < rows.length; i += WRITE_BATCH) {
        const slice = rows.slice(i, i + WRITE_BATCH);
        const { error } = await db.from("knowledge_embeddings")
          .upsert(slice, { onConflict: "chunk_id,embedding_version" });
        if (error) throw new Error(`embedding upsert: ${error.message}`);
        report.embedded += slice.length;
      }
    },
  });

  console.log(`  embeddings written: ${report.embedded}`);
}

// ===========================================================================
console.log("Roblox Brain — ingestion\n" + "=".repeat(58));

try {
  if (!EMBED_ONLY) {
    await ingestSources();
    await ingestDocuments();
    await ingestCodeExamples();
    for (const repo of LOCK.repositories) {
      const { count } = await db.from("knowledge_documents")
        .select("*", { count: "exact", head: true }).eq("source_repository", repo.name);
      await db.from("knowledge_sources").update({ document_count: count ?? 0, updated_at: new Date().toISOString() }).eq("id", repo.name);
    }
  }
  if (!NO_EMBED) await generateEmbeddings();
} catch (err) {
  fail("pipeline", err);
  console.error(`\n  PIPELINE ERROR: ${err.message}`);
}

report.finished_at = new Date().toISOString();
writeFileSync("docs/roblox-brain/reports/ingest.json", `${JSON.stringify(report, null, 2)}\n`);

console.log("-".repeat(58));
console.log(`  documents ${report.documents}  chunks ${report.chunks}  symbols ${report.api_symbols}`);
console.log(`  code examples ${report.code_examples}  embedded ${report.embedded}  skipped ${report.embed_skipped}`);
console.log(`  failures ${report.failures.length}  warnings ${report.warnings.length}`);
for (const f of report.failures.slice(0, 10)) console.log(`    FAIL ${f.path}: ${f.error}`);
for (const w of report.warnings.slice(0, 5)) console.log(`    WARN ${w.path}: ${w.message}`);
console.log("=".repeat(58));
process.exit(report.failures.length ? 1 : 0);
