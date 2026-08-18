import { extractIndexableSymbols, estimateTokens } from "@/lib/knowledge/symbols";

/**
 * Source-aware chunking.
 *
 * The corpus already carries semantic structure, so chunking respects it rather
 * than slicing by character count. Two failure modes are avoided deliberately:
 * chunks so small they carry no usable context, and chunks so large they crowd
 * out everything else in the model's window.
 */

const MIN_TOKENS = 24;      // below this a chunk answers nothing on its own
const MAX_TOKENS = 900;     // above this a single hit dominates the context
const HARD_SPLIT_TOKENS = 1400;

export interface Chunk {
  chunk_index: number;
  title: string | null;
  heading_path: string[];
  api_symbols: string[];
  content: string;
  token_estimate: number;
}

function finalize(
  parts: { title: string | null; heading_path: string[]; content: string }[],
): Chunk[] {
  return parts
    .map((p) => ({ ...p, content: p.content.trim() }))
    .filter((p) => p.content.length > 0)
    .map((p, index) => ({
      chunk_index: index,
      title: p.title,
      heading_path: p.heading_path,
      api_symbols: extractIndexableSymbols(`${p.title ?? ""} ${p.content}`),
      content: p.content,
      token_estimate: estimateTokens(p.content),
    }));
}

/** Render a value compactly without inventing or dropping information. */
function renderValue(value: unknown, indent = ""): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => `${indent}- ${renderValue(v, `${indent}  `)}`).join("\n");
  }
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${indent}${k}: ${renderValue(v, `${indent}  `)}`)
    .join("\n");
}

/**
 * Engine API.
 *
 * One chunk for the class itself, then one per member. Each member chunk
 * repeats its class context — inheritance, the qualified name — because a
 * retrieved "PlayerAdded" fragment is useless if the reader cannot tell which
 * class it belongs to.
 */
function chunkEngineApi(doc: Record<string, unknown>): Chunk[] {
  const api = (doc.api ?? {}) as Record<string, unknown>;
  const name = String(api.name ?? doc.title ?? "unknown");
  const kind = String(api.type ?? "class");
  const parts: { title: string | null; heading_path: string[]; content: string }[] = [];

  const header: string[] = [`${kind}: ${name}`];
  if (api.summary) header.push(`Summary: ${api.summary}`);
  if (api.description) header.push(`Description: ${api.description}`);
  if (Array.isArray(api.inherits) && api.inherits.length) header.push(`Inherits: ${api.inherits.join(", ")}`);
  if (Array.isArray(api.tags) && api.tags.length) header.push(`Tags: ${api.tags.join(", ")}`);
  if (api.memory_category) header.push(`Memory category: ${api.memory_category}`);
  if (api.deprecation_message) header.push(`DEPRECATED: ${api.deprecation_message}`);

  const memberKeys = ["properties", "methods", "events", "callbacks", "functions", "items"] as const;
  const counts = memberKeys
    .map((k) => (Array.isArray(api[k]) ? `${(api[k] as unknown[]).length} ${k}` : null))
    .filter(Boolean);
  if (counts.length) header.push(`Members: ${counts.join(", ")}`);

  parts.push({ title: name, heading_path: [name], content: header.join("\n") });

  for (const key of memberKeys) {
    const members = api[key];
    if (!Array.isArray(members)) continue;

    for (const raw of members as Record<string, unknown>[]) {
      const memberName = String(raw.name ?? "unnamed");
      // Engine YAML already qualifies member names (e.g. "Players.PlayerAdded").
      const qualified = memberName.includes(".") || memberName.includes(":")
        ? memberName : `${name}.${memberName}`;

      const lines: string[] = [
        `${name} — ${key.replace(/s$/, "")}: ${qualified}`,
      ];
      if (Array.isArray(api.inherits) && api.inherits.length) {
        lines.push(`Class inherits: ${api.inherits.join(", ")}`);
      }
      if (raw.summary) lines.push(`Summary: ${raw.summary}`);
      if (raw.description) lines.push(`Description: ${raw.description}`);
      if (raw.type) lines.push(`Type: ${renderValue(raw.type)}`);
      if (raw.value_type) lines.push(`Value type: ${renderValue(raw.value_type)}`);
      if (Array.isArray(raw.parameters) && raw.parameters.length) {
        lines.push(`Parameters:\n${renderValue(raw.parameters, "  ")}`);
      }
      if (raw.returns) lines.push(`Returns:\n${renderValue(raw.returns, "  ")}`);
      if (raw.security) lines.push(`Security: ${renderValue(raw.security)}`);
      if (raw.thread_safety) lines.push(`Thread safety: ${raw.thread_safety}`);
      if (raw.capabilities) lines.push(`Capabilities: ${renderValue(raw.capabilities)}`);
      if (Array.isArray(raw.tags) && raw.tags.length) lines.push(`Tags: ${raw.tags.join(", ")}`);
      if (raw.deprecation_message) lines.push(`DEPRECATED: ${raw.deprecation_message}`);
      if (Array.isArray(raw.code_samples) && raw.code_samples.length) {
        lines.push(`Code sample:\n${raw.code_samples.map((c) => String(c)).join("\n\n")}`);
      }

      parts.push({ title: qualified, heading_path: [name, qualified], content: lines.join("\n") });
    }
  }

  return finalize(parts);
}

/** OpenAPI: one chunk per operation, structure intact. */
function chunkOpenApi(doc: Record<string, unknown>): Chunk[] {
  const oa = (doc.openapi ?? {}) as Record<string, unknown>;
  const title = `${oa.http_method ?? ""} ${oa.path ?? ""}`.trim();

  const lines: string[] = [`Open Cloud operation: ${title}`];
  if (oa.operationId) lines.push(`operationId: ${oa.operationId}`);
  if (oa.spec_title) lines.push(`API: ${oa.spec_title}`);
  if (oa.summary) lines.push(`Summary: ${oa.summary}`);
  if (oa.description) lines.push(`Description: ${oa.description}`);
  if (Array.isArray(oa.tags) && oa.tags.length) lines.push(`Tags: ${oa.tags.join(", ")}`);
  if (Array.isArray(oa.parameters) && oa.parameters.length) {
    lines.push(`Parameters:\n${renderValue(oa.parameters, "  ")}`);
  }
  if (oa.requestBody) lines.push(`Request body:\n${renderValue(oa.requestBody, "  ")}`);
  if (oa.responses) lines.push(`Responses:\n${renderValue(oa.responses, "  ")}`);
  if (oa.security) lines.push(`Authentication:\n${renderValue(oa.security, "  ")}`);
  if (Array.isArray(oa.schema_refs) && oa.schema_refs.length) {
    lines.push(`Schema references: ${oa.schema_refs.join(", ")}`);
  }
  if (oa.deprecated) lines.push("DEPRECATED: this operation is marked deprecated.");

  return finalize([{ title, heading_path: [String(oa.spec_title ?? "Open Cloud"), title], content: lines.join("\n") }]);
}

/**
 * Markdown. The corpus already split by heading, so a document is usually one
 * coherent section. Oversized sections are split on paragraph boundaries — and
 * never inside a fenced code block, because a half a code sample is worse than
 * no code sample.
 */
function chunkMarkdown(doc: Record<string, unknown>): Chunk[] {
  const content = String(doc.content ?? "");
  const title = (doc.section_title ?? doc.title ?? null) as string | null;
  const headingPath = (doc.heading_path ?? []) as string[];

  if (estimateTokens(content) <= HARD_SPLIT_TOKENS) {
    return finalize([{ title, heading_path: headingPath, content }]);
  }

  // Split on blank lines while tracking fence state.
  const lines = content.split("\n");
  const blocks: string[] = [];
  let buffer: string[] = [];
  let fence: string | null = null;

  for (const line of lines) {
    const f = /^(\s*)(`{3,}|~{3,})/.exec(line);
    if (f) fence = fence ? null : f[2];
    if (line.trim() === "" && !fence) {
      if (buffer.length) { blocks.push(buffer.join("\n")); buffer = []; }
      continue;
    }
    buffer.push(line);
  }
  if (buffer.length) blocks.push(buffer.join("\n"));

  const parts: { title: string | null; heading_path: string[]; content: string }[] = [];
  let current: string[] = [];
  let tokens = 0;

  for (const block of blocks) {
    const blockTokens = estimateTokens(block);
    if (tokens + blockTokens > MAX_TOKENS && current.length) {
      parts.push({ title, heading_path: headingPath, content: current.join("\n\n") });
      current = []; tokens = 0;
    }
    current.push(block);
    tokens += blockTokens;
  }
  if (current.length) parts.push({ title, heading_path: headingPath, content: current.join("\n\n") });

  // A trailing scrap gets folded back rather than shipped as a useless chunk.
  const merged: typeof parts = [];
  for (const p of parts) {
    if (merged.length && estimateTokens(p.content) < MIN_TOKENS) {
      merged[merged.length - 1].content += `\n\n${p.content}`;
    } else merged.push(p);
  }

  return finalize(merged);
}

/** Dispatch on the corpus document's own source_type. */
export function chunkDocument(doc: Record<string, unknown>): Chunk[] {
  switch (doc.source_type) {
    case "engine-api-yaml": return chunkEngineApi(doc);
    case "openapi":         return chunkOpenApi(doc);
    default:                return chunkMarkdown(doc);
  }
}

export const CHUNK_LIMITS = { MIN_TOKENS, MAX_TOKENS, HARD_SPLIT_TOKENS };
