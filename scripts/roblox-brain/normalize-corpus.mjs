#!/usr/bin/env node
/**
 * Roblox Brain — Step 4 corpus normalizer.
 *
 * Reads the locked Git sources, normalizes them into a structured local corpus,
 * and writes provenance onto every document. It does NOT embed, index, chunk for
 * retrieval, or touch any database.
 *
 * Design constraints that shaped this file:
 *   - Deterministic. Every id is a hash of (repo, commit, path, section), so two
 *     runs over the same locked sources produce identical output.
 *   - Incremental. Documents are written as they are produced; the whole corpus
 *     is never held in memory. Only lightweight indexes (hashes, counters) are
 *     retained.
 *   - Atomic. Each document is written to a temp file and renamed.
 *   - Loud. A parse failure is recorded and processing continues; the process
 *     exits non-zero if any required source failed.
 *   - Faithful. Representation is normalized, meaning never is. Nothing is
 *     summarised, rewritten, corrected or merged.
 *
 * Usage: node scripts/roblox-brain/normalize-corpus.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "js-yaml";

import {
  SOURCE_ROOT, CORPUS_ROOT, documentId, contentHash, normalizeNewlines,
  writeJsonAtomic, readJson, creatorDocsUrl, siteUrl, splitByHeadings,
  extractCodeBlocks, parseFrontMatter, extractLinks, countTables, deriveTitle,
} from "./lib/common.mjs";

const LOCK = readJson("docs/roblox-brain/source-lock.json");
// The manifest governs ingestion (Step 3); normalization reads the source lock only.
const RETRIEVED_AT = new Date().toISOString();

const LICENSE = {
  "creator-docs": { prose: "CC-BY-4.0", code: "MIT" },
  site: { prose: "MIT", code: "MIT" },
  luau: { prose: "MIT", code: "MIT" },
};

const stats = {
  api: 0, api_members: 0, cloud_ops: 0, cloud_schemas: 0, language: 0,
  roblox_luau: 0, tutorials: 0, guides: 0, scripting: 0, ai: 0, news: 0,
  code_examples: 0, deprecated: 0, documents: 0,
};
const failures = [];
const warnings = [];
const skipped = [];
const byLicense = {};
const byAuthority = {};
const bySourceType = {};
const seenIds = new Map();
const contentIndex = new Map();   // contentHash -> [source_id]
const nearDupeIndex = new Map();  // title|type -> [{id, path}]
const codeExamples = [];

const fail = (source, path, error, severity = "high") =>
  failures.push({ source, path, error: String(error?.message ?? error), severity });
const warn = (source, path, message, severity = "low") =>
  warnings.push({ source, path, message, severity });

function repoInfo(name) {
  const r = LOCK.repositories.find((x) => x.name === name);
  if (!r) throw new Error(`repository not in source lock: ${name}`);
  return r;
}

function repoDir(name) {
  return join(SOURCE_ROOT, name);
}

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

/** Record a document, enforcing unique deterministic ids. */
function register(doc, outPath) {
  if (seenIds.has(doc.source_id)) {
    fail(doc.source_repository, doc.source_path,
      `duplicate document id ${doc.source_id} (also ${seenIds.get(doc.source_id)})`, "critical");
    return false;
  }
  seenIds.set(doc.source_id, doc.source_path);

  byLicense[doc.license] = (byLicense[doc.license] ?? 0) + 1;
  byAuthority[doc.authority] = (byAuthority[doc.authority] ?? 0) + 1;
  bySourceType[doc.source_type] = (bySourceType[doc.source_type] ?? 0) + 1;
  stats.documents += 1;

  writeJsonAtomic(outPath, doc);
  return true;
}

/** Exact-duplicate tracking. Near-duplicates are only reported, never merged. */
function trackDuplicate(doc, text) {
  const hash = contentHash(text);
  const list = contentIndex.get(hash);
  if (list) { list.push(doc.source_id); return { exact_duplicate_of: list[0] }; }
  contentIndex.set(hash, [doc.source_id]);

  const key = `${(doc.title ?? "").toLowerCase()}|${doc.source_type}`;
  if (key.trim() !== "|" + doc.source_type) {
    const near = nearDupeIndex.get(key) ?? [];
    near.push({ id: doc.source_id, path: doc.source_path });
    nearDupeIndex.set(key, near);
  }
  return {};
}

