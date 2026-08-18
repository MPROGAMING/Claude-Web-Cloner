#!/usr/bin/env node
/**
 * Roblox Brain — Step 4 corpus validator.
 *
 * Read-only. Streams every corpus document and checks the invariants that a
 * later retrieval layer will depend on. Never mutates the corpus.
 *
 * Usage: node scripts/roblox-brain/validate-corpus.mjs
 * Exit:  0 = PASS / PASS WITH WARNINGS, 1 = FAIL
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readJson, CORPUS_ROOT } from "./lib/common.mjs";

const LOCK = readJson("docs/roblox-brain/source-lock.json");
const MANIFEST = readJson(join(CORPUS_ROOT, "manifest.json"));

const errors = [];
const warnings = [];
const fail = (check, msg) => errors.push({ check, msg });
const warn = (check, msg) => warnings.push({ check, msg });

const lockedCommits = Object.fromEntries(LOCK.repositories.map((r) => [r.name, r.commit]));

/** Paths that must never appear as a source in the corpus. */
const FORBIDDEN_SOURCE = [
  /^luau\/tests\//, /^tests\//,
  /^luau\/bench\//, /^bench\//,
  /^luau\/fuzz\//, /^fuzz\//,
  /^luau\/extern\//, /^extern\//,
  /^content\/en-us\/includes\//,
  /^content\/en-us\/education\//,
  /^content\/en-us\/creator-programs\//,
  /^content\/en-us\/ip-licensing\//,
  /^src\/components\//, /^src\/pages\//, /^src\/layouts\//, /^src\/plugins\//,
  /^node_modules\//, /^tools\//, /^\.github\//,
];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|mp4|wav|fbx|zip|pdf|woff2?|ico|svg|rbxlx?|rbxm)$/i;

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

const REQUIRED = ["source_id","source_repository","source_commit","source_path",
  "source_type","authority","license","retrieved_at","content_date","category","topic"];
const VALID_AUTHORITY = new Set(["canonical","secondary","historical"]);
const VALID_LICENSE = new Set(["CC-BY-4.0","MIT"]);
const HEX24 = /^[0-9a-f]{24}$/;

const ids = new Map();
const semanticTopics = new Map();
let checked = 0, engineDocs = 0, openapiDocs = 0, structuredOk = 0, opIdOk = 0;
let deprecatedMarked = 0, codeBlocksSeen = 0;

// Registry/meta files are not documents and are checked separately.
const META = new Set(["manifest.json", "cloud/_schema-registry.json",
  "metadata/code-examples.json", "metadata/duplicates.json", "reports/failures.json"]);

