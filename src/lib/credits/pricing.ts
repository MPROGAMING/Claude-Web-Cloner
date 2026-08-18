import type { ModelDefinition } from "@/lib/ai/registry";

/**
 * Credit arithmetic. Pure functions, no I/O — unit tested in tests/credits.test.ts.
 *
 * A credit is an internal unit. Registry entries express cost per 1M tokens, so
 * a request's cost is a straight linear combination, rounded up so that a
 * non-zero request never costs zero.
 */

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  /** Cached input is billed at the input rate here; providers discount it,
   *  which shows up as headroom rather than as a user-facing discount. */
  cachedInputTokens?: number;
  reasoningTokens?: number;
}

const PER_MILLION = 1_000_000;

export function calculateCredits(model: ModelDefinition, usage: TokenUsage): number {
  const input = Math.max(0, usage.inputTokens || 0);
  // Reasoning tokens are billed as output by every provider we support.
  const output = Math.max(0, usage.outputTokens || 0);

  const raw =
    (input * model.credits.input) / PER_MILLION +
    (output * model.credits.output) / PER_MILLION;

  if (raw <= 0) return 0;
  return Math.max(1, Math.ceil(raw));
}

/**
 * Pre-flight estimate used to (a) block a request that clearly cannot be paid
 * for and (b) show a cost hint in the composer. Assumes a modest completion.
 */
export function estimateCredits(
  model: ModelDefinition,
  promptChars: number,
  contextTokens = 0,
): number {
  const promptTokens = Math.ceil(promptChars / 4) + contextTokens;
  const assumedOutputTokens = 900;
  return calculateCredits(model, {
    inputTokens: promptTokens,
    outputTokens: assumedOutputTokens,
  });
}

/**
 * The smallest balance we will start a generation with. Prevents a user with
 * 1 credit kicking off a large request that would end up negative.
 */
export const MINIMUM_BALANCE_TO_START = 25;

export function formatCredits(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString("en-US");
}

/** Credit packs. Configuration only — no charge is taken until Stripe is wired. */
export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
  blurb: string;
  highlight?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 25_000,
    priceUsd: 10,
    blurb: "Enough to build and iterate on a first mechanic.",
  },
  {
    id: "builder",
    name: "Builder",
    credits: 120_000,
    priceUsd: 40,
    blurb: "For a full game loop across several sessions.",
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    credits: 400_000,
    priceUsd: 120,
    blurb: "Team-scale usage with room for big refactors.",
  },
];
