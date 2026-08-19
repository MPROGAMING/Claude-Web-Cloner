import type { ProviderId } from "@/lib/env";
import { brandForSlug, type BrandId } from "@/lib/brand/providers";

/**
 * Model registry — the single source of truth the UI reads from.
 *
 * No component ever branches on provider. Adding a provider means adding rows
 * here plus a case in providers.ts, and nothing in components/ changes.
 *
 * Two kinds of entry live here:
 *
 *   - **Curated** models (below). Hand-verified, with a `lastVerified` date.
 *     Direct-provider models use the vendor SDK; OpenRouter ones route through
 *     OpenRouter with the exact slug from its catalog.
 *   - **Discovered** models, merged in at runtime by `openrouter-catalog.ts`.
 *     That is how the free tier stays current without a code change.
 *
 * `credits` are Blockwright credits per 1M tokens, defined as
 * `USD per 1M × 100`. They are product configuration, not a claim about the
 * provider's own pricing, and a provider-free model may still be priced above
 * zero here if the product decides to.
 */

export type ModelTier = "fast" | "balanced" | "powerful";

export type Capability =
  | "tools"
  | "reasoning"
  | "vision"
  | "long-context"
  | "structured-output";

export type Modality = "text" | "image" | "audio" | "video" | "file";

export type ModelStatus = "stable" | "preview" | "deprecated";

/**
 * Discovery labels. These are Blockwright product opinions — editable here
 * without touching a component — not benchmark claims.
 */
export type DiscoveryLabel =
  | "recommended-roblox"
  | "best-free"
  | "best-coding"
  | "best-reasoning"
  | "best-multimodal"
  | "fastest"
  | "longest-context";

export const DISCOVERY_LABEL: Record<DiscoveryLabel, string> = {
  "recommended-roblox": "Recommended for Roblox",
  "best-free": "Best free option",
  "best-coding": "Best for coding",
  "best-reasoning": "Best reasoning",
  "best-multimodal": "Best multimodal",
  fastest: "Fastest",
  "longest-context": "Longest context",
};

export interface ModelDefinition {
  /** Stable internal id: `${provider}:${providerModelId}` */
  id: string;
  /** Which adapter routes the request. */
  provider: ProviderId;
  /** Exact identifier handed to the provider SDK. For OpenRouter this is the
   *  catalog slug, e.g. `openai/gpt-5.6-luna`. */
  providerModelId: string;
  name: string;
  /** Organisation that actually made the model — drives branding. */
  brand: BrandId;
  /** One line describing fit. Never an invented benchmark result. */
  description: string;
  tier: ModelTier;
  capabilities: Capability[];
  inputModalities: Modality[];
  /** Blockwright credits per 1,000,000 tokens. */
  credits: { input: number; output: number };
  /** Provider-side list price per 1M tokens in USD, for transparency. */
  providerUsd?: { input: number; output: number };
  contextWindow: number;
  /** True when the *provider* charges nothing. Independent of `credits`. */
  free: boolean;
  status: ModelStatus;
  /** ISO date the entry was checked against the provider's live catalog. */
  lastVerified: string;
  labels?: DiscoveryLabel[];
  recommended?: boolean;
  enabled: boolean;
  /** Set on entries merged in from a live catalog rather than curated here. */
  discovered?: boolean;
}

const VERIFIED = "2026-08-18";

