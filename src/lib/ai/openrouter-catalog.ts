import "server-only";

import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { brandForSlug } from "@/lib/brand/providers";
import {
  MODELS,
  openRouterId,
  type Capability,
  type ModelDefinition,
  type Modality,
  type ModelStatus,
} from "@/lib/ai/registry";

/**
 * Live OpenRouter catalog.
 *
 * The free tier is genuinely dynamic — models appear, become paid, and get
 * retired — so hardcoding a free list guarantees it goes stale and starts
 * lying to users. Instead we fetch the catalog, derive free status from the
 * pricing field, and merge the result into the registry.
 *
 * Failure behaviour matters as much as success here:
 *   - a fetch failure serves the last known good snapshot rather than emptying
 *     the selector
 *   - a stale snapshot is served immediately while a refresh runs in the
 *     background (stale-while-revalidate)
 *   - if nothing has ever succeeded, the curated entries in registry.ts still
 *     work, so the product degrades to "fewer models", never to "no models"
 */

const CATALOG_URL = "https://openrouter.ai/api/v1/models";

/** How long a snapshot is considered fresh. */
const TTL_MS = Number(process.env.OPENROUTER_CATALOG_TTL_MS ?? 30 * 60 * 1000);
/** Beyond this, a stale snapshot is no longer served without a refresh. */
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface RawModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  created?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  supported_parameters?: string[];
  expiration_date?: string | null;
}

export interface CatalogSnapshot {
  models: ModelDefinition[];
  fetchedAt: string;
  /** Slugs that are currently free, for change detection. */
  freeSlugs: string[];
  source: "live" | "stale" | "unavailable";
}

