import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { publicEnv, serverEnv, type ProviderId } from "@/lib/env";
import {
  getModel,
  MODELS,
  type ClientModel,
  type ModelDefinition,
} from "@/lib/ai/registry";
import { getEffectiveModels } from "@/lib/ai/openrouter-catalog";
import { AppError } from "@/lib/errors";

/**
 * Provider adapter layer.
 *
 * Everything above this file speaks in terms of a registry `ModelDefinition`.
 * This is the only module that knows a provider SDK exists, which is what makes
 * "add a provider" a two-file change.
 */

const clients = new Map<ProviderId, ReturnType<typeof createAnthropic>>();

function providerFactory(provider: ProviderId) {
  switch (provider) {
    case "anthropic": {
      const apiKey = serverEnv.anthropicApiKey;
      if (!apiKey) return null;
      return createAnthropic({ apiKey });
    }
    case "openai": {
      const apiKey = serverEnv.openaiApiKey;
      if (!apiKey) return null;
      return createOpenAI({ apiKey });
    }
    case "google": {
      const apiKey = serverEnv.googleApiKey;
      if (!apiKey) return null;
      return createGoogleGenerativeAI({ apiKey });
    }
    case "openrouter": {
      const apiKey = serverEnv.openrouterApiKey;
      if (!apiKey) return null;
      // OpenRouter asks integrators to identify themselves; these headers are
      // what put the app in their attribution listings.
      return createOpenRouter({
        apiKey,
        headers: {
          "HTTP-Referer": publicEnv.siteUrl,
          "X-Title": "Blockwright",
        },
      });
    }
  }
}

/** True when this deployment holds credentials for the provider. */
export function isProviderAvailable(provider: ProviderId): boolean {
  switch (provider) {
    case "anthropic":
      return Boolean(serverEnv.anthropicApiKey);
    case "openai":
      return Boolean(serverEnv.openaiApiKey);
    case "google":
      return Boolean(serverEnv.googleApiKey);
    case "openrouter":
      return Boolean(serverEnv.openrouterApiKey);
  }
}

/**
 * Resolve a registry id to a live `LanguageModel`.
 * Throws an AppError (never a raw provider error) so routes can map it to a
 * user-facing message.
 */
export function resolveLanguageModel(
  modelId: string,
  catalog: ModelDefinition[] = MODELS,
): {
  model: LanguageModel;
  definition: ModelDefinition;
} {
  const definition = getModel(modelId, catalog);
  if (!definition) {
    // Deliberately no silent substitution: billing a user for a model they did
    // not choose is worse than a clear failure.
    throw new AppError(
      "invalid_model",
      `Model "${modelId}" is not available on this deployment.`,
      400,
    );
  }

  if (!isProviderAvailable(definition.provider)) {
    throw new AppError(
      "provider_unconfigured",
      `${definition.name} is unavailable — this deployment has no ${definition.provider} API key configured.`,
      503,
    );
  }

  let client = clients.get(definition.provider);
  if (!client) {
    const created = providerFactory(definition.provider);
    if (!created) {
      throw new AppError(
        "provider_unconfigured",
        `${definition.name} is unavailable right now.`,
        503,
      );
    }
    client = created as ReturnType<typeof createAnthropic>;
    clients.set(definition.provider, client);
  }

  return { model: client(definition.providerModelId), definition };
}

const PROVIDER_KEY_NAME: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

function toClientModel(model: ModelDefinition): ClientModel {
  const available = isProviderAvailable(model.provider);
  return {
    ...model,
    available,
    unavailableReason: available
      ? undefined
      : `Needs ${PROVIDER_KEY_NAME[model.provider]} on the server.`,
  };
}

/**
 * Registry projected for the client, availability resolved server-side.
 * Includes live OpenRouter discoveries, so the free tier reflects what is
 * actually free right now rather than what was true when this shipped.
 */
export async function listClientModels(): Promise<{
  models: ClientModel[];
  catalogFetchedAt: string;
  catalogSource: "live" | "stale" | "unavailable";
}> {
  const { models, snapshot } = await getEffectiveModels();
  return {
    models: models.filter((m) => m.enabled).map(toClientModel),
    catalogFetchedAt: snapshot.fetchedAt,
    catalogSource: snapshot.source,
  };
}

/** Synchronous curated-only projection, for paths that must not await. */
export function listCuratedClientModels(): ClientModel[] {
  return MODELS.filter((m) => m.enabled).map(toClientModel);
}

/**
 * Pick a model the user can actually run: their choice if its provider is
 * configured, then the caller's stated fallback, then any available model.
 *
 * `fallbackId` exists because a stored choice can be unrunnable — a project row
 * carries a NOT NULL default, so "the user never chose" is indistinguishable
 * from "the user chose this" at this layer. Without it the last resort is
 * whichever model happens to be flagged recommended, which is how a deployment
 * configured only for the Roblox Brain still generated on an unrelated model.
 * It is passed in rather than imported to keep this module free of any
 * dependency on the knowledge layer.
 */
export function pickUsableModel(
  preferredId: string | null | undefined,
  catalog: ModelDefinition[] = MODELS,
  fallbackId?: string | null,
): ModelDefinition | null {
  const preferred = getModel(preferredId ?? "", catalog);
  if (preferred && isProviderAvailable(preferred.provider)) return preferred;

  const fallback = getModel(fallbackId ?? "", catalog);
  if (fallback?.enabled && isProviderAvailable(fallback.provider)) return fallback;

  return (
    catalog.find((m) => m.enabled && m.recommended && isProviderAvailable(m.provider)) ??
    catalog.find((m) => m.enabled && isProviderAvailable(m.provider)) ??
    null
  );
}