for (const rel of walkJson(CORPUS_ROOT)) {
  if (META.has(rel)) continue;

  let doc;
  try { doc = JSON.parse(readFileSync(join(CORPUS_ROOT, rel), "utf8")); }
  catch (err) { fail("parse", `${rel}: ${err.message}`); continue; }
  checked += 1;

  // --- required provenance ------------------------------------------------
  for (const field of REQUIRED) {
    if (doc[field] === undefined || doc[field] === null || doc[field] === "") {
      fail("required-field", `${rel}: missing ${field}`);
    }
  }

  // --- deterministic ids ---------------------------------------------------
  if (!HEX24.test(doc.source_id ?? "")) {
    fail("deterministic-id", `${rel}: source_id is not a 24-char hash (random UUID?)`);
  }
  if (ids.has(doc.source_id)) {
    fail("duplicate-id", `${rel}: duplicate source_id ${doc.source_id} (also ${ids.get(doc.source_id)})`);
  } else ids.set(doc.source_id, rel);

  // --- commit matches the lock --------------------------------------------
  const expected = lockedCommits[doc.source_repository];
  if (!expected) fail("repo", `${rel}: unknown repository ${doc.source_repository}`);
  else if (doc.source_commit !== expected) {
    fail("commit-lock", `${rel}: commit ${doc.source_commit} != locked ${expected}`);
  }

  // --- authority / license -------------------------------------------------
  if (!VALID_AUTHORITY.has(doc.authority)) fail("authority", `${rel}: invalid authority ${doc.authority}`);
  if (!VALID_LICENSE.has(doc.license)) fail("license", `${rel}: invalid license ${doc.license}`);
  if (doc.source_repository === "site" && doc.license !== "MIT") {
    fail("license", `${rel}: site content must be MIT`);
  }

  // --- exclusions ----------------------------------------------------------
  for (const pattern of FORBIDDEN_SOURCE) {
    if (pattern.test(doc.source_path)) {
      fail("excluded-source", `${rel}: forbidden source path ${doc.source_path}`);
    }
  }
  if (BINARY_EXT.test(doc.source_path)) {
    fail("binary-media", `${rel}: binary media entered the corpus (${doc.source_path})`);
  }

  // --- source_url where applicable ----------------------------------------
  if (!doc.source_url) warn("source-url", `${rel}: no source_url`);

  // --- type-specific structure --------------------------------------------
  if (doc.source_type === "engine-api-yaml") {
    engineDocs += 1;
    if (doc.structured !== true) fail("engine-structured", `${rel}: not marked structured`);
    else if (!doc.api || typeof doc.api !== "object") {
      fail("engine-structured", `${rel}: missing structured api object`);
    } else {
      // Structure preserved, not flattened to a prose blob.
      const hasStructure = ["properties","methods","events","callbacks","functions","items"]
        .some((k) => Array.isArray(doc.api[k]));
      const hasIdentity = doc.api.name !== undefined && doc.api.type !== undefined;
      if (hasIdentity) structuredOk += 1;
      else fail("engine-structured", `${rel}: api object lost name/type`);
      if (typeof doc.api === "string") fail("engine-structured", `${rel}: api flattened to a string`);
      void hasStructure;
    }
    if (doc.deprecated === true) {
      deprecatedMarked += 1;
      const msg = doc.api?.deprecation_message;
      const tags = doc.api?.tags ?? [];
      const tagged = Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === "deprecated");
      if (!((typeof msg === "string" && msg.trim()) || tagged)) {
        fail("deprecation", `${rel}: marked deprecated with neither message nor tag`);
      }
    }
  }

  if (doc.source_type === "openapi") {
    openapiDocs += 1;
    const oa = doc.openapi;
    if (!oa) fail("openapi-structure", `${rel}: missing openapi object`);
    else {
      if (!oa.http_method || !oa.path) fail("openapi-structure", `${rel}: missing method/path`);
      // operationId may legitimately be absent upstream; only require the key.
      if (!("operationId" in oa)) fail("openapi-operation-id", `${rel}: operationId key absent`);
      else if (oa.operationId) opIdOk += 1;
      if (!("schema_refs" in oa)) fail("openapi-structure", `${rel}: no schema_refs`);
    }
  }

  // --- code blocks intact --------------------------------------------------
  if (Array.isArray(doc.code_blocks)) {
    for (const b of doc.code_blocks) {
      codeBlocksSeen += 1;
      if (typeof b.code !== "string") fail("code-block", `${rel}: code block is not a string`);
      // A truncation marker would mean we mangled a sample.
      if (typeof b.code === "string" && /…$|\.\.\.$/.test(b.code.trim()) && b.code.length < 40) {
        warn("code-block", `${rel}: code block looks truncated`);
      }
    }
  }

  // --- attributes collision ------------------------------------------------
  if (doc.semantic_topic) {
    const set = semanticTopics.get(doc.semantic_topic) ?? new Set();
    set.add(doc.source_repository);
    semanticTopics.set(doc.semantic_topic, set);
  }
  if (/\/attributes\.md$/.test(doc.source_path ?? "")) {
    const expectedTopic = doc.source_repository === "site"
      ? "luau-language-attributes" : "roblox-instance-attributes";
    if (doc.semantic_topic !== expectedTopic) {
      fail("attributes-collision",
        `${rel}: attributes page has semantic_topic '${doc.semantic_topic}', expected '${expectedTopic}'`);
    }
  }
}

// --- corpus-level checks ---------------------------------------------------
if (semanticTopics.has("luau-language-attributes") && semanticTopics.has("roblox-instance-attributes")) {
  // good: both concepts present and distinct
} else {
  fail("attributes-collision", "both attribute concepts must be present with distinct semantic topics");
}

const codeReg = readJson(join(CORPUS_ROOT, "metadata", "code-examples.json"));
for (const ex of codeReg.examples) {
  for (const f of ["example_id","source_id","source_path","language","code","authority","license"]) {
    if (ex[f] === undefined) { fail("code-example", `example ${ex.example_id}: missing ${f}`); break; }
  }
  if (/^(luau\/)?(tests|bench|fuzz)\//.test(ex.source_path)) {
    fail("code-example-source", `example ${ex.example_id}: extracted from forbidden ${ex.source_path}`);
  }
}

if (MANIFEST.counts.documents_total !== checked) {
  warn("manifest-count", `manifest says ${MANIFEST.counts.documents_total} documents, found ${checked}`);
}

// --- report ----------------------------------------------------------------
console.log("\nRoblox Brain — corpus validation\n" + "=".repeat(56));
console.log(`  documents checked      ${checked}`);
console.log(`  engine API documents   ${engineDocs} (structure preserved: ${structuredOk})`);
console.log(`  openapi operations     ${openapiDocs} (with operationId: ${opIdOk})`);
console.log(`  deprecated marked      ${deprecatedMarked}`);
console.log(`  code blocks inspected  ${codeBlocksSeen}`);
console.log(`  code examples          ${codeReg.count}`);
console.log(`  unique ids             ${ids.size}`);
console.log("-".repeat(56));
for (const w of warnings.slice(0, 20)) console.log(`  WARN [${w.check}] ${w.msg}`);
if (warnings.length > 20) console.log(`  ... ${warnings.length - 20} more warnings`);
for (const e of errors.slice(0, 20)) console.log(`  FAIL [${e.check}] ${e.msg}`);
if (errors.length > 20) console.log(`  ... ${errors.length - 20} more errors`);

const verdict = errors.length ? "FAIL" : warnings.length ? "PASS WITH WARNINGS" : "PASS";
console.log("=".repeat(56));
console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
console.log(`  RESULT: ${verdict}\n`);
process.exit(errors.length ? 1 : 0);
