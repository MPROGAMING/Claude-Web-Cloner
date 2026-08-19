import { describe, expect, it, vi } from "vitest";

// generation-config is server-only; the constant under test is a plain string.
vi.mock("server-only", () => ({}));

import {
  CREDIT_PACKS,
  MINIMUM_BALANCE_TO_START,
  calculateCredits,
  estimateCredits,
  formatCredits,
} from "@/lib/credits/pricing";
import { MODELS, getModel, getModelOrDefault, DEFAULT_MODEL_ID } from "@/lib/ai/registry";
import { DEFAULT_BRAIN_MODEL } from "@/lib/knowledge/generation-config";

const sonnet = getModel("anthropic:claude-sonnet-4-5")!;
const flash = getModel("google:gemini-2.5-flash")!;

describe("calculateCredits", () => {
  it("bills input and output at their separate rates", () => {
    // 1M in at 300, 1M out at 1500
    expect(calculateCredits(sonnet, { inputTokens: 1_000_000, outputTokens: 0 })).toBe(300);
    expect(calculateCredits(sonnet, { inputTokens: 0, outputTokens: 1_000_000 })).toBe(1500);
    expect(calculateCredits(sonnet, { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(1800);
  });

  it("never charges zero for a request that used tokens", () => {
    // 10 tokens on the cheapest model rounds to well under one credit.
    const cost = calculateCredits(flash, { inputTokens: 10, outputTokens: 1 });
    expect(cost).toBe(1);
  });

  it("charges nothing when no tokens were used", () => {
    expect(calculateCredits(sonnet, { inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("rounds up rather than down, so usage is never under-billed", () => {
    // 1000 in + 1000 out on sonnet = 0.3 + 1.5 = 1.8 credits
    expect(calculateCredits(sonnet, { inputTokens: 1000, outputTokens: 1000 })).toBe(2);
  });

  it("ignores negative token counts from a malformed provider response", () => {
    expect(calculateCredits(sonnet, { inputTokens: -500, outputTokens: 1_000_000 })).toBe(1500);
  });

  it("costs more on a more expensive model for identical usage", () => {
    const opus = getModel("anthropic:claude-opus-4-5")!;
    const usage = { inputTokens: 50_000, outputTokens: 20_000 };
    expect(calculateCredits(opus, usage)).toBeGreaterThan(calculateCredits(sonnet, usage));
    expect(calculateCredits(sonnet, usage)).toBeGreaterThan(calculateCredits(flash, usage));
  });
});

describe("estimateCredits", () => {
  it("scales with prompt length", () => {
    const short = estimateCredits(sonnet, 100, 0);
    const long = estimateCredits(sonnet, 40_000, 0);
    expect(long).toBeGreaterThan(short);
  });

  it("includes the context allowance", () => {
    expect(estimateCredits(sonnet, 100, 100_000)).toBeGreaterThan(
      estimateCredits(sonnet, 100, 0),
    );
  });

  it("is always at least one credit", () => {
    expect(estimateCredits(flash, 1, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe("formatCredits", () => {
  it.each([
    [0, "0"],
    [999, "999"],
    [1500, "1.5k"],
    [12_000, "12k"],
    [2_400_000, "2.4M"],
  ])("formats %i as %s", (input, expected) => {
    expect(formatCredits(input)).toBe(expected);
  });

  it("survives a non-finite value rather than rendering NaN", () => {
    expect(formatCredits(Number.NaN)).toBe("0");
    expect(formatCredits(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("model registry", () => {
  it("has unique ids", () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("namespaces every id with its provider", () => {
    for (const model of MODELS) {
      expect(model.id).toBe(`${model.provider}:${model.providerModelId}`);
    }
  });

  it("prices output at or above input for every model", () => {
    for (const model of MODELS) {
      expect(model.credits.output).toBeGreaterThanOrEqual(model.credits.input);
    }
  });

  it("charges a positive rate for every paid model", () => {
    for (const model of MODELS.filter((m) => !m.free)) {
      expect(model.credits.input, `${model.id} has no input rate`).toBeGreaterThan(0);
      expect(model.credits.output, `${model.id} has no output rate`).toBeGreaterThan(0);
    }
  });

  it("charges nothing for provider-free models", () => {
    // Product decision, encoded here so a future edit is deliberate: a model
    // that costs us nothing costs the user nothing.
    for (const model of MODELS.filter((m) => m.free)) {
      expect(model.credits).toEqual({ input: 0, output: 0 });
    }
  });

  it("exposes exactly one recommended default that resolves", () => {
    const recommended = MODELS.filter((m) => m.enabled && m.recommended);
    expect(recommended).toHaveLength(1);
    expect(getModel(DEFAULT_MODEL_ID)).toBeDefined();
  });

  it("falls back to the default for unknown or disabled ids", () => {
    expect(getModel("nope:not-a-model")).toBeUndefined();
    expect(getModelOrDefault("nope:not-a-model").id).toBe(DEFAULT_MODEL_ID);
    expect(getModelOrDefault(null).id).toBe(DEFAULT_MODEL_ID);
  });

  it("covers every supported provider", () => {
    const providers = new Set(MODELS.filter((m) => m.enabled).map((m) => m.provider));
    expect(providers).toEqual(new Set(["anthropic", "openai", "google", "openrouter"]));
  });

  it("keeps the direct-provider adapters populated", () => {
    // OpenRouter is additive. Losing direct routing would be a regression, not
    // a simplification, so each direct provider must still have models.
    for (const provider of ["anthropic", "openai", "google"] as const) {
      expect(
        MODELS.filter((m) => m.enabled && m.provider === provider).length,
        `${provider} has no models`,
      ).toBeGreaterThan(0);
    }
  });

  it("gives every model a verification date and a brand", () => {
    for (const model of MODELS) {
      expect(model.lastVerified, `${model.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(model.brand, `${model.id}`).toBeTruthy();
    }
  });

  it("uses the exact OpenRouter slug as the provider model id", () => {
    // A typo here is a runtime 404 that only shows up mid-generation.
    for (const model of MODELS.filter((m) => m.provider === "openrouter")) {
      expect(model.id).toBe(`openrouter:${model.providerModelId}`);
      expect(model.providerModelId).toMatch(/^[a-z0-9~.-]+\/[a-z0-9._-]+$/i);
    }
  });
});

describe("credit packs", () => {
  it("gets cheaper per credit as the pack grows", () => {
    const rates = CREDIT_PACKS.map((pack) => pack.priceUsd / pack.credits);
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
    }
  });

  it("keeps the start threshold small enough to be reachable", () => {
    expect(MINIMUM_BALANCE_TO_START).toBeGreaterThan(0);
    expect(MINIMUM_BALANCE_TO_START).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
describe("the default model is one this deployment can actually run", () => {
  /**
   * DEFAULT_MODEL_ID used to be `anthropic:claude-sonnet-4-5` — a direct
   * provider needing a key that is not configured. Every new project was
   * created pointing at a model it could not run, and /settings displayed it
   * as the account default. The runtime papered over it by falling back, so
   * nothing failed loudly; it was visible only in the UI, saying the wrong
   * thing.
   *
   * registry.ts cannot import generation-config (that module imports this one),
   * so the two constants are pinned here instead of by the type system.
   */
  it("matches the configured Roblox Brain model", () => {
    expect(DEFAULT_MODEL_ID).toBe(`openrouter:${DEFAULT_BRAIN_MODEL}`);
  });

  it("routes through OpenRouter, which is the only provider wired for generation", () => {
    expect(getModel(DEFAULT_MODEL_ID)?.provider).toBe("openrouter");
  });

  it("is enabled and carries the Roblox recommendation", () => {
    const model = getModel(DEFAULT_MODEL_ID);
    expect(model?.enabled).toBe(true);
    expect(model?.labels).toContain("recommended-roblox");
  });
});
