#!/usr/bin/env node
/**
 * Roblox Brain — coverage audit.
 *
 * READ-ONLY. Fetches the three published llms.txt indexes, enumerates the URLs
 * they list, and compares that inventory against the pinned local Git tree.
 * Individual documentation pages are NOT crawled and nothing is written to the
 * repository.
 *
 * Answers: is anything published that we do not hold locally, and vice versa.
 *
 * Usage: node scripts/roblox-brain/coverage-audit.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { homedir } from "node:os";

const ROOT = join(homedir(), "Documents", "Blockwright-Sources");
const CD = join(ROOT, "creator-docs");

const INDEXES = {
  main:   "https://create.roblox.com/docs/llms.txt",
  engine: "https://create.roblox.com/docs/reference/engine/llms.txt",
  cloud:  "https://create.roblox.com/docs/cloud/llms.txt",
};

/**
 * Normalise a published URL to a comparable key.
 * Deliberately strips the differences the brief flagged as false positives:
 * locale prefixes, trailing slashes, .md suffixes, anchors, query strings and
 * percent-encoding. Without this the audit reports hundreds of phantom diffs.
 */
function normalizeUrl(raw) {
  let u = raw.trim();
  try { u = decodeURIComponent(u); } catch { /* leave as-is if malformed */ }
  u = u.replace(/^https?:\/\/create\.roblox\.com/i, "");
  u = u.split("#")[0].split("?")[0];
  u = u.replace(/^\/docs\/?/, "");
  u = u.replace(/^(en-us|en-gb|[a-z]{2}-[a-z]{2})\//i, "");
  u = u.replace(/\.md$/i, "");
  u = u.replace(/\/+$/, "");
  u = u.replace(/^\/+/, "");
  return u.toLowerCase();
}

/** Local repo path -> the same comparable key. */
function normalizeLocalPath(p) {
  let s = p.replace(/^content\//, "");
  s = s.replace(/^(en-us|common)\//, "");
  s = s.replace(/\.(md|yaml|json|mdx)$/i, "");
  s = s.replace(/\/index$/i, "");
  return s.toLowerCase();
}

async function fetchIndex(url) {
  const res = await fetch(url, { headers: { Accept: "text/plain" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  const links = [...text.matchAll(/\]\((https?:\/\/[^)]+|\/[^)]+)\)/g)].map((m) => m[1]);
  const updated = text.match(/Last updated:\s*([0-9T:.Z+-]+)/)?.[1] ?? null;
  return { text, links, updated, bytes: Buffer.byteLength(text) };
}

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === ".git") continue;
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

const findings = [];
const add = (severity, url, expected, problem, action) =>
  findings.push({ severity, url, expected, problem, action });

// ---------------------------------------------------------------------------
console.log("Roblox Brain — coverage audit\n" + "=".repeat(58));

const idx = {};
for (const [name, url] of Object.entries(INDEXES)) {
  try {
    idx[name] = await fetchIndex(url);
    console.log(`  ${name.padEnd(7)} ${String(idx[name].links.length).padStart(5)} links  ${String(idx[name].bytes).padStart(7)} B  updated ${idx[name].updated}`);
  } catch (err) {
    console.log(`  ${name.padEnd(7)} FETCH FAILED: ${err.message}`);
    add("critical", url, "-", `Index fetch failed: ${err.message}`, "Re-run when reachable; audit is incomplete without it.");
    idx[name] = { links: [], bytes: 0, updated: null };
  }
}

// --- local candidate inventory (from the validated manifest) ---------------
const validated = existsSync("/tmp/rb-validate.json")
  ? JSON.parse(readFileSync("/tmp/rb-validate.json", "utf8"))
  : null;
const localCandidates = validated?.totalIncluded ?? 0;

const cdFiles = walk(CD);
const localDocKeys = new Map();
for (const f of cdFiles) {
  if (!/\.(md|yaml)$/i.test(f)) continue;
  if (!f.startsWith("content/en-us/")) continue;
  localDocKeys.set(normalizeLocalPath(f), f);
}

// --- 1. Engine index vs local YAML ----------------------------------------
const engineUrls = idx.engine.links.map(normalizeUrl).filter(Boolean);
const localEngineYaml = cdFiles.filter((f) =>
  f.startsWith("content/en-us/reference/engine/") && f.endsWith(".yaml"));
const localEngineKeys = new Set(localEngineYaml.map(normalizeLocalPath));

const engineMissingLocal = engineUrls.filter((u) => !localEngineKeys.has(u));
const engineExtraLocal = [...localEngineKeys].filter((k) => !engineUrls.includes(k));

console.log("\n  Engine API mapping");
console.log(`    published URLs : ${engineUrls.length}`);
console.log(`    local YAML     : ${localEngineYaml.length}`);
console.log(`    published w/o local : ${engineMissingLocal.length}`);
console.log(`    local w/o published : ${engineExtraLocal.length}`);

for (const u of engineMissingLocal.slice(0, 10)) {
  add("high", `/docs/${u}`, `content/en-us/${u}.yaml`,
      "Published Engine API page has no local YAML", "Confirm whether the page is new since the pinned commit.");
}
for (const k of engineExtraLocal.slice(0, 10)) {
  add("low", "-", `content/en-us/${k}.yaml`,
      "Local Engine API YAML not present in the published index", "Likely unpublished or renamed; verify before relying on it.");
}

// --- 2. Cloud index vs local ----------------------------------------------
const cloudUrls = idx.cloud.links.map(normalizeUrl).filter(Boolean);
const cloudMissingLocal = cloudUrls.filter((u) => !localDocKeys.has(u));
console.log("\n  Cloud API mapping");
console.log(`    published URLs : ${cloudUrls.length}`);
console.log(`    published w/o local : ${cloudMissingLocal.length}`);

// --- 3. Main index vs local ------------------------------------------------
const mainUrls = [...new Set(idx.main.links.map(normalizeUrl).filter(Boolean))];
const mainMissingLocal = mainUrls.filter((u) => !localDocKeys.has(u));
const localNotPublished = [...localDocKeys.keys()].filter((k) => !mainUrls.includes(k));

console.log("\n  Main documentation index");
console.log(`    published URLs (unique) : ${mainUrls.length}`);
console.log(`    local candidate docs    : ${localCandidates}`);
console.log(`    local md/yaml (all)     : ${localDocKeys.size}`);
console.log(`    published w/o local     : ${mainMissingLocal.length}`);
console.log(`    local w/o published     : ${localNotPublished.length}`);

// --- 4. OpenAPI presence ---------------------------------------------------
const openapiPath = join(CD, "content/en-us/reference/cloud/openapi.json");
const openapiLocal = existsSync(openapiPath);
const openapiSize = openapiLocal ? statSync(openapiPath).size : 0;
console.log(`\n  Cloud OpenAPI local: ${openapiLocal ? `yes (${openapiSize} bytes)` : "NO"}`);
if (!openapiLocal) {
  add("critical", "https://create.roblox.com/docs/cloud/openapi.json",
      "content/en-us/reference/cloud/openapi.json", "OpenAPI spec absent locally", "Fetch from the live endpoint.");
}

// --- 5. Sampled classification of published-only pages ---------------------
const sample = mainMissingLocal.slice(0, 400);
const buckets = { engine: 0, cloud: 0, reference: 0, other: 0 };
for (const u of sample) {
  if (u.startsWith("reference/engine")) buckets.engine += 1;
  else if (u.startsWith("cloud")) buckets.cloud += 1;
  else if (u.startsWith("reference")) buckets.reference += 1;
  else buckets.other += 1;
}

const report = {
  generated_at: new Date().toISOString(),
  indexes: Object.fromEntries(Object.entries(idx).map(([k, v]) =>
    [k, { links: v.links.length, bytes: v.bytes, updated: v.updated }])),
  engine: {
    published: engineUrls.length,
    local_yaml: localEngineYaml.length,
    published_without_local: engineMissingLocal.length,
    local_without_published: engineExtraLocal.length,
    clean_mapping: engineMissingLocal.length === 0 && engineExtraLocal.length === 0,
  },
  cloud: { published: cloudUrls.length, published_without_local: cloudMissingLocal.length },
  main: {
    published_unique: mainUrls.length,
    local_candidates: localCandidates,
    local_all_md_yaml: localDocKeys.size,
    published_without_local: mainMissingLocal.length,
    local_without_published: localNotPublished.length,
    published_only_sample_buckets: buckets,
  },
  openapi: { local: openapiLocal, bytes: openapiSize },
  findings,
  samples: {
    engine_missing_local: engineMissingLocal.slice(0, 15),
    engine_extra_local: engineExtraLocal.slice(0, 15),
    main_missing_local: mainMissingLocal.slice(0, 25),
    local_not_published: localNotPublished.slice(0, 25),
    cloud_missing_local: cloudMissingLocal.slice(0, 15),
  },
};

writeFileSync("/tmp/rb-coverage.json", JSON.stringify(report, null, 2));
console.log("\n" + "=".repeat(58));
console.log(`  findings: ${findings.length}`);
console.log("  written: /tmp/rb-coverage.json\n");
