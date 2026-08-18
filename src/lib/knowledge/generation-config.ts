import "server-only";

import { MODELS, type ModelDefinition } from "@/lib/ai/registry";
import { isProviderAvailable } from "@/lib/ai/providers";
import { getEmbeddingConfig, isEmbeddingConfigured } from "@/lib/knowledge/embeddings";

/**
 * Central configuration for the Roblox Brain's generation model.
 *
 * One place decides which model answers Roblox questions, so nothing else in
 * the app hard-codes a model id. Changing `ROBLOX_BRAIN_MODEL` changes the
 * generation model without touching the knowledge base — the two are
 * deliberately independent, which is what lets a self-hosted Roblox-specialised
 * model later be evaluated against a hosted one on identical retrieval.
 */

export const DEFAULT_BRAIN_MODEL = "openai/gpt-5.6-sol";

export interface BrainGenerationConfig {
  /** Provider routing this model. Only OpenRouter is implemented today. */
  provider: "openrouter";
  /** Exact provider slug, e.g. `openai/gpt-5.6-sol`. */
  model: string;
  /** Internal registry id, e.g. `openrouter:openai/gpt-5.6-sol`. */
  registryId: string;
  configured: boolean;
  /** Present when the model cannot be used, for an honest status response. */
  unavailableReason?: string;
}

export function getBrainModelSlug(): string {
  const configured = process.env.ROBLOX_BRAIN_MODEL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_BRAIN_MODEL;
}

export function getBrainGenerationConfig(): BrainGenerationConfig {
  const model = getBrainModelSlug();
  const registryId = `openrouter:${model}`;
  const providerReady = isProviderAvailable("openrouter");

  return {
    provider: "openrouter",
    model,
    registryId,
    configured: providerReady,
    unavailableReason: providerReady
      ? undefined
      : "OPENROUTER_API_KEY is not set on the server.",
  };
}

/**
 * The registry entry for the configured Brain model.
 *
 * Returns undefined when the slug is not in the curated registry — the caller
 * must surface that rather than silently substituting another model, because a
 * quiet fallback would bill the user for a model they did not choose.
 */
export function getBrainModelDefinition(
  catalog: ModelDefinition[] = MODELS,
): ModelDefinition | undefined {
  const { registryId } = getBrainGenerationConfig();
  return catalog.find((m) => m.id === registryId && m.enabled);
}

export type SubsystemStatus = "ready" | "not-configured" | "error";

export interface BrainStatus {
  brain: SubsystemStatus;
  generationProvider: SubsystemStatus;
  generationProviderName: "OpenRouter";
  generationModel: string;
  knowledgeDatabase: SubsystemStatus;
  embeddingProvider: SubsystemStatus;
  embeddingModel: string | null;
  details: string[];
}

/**
 * Configuration snapshot for the status endpoint and CLI.
 *
 * Reports what is actually configured rather than what is intended. A missing
 * key degrades one subsystem; it never crashes the app, because the rest of
 * Blockwright works fine without generation.
 */
export function describeBrainConfiguration(): Omit<BrainStatus, "knowledgeDatabase" | "brain"> {
  const generation = getBrainGenerationConfig();
  const embedding = getEmbeddingConfig();
  const embeddingReady = isEmbeddingConfigured(embedding);
  const details: string[] = [];

  if (!generation.configured) {
    details.push("Set OPENROUTER_API_KEY in .env.local to enable generation.");
  } else if (!getBrainModelDefinition()) {
    details.push(
      `ROBLOX_BRAIN_MODEL is "${generation.model}", which is not in the model registry. ` +
        "Add it to src/lib/ai/registry.ts or set a registered slug.",
    );
  }

  if (!embeddingReady) {
    details.push(
      "No embedding key configured; vector search is unavailable and retrieval " +
        "degrades to lexical + exact-symbol matching.",
    );
  }

  return {
    generationProvider: generation.configured ? "ready" : "not-configured",
    generationProviderName: "OpenRouter",
    generationModel: generation.model,
    embeddingProvider: embeddingReady ? "ready" : "not-configured",
    embeddingModel: embeddingReady ? embedding.model : null,
    details,
  };
}

/**
 * Which model should answer this turn.
 *
 * Precedence is deliberate: an explicit per-request choice, then the project's
 * saved choice, then the Roblox Brain default. User choice must win — the model
 * selector is a real product feature, and quietly overriding it would bill
 * someone for a model they did not pick.
 *
 * Extracted from the route so the precedence itself is testable; inline, the
 * only way to catch a regression was to spend real provider credits and read
 * the model id back out of `ai_requests`, which is how the gap was found.
 */
export function resolveChatModelId(
  requestModelId: string | null | undefined,
  projectModelId: string | null | undefined,
): string {
  return requestModelId ?? projectModelId ?? getBrainGenerationConfig().registryId;
}