export const MODELS: ModelDefinition[] = [
  // ==========================================================================
  // Direct providers — unchanged routing, still first-class.
  // ==========================================================================
  {
    id: "anthropic:claude-sonnet-4-5",
    provider: "anthropic",
    providerModelId: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    brand: "anthropic",
    description: "Best all-round pick for building and editing Luau systems.",
    tier: "balanced",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image"],
    credits: { input: 300, output: 1500 },
    providerUsd: { input: 3, output: 15 },
    contextWindow: 200_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["recommended-roblox"],
    recommended: true,
    enabled: true,
  },
  {
    id: "anthropic:claude-opus-4-5",
    provider: "anthropic",
    providerModelId: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    brand: "anthropic",
    description: "Deepest reasoning for large refactors and tricky game logic.",
    tier: "powerful",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image"],
    credits: { input: 500, output: 2500 },
    providerUsd: { input: 5, output: 25 },
    contextWindow: 200_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["best-reasoning"],
    enabled: true,
  },
  {
    id: "anthropic:claude-haiku-4-5",
    provider: "anthropic",
    providerModelId: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    brand: "anthropic",
    description: "Quick edits, renames and small script tweaks.",
    tier: "fast",
    capabilities: ["tools", "vision", "structured-output"],
    inputModalities: ["text", "image"],
    credits: { input: 100, output: 500 },
    providerUsd: { input: 1, output: 5 },
    contextWindow: 200_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    enabled: true,
  },
  {
    id: "openai:gpt-5",
    provider: "openai",
    providerModelId: "gpt-5",
    name: "GPT-5",
    brand: "openai",
    description: "Strong structured planning across multi-file changes.",
    tier: "powerful",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image"],
    credits: { input: 250, output: 2000 },
    contextWindow: 400_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    enabled: true,
  },
  {
    id: "openai:gpt-5-mini",
    provider: "openai",
    providerModelId: "gpt-5-mini",
    name: "GPT-5 mini",
    brand: "openai",
    description: "Low-cost iteration when you already know the shape of the fix.",
    tier: "fast",
    capabilities: ["tools", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image"],
    credits: { input: 60, output: 450 },
    contextWindow: 400_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    enabled: true,
  },
  {
    id: "google:gemini-2.5-pro",
    provider: "google",
    providerModelId: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    brand: "google",
    description: "Very large context — good for auditing a whole project at once.",
    tier: "powerful",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image", "audio", "video"],
    credits: { input: 125, output: 1000 },
    contextWindow: 1_048_576,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    enabled: true,
  },
  {
    id: "google:gemini-2.5-flash",
    provider: "google",
    providerModelId: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    brand: "google",
    description: "Fast and cheap for chatty back-and-forth while prototyping.",
    tier: "fast",
    capabilities: ["tools", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image", "audio", "video"],
    credits: { input: 30, output: 250 },
    contextWindow: 1_048_576,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    enabled: true,
  },

  // ==========================================================================
  // OpenRouter — every slug, price, context and capability below was read from
  // https://openrouter.ai/api/v1/models on the date in `lastVerified`.
  // ==========================================================================
  {
    id: "openrouter:openai/gpt-5.6-luna",
    provider: "openrouter",
    providerModelId: "openai/gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    brand: "openai",
    description: "Fast reasoning with a very large window, at a low price point.",
    tier: "balanced",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image", "file"],
    credits: { input: 20, output: 120 },
    providerUsd: { input: 0.2, output: 1.2 },
    contextWindow: 1_050_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["best-coding"],
    enabled: true,
  },
  {
    id: "openrouter:google/gemini-3.7-flash",
    provider: "openrouter",
    providerModelId: "google/gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    brand: "google",
    description: "Handles text, images, audio and video in one conversation.",
    tier: "balanced",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image", "audio", "video", "file"],
    credits: { input: 38, output: 188 },
    providerUsd: { input: 0.375, output: 1.875 },
    contextWindow: 1_048_576,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["best-multimodal"],
    enabled: true,
  },
  {
    id: "openrouter:tencent/hy3",
    provider: "openrouter",
    providerModelId: "tencent/hy3",
    name: "Hy3",
    brand: "tencent",
    description: "Cheapest capable tool-caller here — good for long build sessions.",
    tier: "fast",
    capabilities: ["tools", "reasoning", "long-context", "structured-output"],
    inputModalities: ["text"],
    credits: { input: 13, output: 53 },
    providerUsd: { input: 0.132, output: 0.528 },
    contextWindow: 262_144,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["fastest"],
    enabled: true,
  },
  {
    id: "openrouter:moonshotai/kimi-k3",
    provider: "openrouter",
    providerModelId: "moonshotai/kimi-k3",
    name: "Kimi K3",
    brand: "moonshot",
    description: "Premium agentic model with a million-token window and video input.",
    tier: "powerful",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image", "video"],
    credits: { input: 300, output: 1500 },
    providerUsd: { input: 3, output: 15 },
    contextWindow: 1_048_576,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["longest-context"],
    enabled: true,
  },
  {
    id: "openrouter:z-ai/glm-5.2",
    provider: "openrouter",
    providerModelId: "z-ai/glm-5.2",
    name: "GLM 5.2",
    brand: "zai",
    description: "Strong code generation with a million-token window, priced low.",
    tier: "balanced",
    capabilities: ["tools", "reasoning", "long-context", "structured-output"],
    inputModalities: ["text"],
    credits: { input: 49, output: 154 },
    providerUsd: { input: 0.49, output: 1.54 },
    contextWindow: 1_048_576,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    enabled: true,
  },
  {
    id: "openrouter:openai/gpt-5.6-sol",
    provider: "openrouter",
    providerModelId: "openai/gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    brand: "openai",
    description: "Roblox Brain default — strong agentic tool use over a million-token window.",
    tier: "powerful",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image", "file"],
    credits: { input: 250, output: 1500 },
    providerUsd: { input: 2.5, output: 15 },
    contextWindow: 1_050_000,
    free: false,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["recommended-roblox"],
    enabled: true,
  },
  {
    id: "openrouter:openrouter/free",
    provider: "openrouter",
    providerModelId: "openrouter/free",
    name: "Free Models Router",
    brand: "openrouter",
    description: "Routes to whichever free model is currently available and capable.",
    tier: "balanced",
    capabilities: ["tools", "reasoning", "vision", "long-context", "structured-output"],
    inputModalities: ["text", "image"],
    credits: { input: 0, output: 0 },
    providerUsd: { input: 0, output: 0 },
    contextWindow: 200_000,
    free: true,
    status: "stable",
    lastVerified: VERIFIED,
    labels: ["best-free"],
    enabled: true,
  },
];

/**
 * The model a project gets when nobody has chosen one.
 *
 * This was `anthropic:claude-sonnet-4-5`, a direct-provider model needing a key
 * this deployment does not have — so every new project was created pointing at
 * a model it could not run, and /settings displayed that as the account
 * default. The runtime survived it by falling back, but the stored value and
 * the displayed one were both wrong, and it contradicted the product's own
 * positioning: the Roblox-tuned model is the point.
 *
 * Must stay equal to `openrouter:` + DEFAULT_BRAIN_MODEL from
 * `lib/knowledge/generation-config`. It cannot import it — that module imports
 * this one — so `tests/credits.test.ts` pins the two together instead.
 */
export const DEFAULT_MODEL_ID = "openrouter:openai/gpt-5.6-sol";

export function getModel(id: string, catalog: ModelDefinition[] = MODELS) {
  return catalog.find((m) => m.id === id && m.enabled);
}

export function getModelOrDefault(
  id: string | null | undefined,
  catalog: ModelDefinition[] = MODELS,
): ModelDefinition {
  return (
    getModel(id ?? "", catalog) ??
    getModel(DEFAULT_MODEL_ID, catalog) ??
    catalog[0] ??
    MODELS[0]
  );
}

/** Build the internal id for an OpenRouter slug. */
export function openRouterId(slug: string): string {
  return `openrouter:${slug}`;
}

export { brandForSlug };

export const TIER_LABEL: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  powerful: "Powerful",
};

export const TIER_ORDER: ModelTier[] = ["powerful", "balanced", "fast"];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  tools: "Tools",
  reasoning: "Reasoning",
  vision: "Vision",
  "long-context": "Long context",
  "structured-output": "Structured",
};

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
};

