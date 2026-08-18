import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { getEmbeddingConfig, isEmbeddingConfigured, embedQuery } from "@/lib/knowledge/embeddings";
import { detectSymbols, looksLikeApiLookup, wantsDeprecated } from "@/lib/knowledge/symbols";

/**
 * Hybrid Roblox knowledge retriever.
 *
 * Pipeline: symbol detection -> exact API lookup + lexical FTS + vector search
 * -> merge -> dedupe -> deterministic rerank -> authority adjustment.
 *
 * Why hybrid rather than vector-only: programming queries hinge on exact
 * identifiers. "Players.PlayerAdded parameters" must return that precise API
 * entry, and embeddings alone reliably return *related* material instead. But
 * "what fires when a player joins" has no identifier at all, so lexical alone
 * fails too. Each branch covers the other's blind spot.
 */

export type KnowledgeCategory =
  | "engine-api" | "open-cloud" | "luau-language" | "roblox-luau"
  | "roblox-tutorial" | "roblox-runtime" | "roblox-guide" | "roblox-ai" | "luau-news";

export interface RetrievalFilters {
  category?: KnowledgeCategory;
  sourceType?: string;
  apiSymbol?: string;
  includeDeprecated?: boolean;
  includeCodeExamples?: boolean;
  limit?: number;
  minScore?: number;
}

export interface RetrievedChunk {
  chunk_id: string;
  source_id: string;
  title: string | null;
  heading_path: string[];
  content: string;
  api_symbols: string[];
  source_repository: string;
  source_type: string;
  source_path: string;
  source_url: string | null;
  source_commit: string;
  authority: "canonical" | "secondary" | "historical";
  license: string;
  category: string;
  semantic_topic: string | null;
  deprecated: boolean;
  token_estimate: number;
  score: number;
  signals: {
    exact_symbol: number;
    lexical: number;
    vector: number;
    authority: number;
    deprecation_penalty: number;
  };
}

export interface RetrievedCodeExample {
  example_id: string;
  source_id: string;
  language: string | null;
  code: string;
  context: string | null;
  api_symbols: string[];
  source_path: string;
  source_url: string | null;
  source_commit: string;
  authority: string;
  license: string;
  score: number;
}

export interface RetrievalResult {
  query: string;
  detected_symbols: string[];
  strategy: string;
  chunks: RetrievedChunk[];
  code_examples: RetrievedCodeExample[];
  latency_ms: number;
  embedding_version: string | null;
  vector_search_available: boolean;
}

/** Authority is a stronger signal than recency for stable API semantics. */
const AUTHORITY_WEIGHT: Record<string, number> = {
  canonical: 1.0,
  secondary: 0.72,
  historical: 0.45,
};

/** Nudges by document type, per the product's own opinion of usefulness. */
const TYPE_WEIGHT: Record<string, number> = {
  "engine-api-yaml": 1.0,
  "language-reference": 0.98,
  openapi: 0.95,
  "tutorial-md": 0.9,
  "guide-md": 0.88,
  "roblox-luau-guide": 0.72,
  "news-md": 0.4,
};

const DEPRECATION_PENALTY = 0.45;
const MAX_LIMIT = 40;

function clampLimit(n: number | undefined, fallback = 8) {
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n ?? fallback)));
}

/**
 * Turn a natural-language query into a Postgres websearch string.
 * Identifiers are quoted so `Players.PlayerAdded` survives as one term.
 */
function toWebSearchQuery(query: string, symbols: string[]): string {
  const cleaned = query.replace(/[^\w\s.:_-]/g, " ").trim();
  const quoted = symbols.slice(0, 4).map((s) => `"${s}"`);
  return [...quoted, cleaned].filter(Boolean).join(" ").slice(0, 500);
}

