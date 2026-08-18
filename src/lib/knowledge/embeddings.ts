import "server-only";

import { logger } from "@/lib/logger";

/**
 * Configurable embedding provider.
 *
 * The generation model and the embedding model are deliberately independent:
 * swapping the LLM must never require rebuilding the knowledge base. Provider
 * selection is environment-driven, and every embedding is stored with the model
 * and version that produced it so a change is additive rather than destructive.
 */

export type EmbeddingProviderId = "openrouter" | "openai" | "google" | "custom";

export interface EmbeddingConfig {
  provider: EmbeddingProviderId;
  model: string;
  dimensions: number;
  version: string;
  baseUrl: string;
  apiKey: string | undefined;
  batchSize: number;
  concurrency: number;
}

/**
 * 1536 dimensions is the default because pgvector's HNSW index tops out at
 * 2000 — a 3072-dim model cannot be HNSW-indexed and would fall back to a
 * sequential scan.
 */
const DEFAULTS: Record<EmbeddingProviderId, { model: string; dimensions: number; baseUrl: string }> = {
  openrouter: { model: "openai/text-embedding-3-small", dimensions: 1536, baseUrl: "https://openrouter.ai/api/v1" },
  openai:     { model: "text-embedding-3-small",        dimensions: 1536, baseUrl: "https://api.openai.com/v1" },
  google:     { model: "gemini-embedding-001",          dimensions: 1536, baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  custom:     { model: "text-embedding-3-small",        dimensions: 1536, baseUrl: "http://localhost:8080/v1" },
};

function resolveProvider(): EmbeddingProviderId {
  const explicit = process.env.EMBEDDING_PROVIDER as EmbeddingProviderId | undefined;
  if (explicit && explicit in DEFAULTS) return explicit;
  // Fall back to whichever key exists, so a working deployment needs no extra config.
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  return "openrouter";
}

function apiKeyFor(provider: EmbeddingProviderId): string | undefined {
  switch (provider) {
    case "openai":     return process.env.OPENAI_API_KEY;
    case "openrouter": return process.env.OPENROUTER_API_KEY;
    case "google":     return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "custom":     return process.env.EMBEDDING_API_KEY;
  }
}

export function getEmbeddingConfig(): EmbeddingConfig {
  const provider = resolveProvider();
  const d = DEFAULTS[provider];
  const model = process.env.EMBEDDING_MODEL ?? d.model;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? d.dimensions);

  return {
    provider,
    model,
    dimensions,
    // Version string is what makes re-embedding additive.
    version: process.env.EMBEDDING_VERSION ?? `${provider}:${model}:${dimensions}`,
    baseUrl: process.env.EMBEDDING_BASE_URL ?? d.baseUrl,
    apiKey: apiKeyFor(provider),
    batchSize: Number(process.env.EMBEDDING_BATCH_SIZE ?? 96),
    concurrency: Number(process.env.EMBEDDING_CONCURRENCY ?? 4),
  };
}

export function isEmbeddingConfigured(config = getEmbeddingConfig()): boolean {
  return Boolean(config.apiKey);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Embed one batch, retrying on transient failures with exponential backoff and
 * jitter. 429 and 5xx are retried; a 4xx that is not 429 is a request problem
 * and retrying it just burns quota.
 */
async function embedBatch(
  inputs: string[],
  config: EmbeddingConfig,
  attempt = 0,
): Promise<number[][]> {
  const maxAttempts = 5;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      headers["X-Title"] = "Blockwright Roblox Brain";
    }

    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: config.model, input: inputs }),
    });

    if (!response.ok) {
      const retriable = response.status === 429 || response.status >= 500;
      const body = await response.text().catch(() => "");
      if (retriable && attempt < maxAttempts - 1) {
        const wait = Math.min(30_000, 2 ** attempt * 1000) + Math.random() * 500;
        logger.warn("embedding.retry", { status: response.status, attempt, waitMs: Math.round(wait) });
        await sleep(wait);
        return embedBatch(inputs, config, attempt + 1);
      }
      throw new Error(`embedding HTTP ${response.status}: ${body.slice(0, 200)}`);
    }

    const json = (await response.json()) as { data?: { embedding: number[]; index?: number }[] };
    if (!json.data || json.data.length !== inputs.length) {
      throw new Error(`embedding returned ${json.data?.length ?? 0} vectors for ${inputs.length} inputs`);
    }

    // Providers may return out of order; index is authoritative when present.
    const ordered = [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    return ordered.map((d) => d.embedding);
  } catch (error) {
    if (attempt < maxAttempts - 1) {
      const wait = Math.min(30_000, 2 ** attempt * 1000) + Math.random() * 500;
      await sleep(wait);
      return embedBatch(inputs, config, attempt + 1);
    }
    throw error;
  }
}

/**
 * Embed many texts with batching and bounded concurrency.
 * `onProgress` lets the caller checkpoint, which is what makes ingestion
 * resumable across a crash.
 */
export async function embedTexts(
  texts: string[],
  options: {
    config?: EmbeddingConfig;
    onProgress?: (done: number, total: number) => void;
    onBatch?: (offset: number, vectors: number[][]) => Promise<void>;
  } = {},
): Promise<number[][]> {
  const config = options.config ?? getEmbeddingConfig();
  if (!config.apiKey) throw new Error("No embedding API key configured");

  const batches: { offset: number; inputs: string[] }[] = [];
  for (let i = 0; i < texts.length; i += config.batchSize) {
    batches.push({ offset: i, inputs: texts.slice(i, i + config.batchSize) });
  }

  const results: number[][] = new Array(texts.length);
  let done = 0;
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= batches.length) return;
      const batch = batches[index];
      const vectors = await embedBatch(batch.inputs, config);
      for (let i = 0; i < vectors.length; i += 1) results[batch.offset + i] = vectors[i];
      if (options.onBatch) await options.onBatch(batch.offset, vectors);
      done += batch.inputs.length;
      options.onProgress?.(done, texts.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(config.concurrency, batches.length) }, worker),
  );

  return results;
}

/** Single-text convenience for query embedding. */
export async function embedQuery(text: string, config = getEmbeddingConfig()): Promise<number[]> {
  const [vector] = await embedTexts([text], { config });
  return vector;
}