function addCodeExamples(doc, blocks, contextLabel) {
  blocks.forEach((block, index) => {
    if (!block.code || !block.code.trim()) return;
    codeExamples.push({
      example_id: documentId(doc.source_repository, doc.source_commit, doc.source_path, `code:${contextLabel}:${index}`),
      source_id: doc.source_id,
      source_repository: doc.source_repository,
      source_commit: doc.source_commit,
      source_path: doc.source_path,
      source_url: doc.source_url,
      language: block.language ?? null,
      code: block.code,
      context: contextLabel,
      authority: doc.authority,
      // Code samples carry the CODE license, which differs from the prose
      // license for creator-docs (MIT vs CC-BY-4.0).
      license: LICENSE[doc.source_repository].code,
    });
    stats.code_examples += 1;
  });
}

// ===========================================================================
// 1. Engine API YAML  ->  corpus/api/
// ===========================================================================
const ENGINE_MEMBER_KEYS = ["properties", "methods", "events", "callbacks", "functions", "items"];
const ENGINE_TOP_KEYS = new Set([
  "name","type","summary","description","inherits","descendants","tags",
  "deprecation_message","properties","methods","events","callbacks","functions",
  "items","code_samples","security","thread_safety","capabilities","serialization",
  "memory_category","category","simulationAccess",
]);

function isDeprecated(node) {
  const msg = node?.deprecation_message;
  const tags = node?.tags ?? [];
  return Boolean((typeof msg === "string" && msg.trim()) ||
    (Array.isArray(tags) && tags.some((t) => String(t).toLowerCase() === "deprecated")));
}

function normalizeEngineApi() {
  const repo = repoInfo("creator-docs");
  const dir = repoDir("creator-docs");
  const files = walk(dir).filter(
    (f) => f.startsWith("content/en-us/reference/engine/") && f.endsWith(".yaml"));

  for (const rel of files) {
    let raw, data;
    try {
      raw = readFileSync(join(dir, rel), "utf8");
      data = YAML.load(raw);
    } catch (err) { fail("creator-docs", rel, err, "high"); continue; }

    if (!data || typeof data !== "object") {
      fail("creator-docs", rel, "YAML did not parse to an object", "high"); continue;
    }

    const partition = rel.split("/")[4] ?? "unknown";  // classes | enums | ...
    const name = data.name ?? rel.split("/").pop().replace(/\.yaml$/, "");
    const id = documentId("creator-docs", repo.commit, rel);

    // Members keep their own structure; unknown keys are preserved verbatim.
    const members = {};
    let memberCount = 0;
    for (const key of ENGINE_MEMBER_KEYS) {
      if (!Array.isArray(data[key])) continue;
      members[key] = data[key].map((m) => {
        memberCount += 1;
        const member = { ...m, deprecated: isDeprecated(m) };
        if (Array.isArray(m.code_samples) && m.code_samples.length) {
          addCodeExamples(
            { source_repository: "creator-docs", source_commit: repo.commit, source_path: rel,
              source_id: id, source_url: creatorDocsUrl(rel), authority: "canonical" },
            m.code_samples.map((c) => ({ language: "luau", code: String(c) })),
            `member:${m.name ?? "unnamed"}`);
        }
        return member;
      });
    }

    // Anything Roblox adds that we did not anticipate is kept, not dropped.
    const extra = {};
    for (const [k, v] of Object.entries(data)) {
      if (!ENGINE_TOP_KEYS.has(k)) extra[k] = v;
    }

    const doc = {
      source_id: id,
      source_repository: "creator-docs",
      source_commit: repo.commit,
      source_path: rel,
      source_url: `${creatorDocsUrl(rel)}`,
      source_type: "engine-api-yaml",
      authority: "canonical",
      license: LICENSE["creator-docs"].prose,
      retrieved_at: RETRIEVED_AT,
      content_date: repo.commit_date,
      category: "engine-api",
      topic: `engine.${partition}.${name}`,
      semantic_topic: `roblox-engine-${partition}`,
      deprecated: isDeprecated(data),
      title: String(name),
      structured: true,
      api: {
        name: data.name ?? null,
        type: data.type ?? null,
        summary: data.summary ?? null,
        description: data.description ?? null,
        inherits: data.inherits ?? null,
        descendants: data.descendants ?? null,
        tags: data.tags ?? null,
        deprecation_message: data.deprecation_message ?? null,
        security: data.security ?? null,
        thread_safety: data.thread_safety ?? null,
        capabilities: data.capabilities ?? null,
        serialization: data.serialization ?? null,
        memory_category: data.memory_category ?? null,
        category: data.category ?? null,
        simulationAccess: data.simulationAccess ?? null,
        code_samples: data.code_samples ?? null,
        ...members,
      },
      preserved_unknown_fields: Object.keys(extra).length ? extra : undefined,
      member_count: memberCount,
    };

    if (data.code_samples?.length) {
      addCodeExamples(doc, data.code_samples.map((c) => ({ language: "luau", code: String(c) })), "class");
    }

    Object.assign(doc, trackDuplicate(doc, raw));
    if (register(doc, join(CORPUS_ROOT, "api", partition, `${name}.json`))) {
      stats.api += 1;
      stats.api_members += memberCount;
      if (doc.deprecated) stats.deprecated += 1;
    }
  }
}