/** Query intent, used to pick section weights without hard-coding prompts. */
export function classifyIntent(query: string): {
  strategy: string;
  preferCategories: string[];
} {
  const q = query.toLowerCase();
  if (/open ?cloud|\bapi key\b|rest api|webhook|datastore api|oauth/.test(q)) {
    return { strategy: "open-cloud", preferCategories: ["open-cloud"] };
  }
  if (/\b(assistant|mcp|studio automation|copilot|agentic)\b/.test(q)) {
    return { strategy: "studio-ai", preferCategories: ["roblox-ai"] };
  }
  if (/\b(type|generic|typed|annotation|syntax|metatable|luau)\b/.test(q) && !/roblox instance/.test(q)) {
    return { strategy: "luau-language", preferCategories: ["luau-language", "roblox-luau"] };
  }
  if (looksLikeApiLookup(query)) {
    return { strategy: "api-lookup", preferCategories: ["engine-api"] };
  }
  if (/\bhow (do|to|can)\b|\bmake\b|\bbuild\b|\bcreate\b|\bimplement\b/.test(q)) {
    return { strategy: "implementation", preferCategories: ["engine-api", "roblox-tutorial", "roblox-guide"] };
  }
  return { strategy: "general", preferCategories: [] };
}

/**
 * Retrieve Roblox knowledge for a query.
 *
 * Every branch is a parameterized query — user text never becomes SQL. Limits
 * are clamped so a caller cannot request an unbounded context.
 */
