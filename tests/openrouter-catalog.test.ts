import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { normalise, mergeCatalog, creditsFromUsd } = await import("@/lib/ai/openrouter-catalog");
const { MODELS } = await import("@/lib/ai/registry");

/**
 * The free tier is dynamic, so the normalisation layer is what stands between a
 * changing upstream catalog and the UI making a false claim. These cases are
 * the ones that would produce a wrong FREE badge or a broken model entry.
 */

const raw = (over: Record<string, unknown> = {}) => ({
  id: "acme/model-1",
  name: "Acme: Model One",
  description: "A capable model. Second sentence that should be dropped.",
  context_length: 262_144,
  pricing: { prompt: "0.000001", completion: "0.000004" },
  architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
  supported_parameters: ["tools", "reasoning", "structured_outputs"],
  ...over,
});

const FETCHED = "2026-08-18T12:00:00.000Z";

describe("normalise", () => {
  it("derives free status from pricing, not from the name", () => {
    const paid = normalise(raw(), FETCHED);
    expect(paid.free).toBe(false);

    // A ":free" suffix must not be trusted on its own.
    const lying = normalise(raw({ id: "acme/model-1:free" }), FETCHED);
    expect(lying.free).toBe(false);

    const actuallyFree = normalise(
      raw({ pricing: { prompt: "0", completion: "0" } }),
      FETCHED,
    );
    expect(actuallyFree.free).toBe(true);
  });

  it("converts provider USD per million into Blockwright credits", () => {
    const model = normalise(raw(), FETCHED);
    // $1/M in, $4/M out
    expect(model.providerUsd).toEqual({ input: 1, output: 4 });
    expect(model.credits).toEqual({ input: 100, output: 400 });
  });

  it("prices provider-free models at zero credits", () => {
    const model = normalise(raw({ pricing: { prompt: "0", completion: "0" } }), FETCHED);
    expect(model.credits).toEqual({ input: 0, output: 0 });
  });

  it("maps capabilities from supported parameters and modalities", () => {
    const model = normalise(raw(), FETCHED);
    expect(model.capabilities).toContain("tools");
    expect(model.capabilities).toContain("reasoning");
    expect(model.capabilities).toContain("vision");
    expect(model.capabilities).toContain("long-context");
    expect(model.capabilities).toContain("structured-output");
  });

  it("does not claim vision for a text-only model", () => {
    const model = normalise(
      raw({ architecture: { input_modalities: ["text"], output_modalities: ["text"] } }),
      FETCHED,
    );
    expect(model.capabilities).not.toContain("vision");
    expect(model.inputModalities).toEqual(["text"]);
  });

  it("does not claim tools when the provider does not list them", () => {
    const model = normalise(raw({ supported_parameters: [] }), FETCHED);
    expect(model.capabilities).not.toContain("tools");
  });

  it("marks an expiring model deprecated", () => {
    const model = normalise(raw({ expiration_date: "2026-12-01" }), FETCHED);
    expect(model.status).toBe("deprecated");
  });

  it("marks a preview model as preview", () => {
    expect(normalise(raw({ id: "acme/model-preview" }), FETCHED).status).toBe("preview");
  });

  it("strips the vendor prefix from the display name", () => {
    expect(normalise(raw(), FETCHED).name).toBe("Model One");
  });

  it("drops a redundant (free) suffix — the badge already says it", () => {
    expect(normalise(raw({ name: "NVIDIA: Nemotron 3 Ultra (free)" }), FETCHED).name).toBe(
      "Nemotron 3 Ultra",
    );
  });

  it("collapses the double spaces some catalog names carry", () => {
    expect(normalise(raw({ name: "Google: Gemma 4 26B A4B  (free)" }), FETCHED).name).toBe(
      "Gemma 4 26B A4B",
    );
  });

  it("keeps descriptions to one sentence", () => {
    expect(normalise(raw(), FETCHED).description).toBe("A capable model.");
  });

  it("resolves the brand from the slug namespace", () => {
    expect(normalise(raw({ id: "openai/x" }), FETCHED).brand).toBe("openai");
    expect(normalise(raw({ id: "z-ai/x" }), FETCHED).brand).toBe("zai");
    expect(normalise(raw({ id: "moonshotai/x" }), FETCHED).brand).toBe("moonshot");
    expect(normalise(raw({ id: "nobody/x" }), FETCHED).brand).toBe("generic");
  });

  it("namespaces the internal id under the openrouter provider", () => {
    const model = normalise(raw(), FETCHED);
    expect(model.id).toBe("openrouter:acme/model-1");
    expect(model.provider).toBe("openrouter");
    expect(model.providerModelId).toBe("acme/model-1");
  });
});

describe("creditsFromUsd", () => {
  it.each([
    [0, 0],
    [0.132, 13],
    [1.2, 120],
    [15, 1500],
  ])("$%s/M becomes %i credits", (usd, credits) => {
    expect(creditsFromUsd(usd)).toBe(credits);
  });
});

describe("mergeCatalog", () => {
  const curated = MODELS.find((m) => m.id === "openrouter:z-ai/glm-5.2")!;

  it("keeps the curated description and labels", () => {
    const live = normalise(
      raw({ id: "z-ai/glm-5.2", description: "Upstream blurb.", name: "Z.ai: GLM 5.2" }),
      FETCHED,
    );
    const merged = mergeCatalog([curated], [live]).find((m) => m.id === curated.id)!;

    expect(merged.description).toBe(curated.description);
    expect(merged.name).toBe(curated.name);
  });

  it("refreshes free status so a model that went paid loses its FREE badge", () => {
    const freeCurated = { ...curated, free: true, credits: { input: 0, output: 0 } };
    const nowPaid = normalise(raw({ id: "z-ai/glm-5.2" }), FETCHED);

    const merged = mergeCatalog([freeCurated], [nowPaid]).find((m) => m.id === curated.id)!;
    expect(merged.free).toBe(false);
  });

  it("zeroes credits when a curated model becomes free upstream", () => {
    const nowFree = normalise(
      raw({ id: "z-ai/glm-5.2", pricing: { prompt: "0", completion: "0" } }),
      FETCHED,
    );
    const merged = mergeCatalog([curated], [nowFree]).find((m) => m.id === curated.id)!;

    expect(merged.free).toBe(true);
    expect(merged.credits).toEqual({ input: 0, output: 0 });
  });

  it("passes through discovered models the curated list does not have", () => {
    const discovered = normalise(raw({ pricing: { prompt: "0", completion: "0" } }), FETCHED);
    const merged = mergeCatalog([curated], [discovered]);
    expect(merged.map((m) => m.id)).toContain("openrouter:acme/model-1");
  });

  it("never loses a curated model when the catalog is empty", () => {
    expect(mergeCatalog(MODELS, [])).toHaveLength(MODELS.length);
  });
});
