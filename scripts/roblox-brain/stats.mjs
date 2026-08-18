#!/usr/bin/env node
/**
 * Roblox Brain — knowledge base statistics.
 *
 * Read-only snapshot of what is actually indexed: counts by repository, type,
 * authority and license, embedding coverage, and database size.
 *
 * Usage: npm run brain:stats
 */

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const count = async (table, filter) => {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n } = await q;
  return n ?? 0;
};

/** Page through a column so counts are not silently capped at 1000 rows. */
async function tally(table, column) {
  const out = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(column).range(from, from + 999);
    if (error) throw new Error(`${table}.${column}: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const key = row[column] ?? "(null)";
      out.set(key, (out.get(key) ?? 0) + 1);
    }
    if (data.length < 1000) break;
  }
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

const line = (label, value) => console.log(`  ${String(label).padEnd(30)} ${value}`);

console.log("\nRoblox Brain — knowledge base statistics");
console.log("=".repeat(58));

const { data: sources } = await db.from("knowledge_sources").select("*").order("id");
console.log("\nSOURCES");
for (const s of sources ?? []) {
  console.log(`  ${s.id.padEnd(14)} ${s.commit.slice(0, 12)}  ${s.branch.padEnd(7)} ${s.license.padEnd(10)} ${s.document_count} docs`);
}

const docs = await count("knowledge_documents");
const chunks = await count("knowledge_chunks");
const embeds = await count("knowledge_embeddings");
const symbols = await count("knowledge_api_symbols");
const code = await count("knowledge_code_examples");
const deprecated = await count("knowledge_documents", (q) => q.eq("deprecated", true));

console.log("\nTOTALS");
line("documents", docs);
line("chunks", chunks);
line("embeddings", `${embeds}  (${chunks ? ((embeds / chunks) * 100).toFixed(1) : 0}% coverage)`);
line("api symbols", symbols);
line("code examples", code);
line("deprecated documents", deprecated);

const { data: versions } = await db
  .from("knowledge_embeddings")
  .select("embedding_version, embedding_model, embedding_dimensions")
  .limit(1);
if (versions?.length) {
  console.log("\nEMBEDDINGS");
  line("version", versions[0].embedding_version);
  line("model", versions[0].embedding_model);
  line("dimensions", versions[0].embedding_dimensions);
}

console.log("\nBY REPOSITORY");
for (const [k, v] of await tally("knowledge_documents", "source_repository")) line(k, v);

console.log("\nBY SOURCE TYPE");
for (const [k, v] of await tally("knowledge_documents", "source_type")) line(k, v);

console.log("\nBY AUTHORITY");
for (const [k, v] of await tally("knowledge_documents", "authority")) line(k, v);

console.log("\nBY LICENSE");
for (const [k, v] of await tally("knowledge_documents", "license")) line(k, v);

console.log("\nBY CATEGORY");
for (const [k, v] of await tally("knowledge_documents", "category")) line(k, v);

console.log("\nSYMBOL KINDS");
for (const [k, v] of await tally("knowledge_api_symbols", "symbol_kind")) line(k, v);

console.log("\nCODE EXAMPLE LANGUAGES");
for (const [k, v] of (await tally("knowledge_code_examples", "language")).slice(0, 8)) line(k, v);

console.log(`\n${"=".repeat(58)}\n`);