export async function retrieveKnowledge(
  query: string,
  filters: RetrievalFilters = {},
): Promise<RetrievalResult> {
  const started = Date.now();
  const db = createAdminClient();

  const limit = clampLimit(filters.limit);
  const minScore = filters.minScore ?? 0.02;
  const detected = detectSymbols(query);
  const symbolNames = detected.map((s) => s.symbol);
  // Confidence matters as much as the match itself. A bare "Instance" lifted
  // from prose is a much weaker signal than a qualified "Players.PlayerAdded",
  // and treating them alike lets a common class name hijack a conceptual
  // question ("difference between Roblox Instance attributes and Luau type
  // attributes" should not return the Instance class).
  const confidenceBySymbol = new Map(detected.map((s) => [s.symbol.toLowerCase(), s.confidence]));
  const peakConfidence = detected.length ? Math.max(...detected.map((s) => s.confidence)) : 0;
  const { strategy, preferCategories } = classifyIntent(query);
  const allowDeprecated = filters.includeDeprecated ?? wantsDeprecated(query);

  const pool = new Map<string, RetrievedChunk>();
  const addSignal = (row: Record<string, unknown>, signal: keyof RetrievedChunk["signals"], value: number) => {
    const id = String(row.chunk_id ?? row.id);
    const existing = pool.get(id);
    if (existing) {
      existing.signals[signal] = Math.max(existing.signals[signal], value);
      return;
    }
    pool.set(id, {
      chunk_id: id,
      source_id: String(row.source_id),
      title: (row.title as string) ?? null,
      heading_path: (row.heading_path as string[]) ?? [],
      content: String(row.content ?? ""),
      api_symbols: (row.api_symbols as string[]) ?? [],
      source_repository: String(row.source_repository ?? ""),
      source_type: String(row.source_type ?? ""),
      source_path: String(row.source_path ?? ""),
      source_url: (row.source_url as string) ?? null,
      source_commit: String(row.source_commit ?? ""),
      authority: (row.authority as RetrievedChunk["authority"]) ?? "canonical",
      license: String(row.license ?? ""),
      category: String(row.category ?? ""),
      semantic_topic: (row.semantic_topic as string) ?? null,
      deprecated: Boolean(row.deprecated),
      token_estimate: Number(row.token_estimate ?? 0),
      score: 0,
      signals: { exact_symbol: 0, lexical: 0, vector: 0, authority: 0, deprecation_penalty: 0 },
    });
    pool.get(id)!.signals[signal] = value;
  };

  // --- 1. Exact API symbol lookup ------------------------------------------
  const targetSymbols = filters.apiSymbol ? [filters.apiSymbol, ...symbolNames] : symbolNames;
  if (targetSymbols.length) {
    const { data, error } = await db.rpc("knowledge_symbol_lookup", {
      p_symbols: targetSymbols.slice(0, 8),
      p_limit: limit * 2,
    });
    if (error) logger.warn("knowledge.symbol_lookup_failed", { error: error.message });
    for (const row of data ?? []) {
      // Exact hits are scored by match quality: a full qualified match beats a
      // prefix match, which beats a bare class name.
      addSignal(row as Record<string, unknown>, "exact_symbol", Number((row as { match_score: number }).match_score));
    }
  }

  // --- 2. Lexical full-text search -----------------------------------------
  const webQuery = toWebSearchQuery(query, symbolNames);
  if (webQuery) {
    const { data, error } = await db.rpc("knowledge_lexical_search", {
      p_query: webQuery,
      p_limit: limit * 3,
      p_category: filters.category ?? null,
      p_source_type: filters.sourceType ?? null,
    });
    if (error) logger.warn("knowledge.lexical_failed", { error: error.message });
    for (const row of data ?? []) {
      addSignal(row as Record<string, unknown>, "lexical", Number((row as { rank: number }).rank));
    }
  }

  // --- 3. Vector search ------------------------------------------------------
  const embeddingConfig = getEmbeddingConfig();
  let vectorAvailable = false;
  if (isEmbeddingConfigured(embeddingConfig)) {
    try {
      const vector = await embedQuery(query, embeddingConfig);
      const { data, error } = await db.rpc("knowledge_vector_search", {
        p_embedding: JSON.stringify(vector),
        p_version: embeddingConfig.version,
        p_limit: limit * 3,
        p_category: filters.category ?? null,
        p_source_type: filters.sourceType ?? null,
      });
      if (error) logger.warn("knowledge.vector_failed", { error: error.message });
      else vectorAvailable = true;
      for (const row of data ?? []) {
        addSignal(row as Record<string, unknown>, "vector", Number((row as { similarity: number }).similarity));
      }
    } catch (error) {
      // Vector search is an enhancement; lexical + symbol must still answer.
      logger.warn("knowledge.embed_query_failed", { error: String(error) });
    }
  }

  // --- 4. Rerank -------------------------------------------------------------
  const apiLookup = strategy === "api-lookup";
  // A comparison question wants breadth across topics, not the single best
  // exact hit, so exact-match dominance is relaxed for it.
  const comparison = /\b(difference|differ|versus|vs\.?|compare|compared)\b/i.test(query);

  for (const chunk of pool.values()) {
    const authorityWeight = AUTHORITY_WEIGHT[chunk.authority] ?? 0.5;
    const typeWeight = TYPE_WEIGHT[chunk.source_type] ?? 0.8;
    const categoryBoost = preferCategories.includes(chunk.category) ? 0.12 : 0;

    // Scale the exact-match signal by how confident we were that the query
    // really named this symbol.
    const chunkConfidence = Math.max(
      0,
      ...chunk.api_symbols.map((s) => confidenceBySymbol.get(s.toLowerCase()) ?? 0),
      confidenceBySymbol.get((chunk.title ?? "").toLowerCase()) ?? 0,
    );
    const confidenceFactor = chunkConfidence > 0 ? chunkConfidence : peakConfidence * 0.6;

    // Exact symbol matches dominate when the query names an API; otherwise
    // they contribute but do not steamroll semantic relevance.
    const exactWeight = (apiLookup ? 2.4 : 1.1) * (comparison ? 0.45 : 1);

    const base =
      chunk.signals.exact_symbol * exactWeight * confidenceFactor +
      chunk.signals.lexical * (apiLookup ? 0.9 : 1.15) +
      chunk.signals.vector * (apiLookup ? 0.6 : 1.35);

    const penalty = chunk.deprecated && !allowDeprecated ? DEPRECATION_PENALTY : 1;
    chunk.signals.authority = authorityWeight;
    chunk.signals.deprecation_penalty = penalty;
    chunk.score = (base + categoryBoost) * authorityWeight * typeWeight * penalty;
  }

  let chunks = [...pool.values()]
    .filter((c) => c.score >= minScore)
    .filter((c) => (filters.category ? c.category === filters.category : true))
    .filter((c) => (allowDeprecated ? true : !c.deprecated || c.signals.exact_symbol > 0))
    .sort((a, b) => b.score - a.score);

  // Keep at most 3 chunks from any one document so a single large class cannot
  // crowd out every other source.
  const perDocument = new Map<string, number>();
  chunks = chunks.filter((c) => {
    const n = perDocument.get(c.source_id) ?? 0;
    if (n >= 3) return false;
    perDocument.set(c.source_id, n + 1);
    return true;
  }).slice(0, limit);

  // --- 5. Code examples ------------------------------------------------------
  let codeExamples: RetrievedCodeExample[] = [];
  if (filters.includeCodeExamples !== false) {
    const { data, error } = await db.rpc("knowledge_code_search", {
      p_query: webQuery,
      p_symbols: targetSymbols.slice(0, 8),
      p_limit: clampLimit(filters.limit ? Math.ceil(filters.limit / 2) : 4, 4),
    });
    if (error) logger.warn("knowledge.code_search_failed", { error: error.message });
    codeExamples = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        example_id: String(r.example_id),
        source_id: String(r.source_id),
        language: (r.language as string) ?? null,
        code: String(r.code ?? ""),
        context: (r.context as string) ?? null,
        api_symbols: (r.api_symbols as string[]) ?? [],
        source_path: String(r.source_path ?? ""),
        source_url: (r.source_url as string) ?? null,
        source_commit: String(r.source_commit ?? ""),
        authority: String(r.authority ?? ""),
        license: String(r.license ?? ""),
        score: Number(r.rank ?? 0),
      };
    });
  }

  return {
    query,
    detected_symbols: symbolNames,
    strategy,
    chunks,
    code_examples: codeExamples,
    latency_ms: Date.now() - started,
    embedding_version: vectorAvailable ? embeddingConfig.version : null,
    vector_search_available: vectorAvailable,
  };
}

