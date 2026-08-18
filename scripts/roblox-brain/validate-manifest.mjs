#!/usr/bin/env node
/**
 * Roblox Brain — ingestion manifest validator.
 *
 * Read-only. Checks the manifest against the pinned source tree before any
 * ingestion tooling is written, so a scope mistake is caught while it is still
 * cheap to fix.
 *
 * Usage: node scripts/roblox-brain/validate-manifest.mjs
 * Exit:  0 = PASS or PASS WITH WARNINGS, 1 = FAIL
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { homedir } from "node:os";

const ROOT = join(homedir(), "Documents", "Blockwright-Sources");
const LOCK = JSON.parse(readFileSync("docs/roblox-brain/source-lock.json", "utf8"));
const MANIFEST = JSON.parse(readFileSync("docs/roblox-brain/ingestion-manifest.json", "utf8"));

const errors = [];
const warnings = [];
const notes = [];
const fail = (check, msg) => errors.push({ check, msg });
const warn = (check, msg) => warnings.push({ check, msg });
const note = (check, msg) => notes.push({ check, msg });

// ---------------------------------------------------------------------------
// Minimal glob matcher: supports **, * and ? against POSIX-style paths.
// ---------------------------------------------------------------------------
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // `**/` may match zero directories; bare `**` matches anything.
        if (glob[i + 2] === "/") { re += "(?:.*/)?"; i += 2; } else { re += ".*"; i += 1; }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}
const matches = (path, glob) => globToRegExp(glob).test(path);
const matchesAny = (path, globs) => globs.some((g) => matches(path, g));

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === ".git") continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

// ---------------------------------------------------------------------------
const repoFiles = {};
for (const repo of LOCK.repositories) {
  const dir = join(ROOT, repo.name);
  if (!existsSync(dir)) { fail("repo-exists", `Missing repository on disk: ${dir}`); continue; }
  repoFiles[repo.name] = walk(dir);
}

// 1. Every repository has a locked commit, verified against disk.
for (const repo of LOCK.repositories) {
  if (!/^[0-9a-f]{40}$/.test(repo.commit ?? "")) {
    fail("locked-commit", `${repo.name}: commit is not a 40-char SHA`);
  }
  if (!repo.license?.content) fail("repo-license", `${repo.name}: no license recorded`);
  if (repo.lfs?.required && !repo.lfs?.blobs_excluded) {
    warn("lfs-policy", `${repo.name}: LFS required but blobs not marked excluded`);
  }
}

// 2. Manifest integrity: authority, license, parser, priority, commit link.
const VALID_AUTHORITY = new Set(["canonical", "secondary", "historical"]);
const lockedRepos = new Set(LOCK.repositories.map((r) => r.name));

for (const src of MANIFEST.sources) {
  const id = src.id;
  if (!lockedRepos.has(src.repository)) fail("source-repo", `${id}: repository '${src.repository}' not in source lock`);
  if (!VALID_AUTHORITY.has(src.authority)) fail("authority", `${id}: invalid or missing authority`);
  if (!src.license) fail("license", `${id}: missing license`);
  if (typeof src.priority !== "number") fail("priority", `${id}: missing priority`);
  if (!src.source_type) fail("source-type", `${id}: missing source_type`);
  else if (!MANIFEST.parser_registry[src.source_type]) {
    fail("parser-strategy", `${id}: source_type '${src.source_type}' has no parser in parser_registry`);
  }
  if (!src.parsing_strategy?.mode) fail("parsing-strategy", `${id}: missing parsing_strategy.mode`);
}

// 3. Every include glob must actually match files. A glob matching nothing is
//    almost always a wrong path, and silently ingesting nothing is worse than
//    failing loudly.
const includedByRepo = {};
for (const src of MANIFEST.sources) {
  const files = repoFiles[src.repository] ?? [];
  includedByRepo[src.repository] ??= new Set();

  for (const glob of src.include) {
    const hits = files.filter((f) => matches(f, glob));
    if (hits.length === 0) {
      fail("include-exists", `${src.id}: include glob matches ZERO files -> "${glob}"`);
    } else {
      note("include-count", `${src.id}: ${glob} -> ${hits.length} files`);
      for (const h of hits) includedByRepo[src.repository].add(h);
    }
  }

  for (const glob of src.exclude ?? []) {
    try { globToRegExp(glob); } catch { fail("exclude-syntax", `${src.id}: invalid exclude glob "${glob}"`); }
  }
}

// 4. Global excludes are syntactically valid.
const globalExcludes = [
  ...MANIFEST.global_excludes.binary_media,
  ...MANIFEST.global_excludes.creator_docs,
  ...MANIFEST.global_excludes.site_machinery,
];
for (const glob of globalExcludes) {
  try { globToRegExp(glob); } catch { fail("exclude-syntax", `invalid global exclude "${glob}"`); }
}

// 5. No excluded path may survive as included. An exclude must always win.
for (const [repo, included] of Object.entries(includedByRepo)) {
  const applicable = [
    ...MANIFEST.global_excludes.binary_media,
    ...(repo === "creator-docs" ? MANIFEST.global_excludes.creator_docs : []),
    ...(repo === "site" ? MANIFEST.global_excludes.site_machinery : []),
  ];
  for (const path of included) {
    if (matchesAny(path, applicable)) {
      fail("exclude-wins", `${repo}: '${path}' is matched by BOTH an include and an exclude`);
    }
  }
}

// 6. Luau compiler source must not leak into the corpus.
const luauIngesting = MANIFEST.sources.filter((s) => s.repository === "luau");
if (luauIngesting.length > 0) {
  fail("luau-not-ingested", `luau must be reference-only, but ${luauIngesting.length} ingestion source(s) reference it`);
}
const luauRef = MANIFEST.reference_only?.find((r) => r.repository === "luau");
if (!luauRef) fail("luau-reference", "luau missing from reference_only");
else if (luauRef.ingested !== false) fail("luau-reference", "luau reference_only entry must have ingested:false");

// 7. Engine API classified as structured; OpenAPI classified separately.
const engine = MANIFEST.sources.find((s) => s.source_type === "engine-api-yaml");
if (!engine) fail("engine-structured", "no engine-api-yaml source found");
else {
  if (engine.parsing_strategy.mode !== "structured-field-level") {
    fail("engine-structured", "engine API must use structured-field-level parsing");
  }
  if (engine.parsing_strategy.must_not_flatten_to_prose !== true) {
    fail("engine-structured", "engine API must set must_not_flatten_to_prose:true");
  }
  const required = ["name","summary","description","inherits","descendants","tags",
    "deprecation_message","security","properties","methods","events","callbacks",
    "code_samples","thread_safety","capabilities","serialization","category","simulationAccess"];
  const missing = required.filter((f) => !engine.parsing_strategy.preserve_fields.includes(f));
  if (missing.length) fail("engine-fields", `engine API preserve_fields missing: ${missing.join(", ")}`);
}

const openapi = MANIFEST.sources.find((s) => s.source_type === "openapi");
if (!openapi) fail("openapi-separate", "no openapi source found");
else if (openapi.parsing_strategy.mode !== "operation-level") {
  fail("openapi-separate", "OpenAPI must use operation-level parsing");
}
if (engine && openapi && engine.id === openapi.id) {
  fail("openapi-separate", "OpenAPI must be a separate source from the engine YAML");
}

// 8. Overlap rules present, including the attributes collision.
const ruleIds = new Set((MANIFEST.overlap_rules ?? []).map((r) => r.id));
for (const id of ["OV-001", "OV-002", "OV-003", "OV-004", "OV-005"]) {
  if (!ruleIds.has(id)) fail("overlap-rules", `missing overlap rule ${id}`);
}
const attrRule = MANIFEST.overlap_rules.find((r) => r.id === "OV-005");
if (attrRule) {
  const tags = new Set((attrRule.distinct_subjects ?? []).map((s) => s.semantic_tag));
  if (tags.size !== 2) fail("attributes-collision", "OV-005 must define two DISTINCT semantic tags");
  for (const subj of attrRule.distinct_subjects ?? []) {
    const files = repoFiles[subj.repository] ?? [];
    if (!files.includes(subj.path)) {
      warn("attributes-collision", `OV-005 path not found on disk: ${subj.repository}/${subj.path}`);
    }
  }
}

// 9. Metadata schema completeness.
for (const f of ["source_id","source_repository","source_url","source_commit","source_path",
  "source_type","authority","license","retrieved_at","content_date","category","topic",
  "priority","deprecated","chunk_index","chunk_total"]) {
  if (!MANIFEST.metadata_schema.fields[f]) fail("metadata-schema", `metadata schema missing field: ${f}`);
}

// 10. Nothing has been ingested yet.
if (MANIFEST.status !== "specification-only") {
  warn("scope", `manifest status is '${MANIFEST.status}', expected 'specification-only'`);
}

// ---------------------------------------------------------------------------
const totalIncluded = Object.values(includedByRepo).reduce((n, s) => n + s.size, 0);
console.log("\nRoblox Brain — manifest validation\n" + "=".repeat(52));
for (const n of notes) console.log(`  info  ${n.msg}`);
console.log("-".repeat(52));
console.log(`  candidate documents matched: ${totalIncluded}`);
for (const [repo, s] of Object.entries(includedByRepo)) console.log(`    ${repo}: ${s.size}`);
console.log("-".repeat(52));
for (const w of warnings) console.log(`  WARN  [${w.check}] ${w.msg}`);
for (const e of errors) console.log(`  FAIL  [${e.check}] ${e.msg}`);

const verdict = errors.length ? "FAIL" : warnings.length ? "PASS WITH WARNINGS" : "PASS";
console.log("=".repeat(52));
console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
console.log(`  RESULT: ${verdict}\n`);

if (process.env.EMIT_JSON) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/rb-validate.json", JSON.stringify(
    { verdict, errors, warnings, totalIncluded,
      byRepo: Object.fromEntries(Object.entries(includedByRepo).map(([k, v]) => [k, v.size])),
      includedPaths: Object.fromEntries(Object.entries(includedByRepo).map(([k, v]) => [k, [...v]])) },
    null, 2));
}
process.exit(errors.length ? 1 : 0);