// ===========================================================================
// 2. OpenAPI  ->  corpus/cloud/  (+ shared schema registry)
// ===========================================================================
function normalizeOpenApi() {
  const repo = repoInfo("creator-docs");
  const dir = repoDir("creator-docs");
  const specPaths = walk(dir).filter(
    (f) => f.startsWith("content/en-us/reference/cloud/") && f.endsWith(".json"));

  const schemaRegistry = {};   // "<specKey>/<SchemaName>" -> schema
  const seenOps = new Set();   // dedupe (method, path) across specs

  // Aggregate spec first, so per-service specs defer to it on overlap.
  specPaths.sort((a, b) => (a.endsWith("cloud/openapi.json") ? -1 : b.endsWith("cloud/openapi.json") ? 1 : a.localeCompare(b)));

  for (const rel of specPaths) {
    let spec;
    try { spec = JSON.parse(readFileSync(join(dir, rel), "utf8")); }
    catch (err) { fail("creator-docs", rel, err, "high"); continue; }

    const version = spec.openapi ?? spec.swagger;
    if (!version) { skipped.push({ path: rel, reason: "not an OpenAPI/Swagger document" }); continue; }
    if (!/^3\./.test(String(version))) {
      warn("creator-docs", rel, `unexpected OpenAPI version ${version}`, "medium");
    }

    const specKey = rel.replace("content/en-us/reference/cloud/", "").replace(/\.json$/, "");

    for (const [schemaName, schema] of Object.entries(spec.components?.schemas ?? {})) {
      schemaRegistry[`${specKey}#${schemaName}`] = schema;
      stats.cloud_schemas += 1;
    }

    for (const [path, ops] of Object.entries(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(ops ?? {})) {
        if (!["get","post","put","patch","delete","head","options"].includes(method)) continue;
        if (!op || typeof op !== "object") continue;

        const opKey = `${method.toUpperCase()} ${path}`;
        if (seenOps.has(opKey)) {
          skipped.push({ path: rel, reason: `duplicate operation ${opKey} (already provided by the aggregate spec)` });
          continue;
        }
        seenOps.add(opKey);

        const section = `${method}:${path}`;
        const id = documentId("creator-docs", repo.commit, rel, section);

        const doc = {
          source_id: id,
          source_repository: "creator-docs",
          source_commit: repo.commit,
          source_path: rel,
          source_url: `${creatorDocsUrl("content/en-us/cloud/reference/openapi.md")}#${encodeURIComponent(opKey)}`,
          source_type: "openapi",
          authority: "canonical",
          license: LICENSE["creator-docs"].prose,
          retrieved_at: RETRIEVED_AT,
          content_date: repo.commit_date,
          category: "open-cloud",
          topic: `cloud.${specKey}.${op.operationId ?? opKey}`,
          semantic_topic: "roblox-open-cloud",
          deprecated: Boolean(op.deprecated),
          title: op.summary ?? opKey,
          structured: true,
          openapi: {
            spec_file: rel,
            spec_version: String(version),
            spec_title: spec.info?.title ?? null,
            http_method: method.toUpperCase(),
            path,
            operationId: op.operationId ?? null,
            summary: op.summary ?? null,
            description: op.description ?? null,
            tags: op.tags ?? null,
            parameters: op.parameters ?? null,
            requestBody: op.requestBody ?? null,
            responses: op.responses ?? null,
            security: op.security ?? spec.security ?? null,
            servers: op.servers ?? spec.servers ?? null,
            deprecated: Boolean(op.deprecated),
            // Schemas are referenced, not inlined, to avoid duplicating large
            // definitions into every operation document.
            schema_refs: [...new Set(
              JSON.stringify(op).match(/#\/components\/schemas\/[A-Za-z0-9_.-]+/g) ?? []
            )].map((r) => `${specKey}#${r.split("/").pop()}`),
            schema_registry: "cloud/_schema-registry.json",
          },
        };

        if (register(doc, join(CORPUS_ROOT, "cloud", "operations", `${id}.json`))) {
          stats.cloud_ops += 1;
          if (doc.deprecated) stats.deprecated += 1;
        }
      }
    }
  }

  writeJsonAtomic(join(CORPUS_ROOT, "cloud", "_schema-registry.json"), {
    generated_at: RETRIEVED_AT,
    source_repository: "creator-docs",
    source_commit: repo.commit,
    schema_count: Object.keys(schemaRegistry).length,
    note: "Keyed as '<specFile>#<SchemaName>'. Operations reference these instead of inlining them.",
    schemas: schemaRegistry,
  });
}

// ===========================================================================
// 3. Markdown normalization (language / tutorials / guides / news)
// ===========================================================================
function normalizeMarkdownSource({
  repository, files, outDir, sourceType, authority, category,
  semanticTopicFor, urlFor, counterKey, extraFor,
}) {
  const repo = repoInfo(repository);
  const dir = repoDir(repository);

  for (const rel of files) {
    let raw;
    try { raw = readFileSync(join(dir, rel), "utf8"); }
    catch (err) { fail(repository, rel, err, "high"); continue; }

    const { data: fm, body } = parseFrontMatter(raw, (s) => YAML.load(s));
    const text = normalizeNewlines(body);
    const title = deriveTitle(fm, text, rel);
    const sections = splitByHeadings(text);
    const url = urlFor(rel);

    if (sections.length === 0) {
      skipped.push({ path: rel, reason: "no extractable content after heading split" });
      continue;
    }

    sections.forEach((section, index) => {
      // The ordinal is part of the key because a single page may legitimately
      // repeat a heading path (creator-docs oauth2-reference.md documents
      // "POST v1/token" twice). Ordinal-qualifying keeps ids unique while
      // staying fully deterministic: same file at same commit, same order.
      const headingKey = section.heading_path.join(" > ") || "(root)";
      const sectionKey = `${index}:${headingKey}`;
      const id = documentId(repository, repo.commit, rel, sectionKey);
      const blocks = extractCodeBlocks(section.content);

      const doc = {
        source_id: id,
        source_repository: repository,
        source_commit: repo.commit,
        source_path: rel,
        source_url: section.heading_path.length
          ? `${url}#${encodeURIComponent(section.heading_path.at(-1).toLowerCase().replace(/\s+/g, "-"))}`
          : url,
        source_type: sourceType,
        authority,
        license: LICENSE[repository].prose,
        retrieved_at: RETRIEVED_AT,
        // Front matter date wins where present; otherwise the commit date.
        content_date: fm?.date ? new Date(fm.date).toISOString()
          : (/(\d{4}-\d{2}-\d{2})/.exec(rel)?.[1]
              ? new Date(/(\d{4}-\d{2}-\d{2})/.exec(rel)[1]).toISOString()
              : repo.commit_date),
        category,
        topic: `${category}.${rel.replace(/\.(md|mdx)$/, "").split("/").slice(-2).join(".")}`,
        semantic_topic: semanticTopicFor(rel, section),
        deprecated: false,
        title,
        document_title: title,
        heading_path: section.heading_path,
        section_title: section.title,
        chunk_index: index,
        chunk_total: sections.length,
        content: section.content,
        code_blocks: blocks,
        links: extractLinks(section.content),
        table_count: countTables(section.content),
        front_matter: Object.keys(fm ?? {}).length ? fm : undefined,
        ...(extraFor ? extraFor(rel, fm, section, index) : {}),
      };

      addCodeExamples(doc, blocks, sectionKey);
      Object.assign(doc, trackDuplicate(doc, section.content));

      const safe = rel.replace(/[^A-Za-z0-9._/-]/g, "_").replace(/\//g, "__").replace(/\.(md|mdx)$/, "");
      if (register(doc, join(CORPUS_ROOT, outDir, `${safe}__${index}.json`))) {
        stats[counterKey] += 1;
      }
    });
  }
}

// --- 3a. Luau site: canonical language reference ---------------------------
function normalizeLuauSite() {
  const dir = repoDir("site");
  const all = walk(dir);

  const langFiles = all.filter((f) =>
    /^src\/content\/docs\/(getting-started|reference|types)\//.test(f) && /\.(md|mdx)$/.test(f)
    || f === "src/content/docs/index.mdx");
  const guideFiles = all.filter((f) => /^src\/content\/docs\/guides\//.test(f) && /\.md$/.test(f));
  const newsFiles = all.filter((f) => /^src\/content\/news\//.test(f) && /\.md$/.test(f));

  normalizeMarkdownSource({
    repository: "site", files: langFiles, outDir: "language",
    sourceType: "language-reference", authority: "canonical", category: "luau-language",
    urlFor: siteUrl, counterKey: "language",
    // OV-005: the Luau attributes page is about TYPE attributes and must never
    // be conflated with Roblox Instance attributes.
    semanticTopicFor: (rel) =>
      rel.endsWith("reference/attributes.md") ? "luau-language-attributes" : "luau-language",
  });

  normalizeMarkdownSource({
    repository: "site", files: guideFiles, outDir: "guides",
    sourceType: "guide-md", authority: "canonical", category: "luau-guide",
    urlFor: siteUrl, counterKey: "guides",
    semanticTopicFor: () => "luau-guide",
  });

  normalizeMarkdownSource({
    repository: "site", files: newsFiles, outDir: "documents",
    sourceType: "news-md", authority: "historical", category: "luau-news",
    urlFor: siteUrl, counterKey: "news",
    semanticTopicFor: () => "luau-history",
    extraFor: () => ({ retrieval_weight: "low", historical: true }),
  });
}

// --- 3b. creator-docs Markdown --------------------------------------------
const SCRIPTING_TAGS = {
  "security": ["roblox-runtime", "security"],
  "events": ["roblox-runtime", "events"],
  "scheduler": ["roblox-runtime", "scheduler"],
  "capabilities": ["roblox-runtime", "capabilities"],
  "multithreading": ["roblox-runtime", "scheduler"],
  "services": ["roblox-runtime", "server-client"],
  "sync": ["roblox-runtime", "replication"],
  "attributes": ["roblox-runtime", "roblox-instance-attributes"],
};

function normalizeCreatorDocs() {
  const dir = repoDir("creator-docs");
  const all = walk(dir).filter((f) => f.endsWith(".md"));
  const under = (p) => all.filter((f) => f.startsWith(p));

  // Tutorials — sequence metadata derived from the path, never invented.
  normalizeMarkdownSource({
    repository: "creator-docs", files: under("content/en-us/tutorials/"),
    outDir: "tutorials", sourceType: "tutorial-md", authority: "canonical",
    category: "roblox-tutorial", urlFor: creatorDocsUrl, counterKey: "tutorials",
    semanticTopicFor: () => "roblox-tutorial",
    extraFor: (rel) => {
      const parts = rel.replace("content/en-us/tutorials/", "").replace(/\.md$/, "").split("/");
      const seq = {};
      if (parts.length >= 1) seq.course = parts[0];
      if (parts.length >= 2) seq.series = parts[1];
      if (parts.length >= 3) seq.lesson = parts[2];
      if (parts.length >= 4) seq.step = parts.slice(3).join("/");
      return { tutorial_sequence: seq, sequence_inferred_from: "path structure" };
    },
  });

  // Scripting / runtime.
  normalizeMarkdownSource({
    repository: "creator-docs", files: under("content/en-us/scripting/"),
    outDir: "guides", sourceType: "guide-md", authority: "canonical",
    category: "roblox-runtime", urlFor: creatorDocsUrl, counterKey: "scripting",
    // OV-005: Roblox INSTANCE attributes, distinct from Luau type attributes.
    semanticTopicFor: (rel) => {
      const leaf = rel.replace("content/en-us/scripting/", "").split("/")[0].replace(/\.md$/, "");
      return SCRIPTING_TAGS[leaf]?.[1] ?? "roblox-runtime";
    },
    extraFor: (rel) => {
      const leaf = rel.replace("content/en-us/scripting/", "").split("/")[0].replace(/\.md$/, "");
      return { tags: SCRIPTING_TAGS[leaf] ?? ["roblox-runtime", "scripting"] };
    },
  });

  // Assistant / AI — kept separate from ordinary coding reference.
  normalizeMarkdownSource({
    repository: "creator-docs",
    files: [...under("content/en-us/assistant/"), ...under("content/en-us/ai/"),
            ...all.filter((f) => f === "content/en-us/generative-AI.md" || f === "content/en-us/ai-data-sharing.md")],
    outDir: "documents", sourceType: "guide-md", authority: "canonical",
    category: "roblox-ai", urlFor: creatorDocsUrl, counterKey: "ai",
    semanticTopicFor: (rel) => rel.includes("/assistant/") ? "roblox-assistant" : "roblox-ai",
    extraFor: (rel) => ({
      tags: ["roblox-ai", rel.includes("/assistant/") ? "roblox-assistant" : "ai-workflow"],
      advisory_only: true,
      note: "Guidance for AI workflows. Must not override Engine API facts.",
    }),
  });

  // creator-docs Luau — secondary by OV-001.
  normalizeMarkdownSource({
    repository: "creator-docs", files: under("content/en-us/luau/"),
    outDir: "language", sourceType: "roblox-luau-guide", authority: "secondary",
    category: "roblox-luau", urlFor: creatorDocsUrl, counterKey: "roblox_luau",
    semanticTopicFor: () => "roblox-luau-guide",
    extraFor: () => ({ canonical_conflict_resolution: "site (luau.org) wins on language semantics — OV-001" }),
  });

  // Cloud guides + cloud reference prose.
  normalizeMarkdownSource({
    repository: "creator-docs",
    files: [...under("content/en-us/cloud/"), ...under("content/en-us/cloud-services/"),
            ...under("content/en-us/reference/cloud/")],
    outDir: "cloud", sourceType: "guide-md", authority: "canonical",
    category: "open-cloud", urlFor: creatorDocsUrl, counterKey: "guides",
    semanticTopicFor: () => "roblox-open-cloud",
  });

  // Engine topic areas.
  const topics = ["physics","ui","players","parts","animation","input","sound","effects","environment","characters","studio"];
  normalizeMarkdownSource({
    repository: "creator-docs",
    files: topics.flatMap((t) => under(`content/en-us/${t}/`)),
    outDir: "guides", sourceType: "guide-md", authority: "canonical",
    category: "roblox-guide", urlFor: creatorDocsUrl, counterKey: "guides",
    semanticTopicFor: (rel) => `roblox-${rel.split("/")[2]}`,
    extraFor: (rel) => ({ tags: ["roblox-guide", rel.split("/")[2]] }),
  });
}

// ===========================================================================
// Run
// ===========================================================================
console.log("Roblox Brain — corpus normalization\n" + "=".repeat(58));

// Refuse to run against drifted sources: a corpus built from an unknown commit
// is unreproducible and its provenance would be a lie.
for (const repo of LOCK.repositories) {
  const dir = repoDir(repo.name);
  if (!existsSync(dir)) { fail(repo.name, dir, "repository missing on disk", "critical"); continue; }
  const head = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== repo.commit) {
    fail(repo.name, dir, `HEAD ${head} does not match locked commit ${repo.commit}`, "critical");
  } else {
    console.log(`  lock verified  ${repo.name.padEnd(14)} ${head.slice(0, 12)}`);
  }
}
if (failures.some((f) => f.severity === "critical")) {
  console.error("\nCRITICAL: source lock mismatch. Refusing to build the corpus.\n");
  for (const f of failures) console.error(`  ${f.severity} ${f.source}: ${f.error}`);
  process.exit(1);
}

// Clean previous output so a rerun cannot leave orphans behind.
for (const sub of ["api","cloud","language","tutorials","guides","documents","metadata"]) {
  rmSync(join(CORPUS_ROOT, sub), { recursive: true, force: true });
  mkdirSync(join(CORPUS_ROOT, sub), { recursive: true });
}

console.log("\n  normalizing engine API...");   normalizeEngineApi();
console.log("  normalizing open cloud...");     normalizeOpenApi();
console.log("  normalizing luau site...");      normalizeLuauSite();
console.log("  normalizing creator-docs...");   normalizeCreatorDocs();

// --- registries ------------------------------------------------------------
codeExamples.sort((a, b) => a.example_id.localeCompare(b.example_id));
writeJsonAtomic(join(CORPUS_ROOT, "metadata", "code-examples.json"), {
  generated_at: RETRIEVED_AT,
  count: codeExamples.length,
  license_note: "creator-docs code samples are MIT even though its prose is CC-BY-4.0.",
  excluded_sources: ["luau/tests/**", "luau/bench/**", "luau/fuzz/**"],
  examples: codeExamples,
});

const exactDuplicates = [...contentIndex.entries()]
  .filter(([, ids]) => ids.length > 1)
  .map(([hash, ids]) => ({ content_hash: hash, canonical: ids[0], duplicates: ids.slice(1) }));

const nearDuplicates = [...nearDupeIndex.entries()]
  .filter(([, entries]) => entries.length > 1)
  .map(([key, entries]) => ({ key, count: entries.length, documents: entries.slice(0, 8) }));

writeJsonAtomic(join(CORPUS_ROOT, "metadata", "duplicates.json"), {
  generated_at: RETRIEVED_AT,
  policy: "Exact duplicates keep one canonical document and record the rest. Near-duplicates are REPORTED ONLY and never merged automatically.",
  exact_duplicate_groups: exactDuplicates.length,
  exact_duplicates: exactDuplicates,
  near_duplicate_groups: nearDuplicates.length,
  near_duplicates: nearDuplicates,
});

writeJsonAtomic(join(CORPUS_ROOT, "reports", "failures.json"), {
  generated_at: RETRIEVED_AT, failures, warnings, skipped,
});

writeJsonAtomic(join(CORPUS_ROOT, "manifest.json"), {
  corpus_version: 1,
  generated_at: RETRIEVED_AT,
  generator: "scripts/roblox-brain/normalize-corpus.mjs",
  status: "normalized-local-corpus",
  note: "Local normalized corpus only. No embeddings, no vector database, no retrieval layer.",
  source_commits: Object.fromEntries(LOCK.repositories.map((r) => [r.name, {
    commit: r.commit, branch: r.branch, commit_date: r.commit_date, license: r.license.content,
  }])),
  counts: {
    documents_total: stats.documents,
    engine_api_documents: stats.api,
    engine_api_members: stats.api_members,
    openapi_operations: stats.cloud_ops,
    openapi_schemas: stats.cloud_schemas,
    language_documents: stats.language,
    roblox_luau_documents: stats.roblox_luau,
    tutorial_documents: stats.tutorials,
    guide_documents: stats.guides,
    scripting_documents: stats.scripting,
    ai_documents: stats.ai,
    news_documents: stats.news,
    code_examples: stats.code_examples,
    deprecated_apis: stats.deprecated,
    exact_duplicate_groups: exactDuplicates.length,
    near_duplicate_groups: nearDuplicates.length,
  },
  license_counts: byLicense,
  authority_counts: byAuthority,
  source_type_counts: bySourceType,
  failures: failures.length,
  warnings: warnings.length,
  skipped: skipped.length,
});

// --- summary ---------------------------------------------------------------
console.log("\n" + "-".repeat(58));
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(16)} ${v}`);
console.log("-".repeat(58));
console.log(`  exact duplicate groups: ${exactDuplicates.length}`);
console.log(`  near duplicate groups : ${nearDuplicates.length}`);
console.log(`  failures: ${failures.length}  warnings: ${warnings.length}  skipped: ${skipped.length}`);
for (const f of failures.slice(0, 10)) console.log(`    FAIL [${f.severity}] ${f.source} ${f.path}: ${f.error}`);
console.log("=".repeat(58));

const hardFailures = failures.filter((f) => f.severity === "critical" || f.severity === "high");
console.log(hardFailures.length ? `  RESULT: FAILED (${hardFailures.length} hard failures)` : "  RESULT: OK");
process.exit(hardFailures.length ? 1 : 0);