/**
 * Look up one exact API symbol.
 *
 * Separate from `retrieveKnowledge` because the agent's question is different:
 * not "what is relevant to this request" but "does this member exist, and what
 * is its signature". Blending that into a ranked hybrid search would let a
 * lexically similar page outrank the definitive one — and an empty result here
 * is meaningful, because it means the model invented the name.
 */
export async function searchKnowledgeBySymbol(
  symbol: string,
  limit = 4,
): Promise<RetrievedChunk[]> {
  const db = createAdminClient();
  const detected = detectSymbols(symbol).map((s) => s.symbol);
  const candidates = [symbol, ...detected].slice(0, 4);

  const { data, error } = await db.rpc("knowledge_symbol_lookup", {
    p_symbols: candidates,
    p_limit: clampLimit(limit, 4),
  });

  if (error) {
    logger.warn("knowledge.symbol_lookup_failed", { error: error.message });
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      chunk_id: String(r.chunk_id),
      source_id: String(r.source_id),
      title: (r.title as string) ?? null,
      heading_path: (r.heading_path as string[]) ?? [],
      content: String(r.content ?? ""),
      api_symbols: (r.api_symbols as string[]) ?? [],
      source_repository: String(r.source_repository ?? ""),
      source_type: String(r.source_type ?? ""),
      source_path: String(r.source_path ?? ""),
      source_url: (r.source_url as string) ?? null,
      source_commit: String(r.source_commit ?? ""),
      authority: (r.authority as RetrievedChunk["authority"]) ?? "canonical",
      license: String(r.license ?? ""),
      category: String(r.category ?? ""),
      semantic_topic: (r.semantic_topic as string) ?? null,
      deprecated: Boolean(r.deprecated),
      token_estimate: Number(r.token_estimate ?? 0),
      score: Number(r.match_score ?? 0),
      signals: {
        exact_symbol: Number(r.match_score ?? 0),
        lexical: 0,
        vector: 0,
        authority: 0,
        deprecation_penalty: 0,
      },
    };
  });
}

/** Documentation code examples, without running the full retrieval pipeline. */
export async function searchCodeExamples(
  query: string,
  symbols: string[] = [],
  limit = 4,
): Promise<RetrievedCodeExample[]> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("knowledge_code_search", {
    p_query: query,
    p_symbols: symbols.slice(0, 8),
    p_limit: clampLimit(limit, 4),
  });

  if (error) {
    logger.warn("knowledge.code_search_failed", { error: error.message });
    return [];
  }

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      example_id: String(r.example_id),
      source_id: String(r.source_id),
      language: (r.language as string) ?? null,
      code: String(r.code ?? ""),
      context: (r.context as string) ?? null,
      api_symbols: (r.api_symbols as string[]) ?? [],
      source_path: String(r.source_path ?? ""),
      source_url: (r.source_url as string) ?? null,
      source_commit: String(r.source_commit ?? ""),
      authority: String(r.authority ?? "canonical"),
      license: String(r.license ?? ""),
      score: Number(r.rank ?? 0),
    };
  });
}