/**
 * Sections shown in the selector, in order. A model may appear in more than
 * one; `Recommended` and `Free` are the two that always render first.
 */
export type SectionId =
  | "recommended"
  | "free"
  | "fast"
  | "coding"
  | "reasoning"
  | "multimodal"
  | "premium";

export const SECTIONS: {
  id: SectionId;
  title: string;
  blurb?: string;
  match: (model: ModelDefinition) => boolean;
}[] = [
  {
    id: "recommended",
    title: "Recommended",
    blurb: "Picked for building Roblox systems.",
    match: (m) => Boolean(m.recommended || m.labels?.length),
  },
  {
    id: "free",
    title: "Free models",
    blurb:
      "No model cost through OpenRouter. Availability and rate limits are set by the provider and can change.",
    match: (m) => m.free,
  },
  {
    id: "fast",
    title: "Fast",
    blurb: "Lower latency and lower cost for quick iteration.",
    match: (m) => m.tier === "fast" && !m.free,
  },
  {
    id: "coding",
    title: "Coding",
    blurb: "Reliable multi-file code generation.",
    match: (m) =>
      !m.free && m.capabilities.includes("tools") && m.capabilities.includes("long-context"),
  },
  {
    id: "reasoning",
    title: "Reasoning",
    blurb: "Thinks through harder gameplay logic.",
    match: (m) => !m.free && m.capabilities.includes("reasoning"),
  },
  {
    id: "multimodal",
    title: "Multimodal",
    blurb: "Accepts images alongside your prompt.",
    match: (m) => !m.free && m.inputModalities.length > 1,
  },
  {
    id: "premium",
    title: "Premium",
    blurb: "Highest capability, highest cost.",
    match: (m) => m.tier === "powerful" && !m.free,
  },
];

/** A model as exposed to the client, with availability resolved server-side. */
export interface ClientModel extends ModelDefinition {
  available: boolean;
  /** Why it is unavailable, when it is. */
  unavailableReason?: string;
}
