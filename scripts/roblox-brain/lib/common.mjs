/**
 * Shared helpers for the Roblox Brain corpus tooling.
 *
 * Kept deliberately small and dependency-light. The only third-party import in
 * the whole pipeline is js-yaml, used to read Roblox's generated Engine API
 * files.
 */

import { createHash } from "node:crypto";
import { writeFileSync, renameSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const SOURCE_ROOT = join(homedir(), "Documents", "Blockwright-Sources");
export const CORPUS_ROOT = "docs/roblox-brain/corpus";

/** Canonical URL bases, established in Step 3. */
export const URL_BASE = {
  "creator-docs": "https://create.roblox.com/docs",
  site: "https://luau.org",
};

/**
 * Deterministic document id.
 *
 * Hash of repository + commit + path + logical section, so the same source at
 * the same commit always yields the same id. Never random — a random id would
 * make the corpus non-reproducible and impossible to diff between runs.
 */
export function documentId(repository, commit, path, section = "") {
  const key = `${repository}|${commit}|${path}|${section}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 24);
}

/** Content hash, used for exact-duplicate detection. */
export function contentHash(text) {
  return createHash("sha256").update(normalizeNewlines(text)).digest("hex");
}

/** Representation only: CRLF -> LF, strip BOM, trim trailing whitespace. */
export function normalizeNewlines(text) {
  return String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
}

/**
 * Atomic write: serialise to a temp file in the same directory, then rename.
 * A crash mid-run can therefore never leave a half-written JSON document.
 */
export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  // Stable key order so byte-identical input yields byte-identical output.
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** creator-docs path -> published URL. */
export function creatorDocsUrl(sourcePath) {
  let p = sourcePath.replace(/^content\/en-us\//, "").replace(/\.(md|yaml|json)$/i, "");
  p = p.replace(/\/index$/i, "");
  return `${URL_BASE["creator-docs"]}/${p}`;
}

/** luau site path -> published URL. */
export function siteUrl(sourcePath) {
  let p = sourcePath.replace(/^src\/content\/docs\//, "").replace(/^src\/content\//, "");
  p = p.replace(/\.(md|mdx)$/i, "").replace(/\/index$/i, "");
  return `${URL_BASE.site}/${p}`;
}

/**
 * Heading-aware Markdown splitter.
 *
 * Splits on ATX headings while tracking the heading path, and — critically —
 * never splits inside a fenced code block. A fence opened before a heading
 * keeps that heading as ordinary content, which is what stops a code sample
 * being torn in half.
 */
export function splitByHeadings(markdown) {
  const lines = normalizeNewlines(markdown).split("\n");
  const sections = [];
  let fence = null;
  let current = { headingPath: [], title: null, lines: [], startLine: 1 };

  const push = () => {
    const content = current.lines.join("\n").trim();
    if (content || current.title) {
      sections.push({
        title: current.title,
        heading_path: [...current.headingPath],
        content,
        start_line: current.startLine,
      });
    }
  };

  lines.forEach((line, index) => {
    const fenceMatch = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[2];
      if (!fence) fence = marker[0].repeat(3);
      else if (marker.startsWith(fence)) fence = null;
      current.lines.push(line);
      return;
    }

    const heading = !fence && /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      push();
      const depth = heading[1].length;
      const title = heading[2].replace(/\s*#+\s*$/, "").trim();
      const path = current.headingPath.slice(0, depth - 1);
      path[depth - 1] = title;
      current = {
        headingPath: path.filter((v) => v !== undefined),
        title,
        lines: [],
        startLine: index + 1,
      };
      return;
    }

    current.lines.push(line);
  });

  push();
  return sections.filter((s) => s.content.length > 0);
}

/** Extract fenced code blocks verbatim. Code is never rewritten. */
export function extractCodeBlocks(markdown) {
  const blocks = [];
  const re = /^([ \t]*)(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n?\1\2[ \t]*$/gm;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const info = (m[3] || "").trim();
    blocks.push({
      language: info.split(/\s+/)[0] || null,
      info: info || null,
      code: m[4] ?? "",
    });
  }
  return blocks;
}

/** Parse YAML front matter, returning { data, body }. */
export function parseFrontMatter(text, yamlLoad) {
  const t = normalizeNewlines(text);
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return { data: {}, body: t };
  let data = {};
  try {
    data = yamlLoad(m[1]) ?? {};
  } catch {
    data = {};
  }
  return { data, body: t.slice(m[0].length) };
}

/** Extract Markdown links (for link preservation metadata). */
export function extractLinks(markdown) {
  const links = [];
  const re = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) links.push({ text: m[1], href: m[2] });
  return links;
}

/** Detect Markdown tables so the validator can confirm they survived. */
export function countTables(markdown) {
  return (markdown.match(/^\|.+\|\s*$\n^\|[\s:|-]+\|\s*$/gm) ?? []).length;
}

/** Title from front matter, first H1, or filename. */
export function deriveTitle(frontMatter, markdown, sourcePath) {
  if (frontMatter?.title) return String(frontMatter.title);
  const h1 = /^#\s+(.+)$/m.exec(markdown);
  if (h1) return h1[1].trim();
  return (sourcePath.split("/").pop() ?? sourcePath).replace(/\.(md|mdx|yaml)$/i, "");
}
