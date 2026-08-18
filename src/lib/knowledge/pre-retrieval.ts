import "server-only";

import { retrieveKnowledge } from "@/lib/knowledge/retriever";
import { buildKnowledgeContext, type Citation } from "@/lib/knowledge/context-builder";
import { detectSymbols } from "@/lib/knowledge/symbols";
import { logger } from "@/lib/logger";

/**
 * Pre-generation retrieval.
 *
 * The Roblox Brain sits *between* the user and the model: a Roblox technical
 * request is answered with retrieved documentation already in context, rather
 * than the model being handed the bare question and hoping it remembers an API
 * correctly.
 *
 * The knowledge tool still exists for follow-up lookups mid-turn. This stage
 * just means the common case — "how do I do X in Roblox" — never depends on the
 * model choosing to call it.
 *
 * Trivial conversational turns skip retrieval entirely. Spending ~2.4s and a
 * few thousand context tokens on "thanks" would be pure waste.
 */

export interface PreRetrievalResult {
  /** Context block to append to the system instructions, or null when skipped. */
  context: string | null;
  citations: Citation[];
  /** Why retrieval ran or did not. */
  reason: string;
  retrieved: boolean;
  chunk_count: number;
  code_example_count: number;
  detected_symbols: string[];
  strategy: string | null;
  latency_ms: number;
  vector_search_available: boolean;
}

const EMPTY: PreRetrievalResult = {
  context: null,
  citations: [],
  reason: "skipped",
  retrieved: false,
  chunk_count: 0,
  code_example_count: 0,
  detected_symbols: [],
  strategy: null,
  latency_ms: 0,
  vector_search_available: false,
};

/** Greetings, thanks, and other turns with no technical content. */
const TRIVIAL = /^\s*(hi|hey|hello|yo|sup|thanks?|thank you|ty|ok(ay)?|cool|nice|great|got it|sounds good|perfect|no|yes|yep|nope|bye|cheers)[\s!.?]*$/i;

const CAPABILITY_QUESTION = /^\s*(what can you do|who are you|what are you|help)\b/i;

/** Words that mark a turn as Roblox-technical even without an API symbol. */
const TECHNICAL = new RegExp(
  [
    "roblox", "luau", "studio", "script", "remote ?event", "remote ?function",
    "datastore", "data ?store", "memorystore", "leaderstats", "humanoid",
    "workspace", "replicated", "server", "client", "gui", "ui", "tween",
    "raycast", "physics", "animation", "character", "tool", "part", "instance",
    "service", "event", "player", "spawn", "teleport", "npc", "pathfind",
    "collision", "attribute", "module", "require", "pcall", "coroutine",
    "type", "generic", "metatable", "open ?cloud", "api", "how do i",
    "how to", "make a", "build a", "create a", "implement", "fix", "error",
    "why does", "what is", "difference between",
  ].join("|"),
  "i",
);

export interface PreRetrievalOptions {
  maxChunks?: number;
  maxTokens?: number;
  /** Force retrieval on or off, bypassing the heuristic. */
  force?: boolean;
}

/**
 * Decide whether this turn warrants retrieval, and run it if so.
 *
 * Never throws: a knowledge failure degrades the answer, it does not kill the
 * turn. The caller sees `retrieved: false` and a reason.
 */
export async function preRetrieveForTurn(
  userText: string,
  options: PreRetrievalOptions = {},
): Promise<PreRetrievalResult> {
  const text = userText.trim();

  if (!options.force) {
    // Order matters: short greetings like "hi" and "ok" are conversational, not
    // empty, and classifying them by length first would mislabel them.
    if (TRIVIAL.test(text)) return { ...EMPTY, reason: "conversational" };
    if (text.length < 3) return { ...EMPTY, reason: "empty-message" };
    if (CAPABILITY_QUESTION.test(text) && text.length < 40) {
      return { ...EMPTY, reason: "capability-question" };
    }

    const hasSymbol = detectSymbols(text).length > 0;
    if (!hasSymbol && !TECHNICAL.test(text)) {
      return { ...EMPTY, reason: "not-roblox-technical" };
    }
  }

  try {
    const result = await retrieveKnowledge(text, {
      limit: options.maxChunks ?? 8,
      includeCodeExamples: true,
      includeDeprecated: false,
    });

    const built = buildKnowledgeContext(result, {
      maxChunks: options.maxChunks ?? 8,
      maxTokens: options.maxTokens ?? 6000,
      includeCodeExamples: true,
    });

    if (built.chunk_count === 0 && built.code_example_count === 0) {
      return {
        ...EMPTY,
        reason: "no-matching-documentation",
        detected_symbols: result.detected_symbols,
        strategy: result.strategy,
        latency_ms: result.latency_ms,
        vector_search_available: result.vector_search_available,
      };
    }

    return {
      context: built.text,
      citations: built.citations,
      reason: "retrieved",
      retrieved: true,
      chunk_count: built.chunk_count,
      code_example_count: built.code_example_count,
      detected_symbols: result.detected_symbols,
      strategy: result.strategy,
      latency_ms: result.latency_ms,
      vector_search_available: result.vector_search_available,
    };
  } catch (error) {
    // Retrieval is an enhancement. If the knowledge layer is down the model
    // should still answer, and should know its knowledge was unavailable.
    logger.warn("brain.pre_retrieval_failed", { error: String(error) });
    return { ...EMPTY, reason: "retrieval-failed" };
  }
}

/** Human-readable citation label, e.g. "Roblox Creator Documentation — Players". */
export function citationLabel(citation: Citation): string {
  const source =
    citation.sourceRepository === "site"
      ? "Luau Reference"
      : "Roblox Creator Documentation";
  return `${source} — ${citation.title}`;
}

/**
 * Citations shaped for the client. Deliberately excludes database ids and
 * internal paths beyond the repo-relative one, and never fabricates a URL — a
 * citation with no canonical URL is returned with `url: null`.
 */
export interface PublicCitation {
  label: string;
  title: string;
  url: string | null;
  repository: string;
  authority: string;
  license: string;
  deprecated: boolean;
}

export function toPublicCitations(citations: Citation[]): PublicCitation[] {
  const seen = new Set<string>();
  const out: PublicCitation[] = [];

  for (const c of citations) {
    const key = c.sourceUrl ?? `${c.sourceRepository}:${c.sourcePath}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      label: citationLabel(c),
      title: c.title,
      url: c.sourceUrl,
      repository: c.sourceRepository,
      authority: c.authority,
      license: c.license,
      deprecated: c.deprecated,
    });
  }

  return out;
}