interface CacheEntry {
  snapshot: CatalogSnapshot;
  fetchedAtMs: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<CatalogSnapshot> | null = null;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function usdPerMillion(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed * 1_000_000 : 0;
}

/** Free means the provider charges nothing for both directions. */
function isFree(raw: RawModel): boolean {
  return usdPerMillion(raw.pricing?.prompt) === 0 && usdPerMillion(raw.pricing?.completion) === 0;
}

const MODALITY_ALLOW: Modality[] = ["text", "image", "audio", "video", "file"];

function modalities(raw: RawModel): Modality[] {
  const found = (raw.architecture?.input_modalities ?? ["text"]).filter(
    (m): m is Modality => (MODALITY_ALLOW as string[]).includes(m),
  );
  return found.length ? found : ["text"];
}

function capabilities(raw: RawModel): Capability[] {
  const params = raw.supported_parameters ?? [];
  const list: Capability[] = [];
  if (params.includes("tools")) list.push("tools");
  if (params.includes("reasoning") || params.includes("include_reasoning")) {
    list.push("reasoning");
  }
  if (modalities(raw).includes("image")) list.push("vision");
  if ((raw.context_length ?? 0) >= 200_000) list.push("long-context");
  if (params.includes("structured_outputs") || params.includes("response_format")) {
    list.push("structured-output");
  }
  return list;
}

function tierFor(raw: RawModel): ModelDefinition["tier"] {
  const out = usdPerMillion(raw.pricing?.completion);
  if (out === 0) return "balanced";
  if (out >= 8) return "powerful";
  if (out <= 1) return "fast";
  return "balanced";
}

function statusFor(raw: RawModel): ModelStatus {
  if (raw.expiration_date) return "deprecated";
  if (/preview|beta/i.test(raw.id) || /preview|beta/i.test(raw.name)) return "preview";
  return "stable";
}

/** Provider USD per 1M → Blockwright credits per 1M. */
export function creditsFromUsd(usdPerM: number): number {
  return Math.max(0, Math.round(usdPerM * 100));
}

function firstSentence(text: string | undefined, fallback: string): string {
  if (!text) return fallback;
  const cleaned = text.replace(/\s+/g, " ").replace(/\[(.+?)\]\(.+?\)/g, "$1").trim();
  const sentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  return sentence.length > 130 ? `${sentence.slice(0, 127)}…` : sentence;
}

/**
 * Turn a catalog name into a clean label.
 *
 * Drops the vendor prefix ("OpenAI: GPT-5.6 Luna" → "GPT-5.6 Luna") because the
 * row already shows the brand, and drops a trailing "(free)" because the row
 * already carries a FREE badge — repeating it just makes the name harder to
 * scan.
 */
function displayName(raw: RawModel): string {
  const name = raw.name ?? raw.id;
  const colon = name.indexOf(": ");
  return (colon > -1 ? name.slice(colon + 2) : name)
    .replace(/\s*\(free\)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function normalise(raw: RawModel, fetchedAt: string): ModelDefinition {
  const free = isFree(raw);
  const inputUsd = usdPerMillion(raw.pricing?.prompt);
  const outputUsd = usdPerMillion(raw.pricing?.completion);

  return {
    id: openRouterId(raw.id),
    provider: "openrouter",
    providerModelId: raw.id,
    name: displayName(raw),
    brand: brandForSlug(raw.id),
    description: firstSentence(raw.description, "Available through OpenRouter."),
    tier: tierFor(raw),
    capabilities: capabilities(raw),
    inputModalities: modalities(raw),
    // Free-at-provider models are offered at zero Blockwright credits. This is
    // a product decision and is overridden by the curated entry when one exists.
    credits: free
      ? { input: 0, output: 0 }
      : { input: creditsFromUsd(inputUsd), output: creditsFromUsd(outputUsd) },
    providerUsd: { input: inputUsd, output: outputUsd },
    contextWindow: raw.context_length ?? 128_000,
    free,
    status: statusFor(raw),
    lastVerified: fetchedAt.slice(0, 10),
    enabled: true,
    discovered: true,
  };
}

/**
 * Which discovered models are worth surfacing. The agent needs tool calling and
 * text output, so a free image or audio model would only ever fail mid-build.
 */
function isUsableForAgent(raw: RawModel): boolean {
  const outputs = raw.architecture?.output_modalities ?? ["text"];
  if (!outputs.includes("text")) return false;
  if (!(raw.supported_parameters ?? []).includes("tools")) return false;
  if (raw.expiration_date) return false;
  // `:batch` variants are asynchronous and cannot stream.
  if (raw.id.endsWith(":batch")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchCatalog(): Promise<CatalogSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    // The catalog is public; the key is sent when present so the response
    // reflects any account-specific availability.
    if (serverEnv.openrouterApiKey) {
      headers.Authorization = `Bearer ${serverEnv.openrouterApiKey}`;
    }

    const response = await fetch(CATALOG_URL, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`catalog HTTP ${response.status}`);

    const body = (await response.json()) as { data?: RawModel[] };
    const raw = body.data ?? [];
    const fetchedAt = new Date().toISOString();

    const usable = raw.filter(isUsableForAgent);
    const models = usable.map((entry) => normalise(entry, fetchedAt));
    const freeSlugs = usable.filter(isFree).map((entry) => entry.id);

    logger.info("openrouter.catalog.fetched", {
      total: raw.length,
      usable: usable.length,
      free: freeSlugs.length,
    });

    return { models, fetchedAt, freeSlugs, source: "live" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Current catalog snapshot. Never throws — a failure degrades to the last good
 * snapshot, or to an empty discovered set on top of the curated registry.
 */
export async function getCatalog(): Promise<CatalogSnapshot> {
  const now = Date.now();

  if (cache && now - cache.fetchedAtMs < TTL_MS) {
    return cache.snapshot;
  }

  // Stale-while-revalidate: hand back what we have, refresh behind it.
  if (cache && now - cache.fetchedAtMs < MAX_STALE_MS) {
    if (!inFlight) {
      inFlight = fetchCatalog()
        .then((snapshot) => {
          cache = { snapshot, fetchedAtMs: Date.now() };
          return snapshot;
        })
        .catch((error) => {
          logger.warn("openrouter.catalog.refresh_failed", { error: String(error) });
          return cache!.snapshot;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return { ...cache.snapshot, source: "stale" };
  }

  if (inFlight) return inFlight;

  inFlight = fetchCatalog()
    .then((snapshot) => {
      cache = { snapshot, fetchedAtMs: Date.now() };
      return snapshot;
    })
    .catch((error) => {
      logger.warn("openrouter.catalog.unavailable", { error: String(error) });
      if (cache) return { ...cache.snapshot, source: "stale" as const };
      return {
        models: [],
        fetchedAt: new Date().toISOString(),
        freeSlugs: [],
        source: "unavailable" as const,
      };
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Curated entries win over discovered ones with the same id, so hand-written
 * descriptions, credit prices and discovery labels are never clobbered by a
 * refresh — but free status and pricing are refreshed from the live data,
 * which is what stops a model that went paid from still showing FREE.
 */
export function mergeCatalog(
  curated: ModelDefinition[],
  discovered: ModelDefinition[],
): ModelDefinition[] {
  const byId = new Map<string, ModelDefinition>();

  for (const model of discovered) byId.set(model.id, model);

  for (const model of curated) {
    const live = byId.get(model.id);
    byId.set(
      model.id,
      live
        ? {
            ...model,
            // Refresh the facts that can change under us.
            free: live.free,
            providerUsd: live.providerUsd,
            contextWindow: live.contextWindow,
            status: live.status,
            lastVerified: live.lastVerified,
            // A curated model that became free should cost nothing here too,
            // unless the curated entry already priced it at zero.
            credits: live.free ? { input: 0, output: 0 } : model.credits,
          }
        : model,
    );
  }

  return [...byId.values()];
}

/**
 * The full effective catalog: curated registry plus live discoveries.
 * Discovered non-free models are excluded — 400 paid models would drown the
 * selector, and the curated list is the product's opinion. Free ones are the
 * point of the dynamic layer, so they all come through.
 */
export async function getEffectiveModels(): Promise<{
  models: ModelDefinition[];
  snapshot: CatalogSnapshot;
}> {
  const snapshot = await getCatalog();
  const discoveredFree = snapshot.models.filter((model) => model.free);
  return { models: mergeCatalog(MODELS, discoveredFree), snapshot };
}

/** Test seam — never called from application code. */
export function __resetCatalogCache() {
  cache = null;
  inFlight = null;
}
