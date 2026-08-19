import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  REQUIRED_SECTIONS,
  SECTION_LABELS,
  blueprintSchema,
  blueprintToContext,
  dedupeSections,
  orderSections,
  questionSetSchema,
  reviewBlueprint,
  type Blueprint,
} from "@/lib/blueprint/schema";

/**
 * Blueprint layer.
 *
 * The blueprint is what the creator approves, and an approved blueprint becomes
 * binding context for every later build. So the properties worth pinning are
 * about honesty: it cannot claim sections it does not have, cannot pass review
 * while missing the ones that decide architecture, and cannot silently drop a
 * decision on the way into the agent's context.
 */

const section = (key: Blueprint["sections"][number]["key"], extra: Partial<Blueprint["sections"][number]> = {}) => ({
  key,
  summary: `${key} summary that says something specific about the game.`,
  decisions: [`${key} decision one`, `${key} decision two`],
  roblox: ["Players"],
  ...extra,
});

const validBlueprint = (): Blueprint => ({
  title: "Barricade",
  pitch: "Hold out against waves of zombies and spend your winnings between rounds.",
  genre: "Round-based survival",
  scope: "medium",
  estimated_scripts: 14,
  sections: [
    ...REQUIRED_SECTIONS.map((key) => section(key)),
    section("economy"),
  ].map((s) =>
    s.key === "networking"
      ? { ...s, summary: "The server owns round state and replicates it to clients." }
      : s,
  ),
  out_of_scope: ["Cosmetic shop", "Cross-server leaderboards"],
  first_milestone: "Two players can join, survive one wave, and return to the lobby.",
});

// ---------------------------------------------------------------------------
describe("question set", () => {
  it("accepts a well-formed set", () => {
    const parsed = questionSetSchema.safeParse({
      questions: [
        {
          id: "player-count",
          question: "How many players in a round?",
          why: "Decides matchmaking and whether the lobby needs a queue.",
          kind: "choice",
          options: [
            { label: "1-4", detail: "Small squads, simple lobby." },
            { label: "5-12", detail: "Needs a proper queue and team balance." },
          ],
          suggested: "5-12",
        },
        {
          id: "persistence",
          question: "Should progress save between sessions?",
          why: "Decides whether DataStores are needed at all.",
          kind: "choice",
          options: [
            { label: "Yes", detail: "Adds DataStore saving and load handling." },
            { label: "No", detail: "Everything resets each server." },
          ],
          suggested: null,
        },
        {
          id: "art",
          question: "What should it look like?",
          why: "Sets lighting and asset direction.",
          kind: "text",
          options: [],
          suggested: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses an interrogation or an empty set", () => {
    const one = (i: number) => ({
      id: `q${i}`,
      question: "Question?",
      why: "Because.",
      kind: "text" as const,
      options: [],
      suggested: null,
    });

    expect(questionSetSchema.safeParse({ questions: [] }).success).toBe(false);
    expect(questionSetSchema.safeParse({ questions: [one(1), one(2)] }).success).toBe(false);
    // More than eight is an interrogation, not a setup flow.
    expect(
      questionSetSchema.safeParse({ questions: Array.from({ length: 9 }, (_, i) => one(i)) }).success,
    ).toBe(false);
  });

  it("rejects more than five options on a choice", () => {
    const parsed = questionSetSchema.safeParse({
      questions: [
        {
          id: "x",
          question: "Pick one",
          why: "It matters.",
          kind: "choice",
          options: Array.from({ length: 6 }, (_, i) => ({ label: `${i}`, detail: "d" })),
          suggested: null,
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("blueprint schema", () => {
  it("accepts a complete blueprint", () => {
    expect(blueprintSchema.safeParse(validBlueprint()).success).toBe(true);
  });

  it("rejects one with too few sections or an invalid section key", () => {
    const thin = { ...validBlueprint(), sections: [section("concept")] };
    expect(blueprintSchema.safeParse(thin).success).toBe(false);

    const bogus = {
      ...validBlueprint(),
      sections: [...validBlueprint().sections, { ...section("concept"), key: "vibes" }],
    };
    expect(blueprintSchema.safeParse(bogus).success).toBe(false);
  });

  it("rejects malformed input outright", () => {
    expect(blueprintSchema.safeParse(null).success).toBe(false);
    expect(blueprintSchema.safeParse("a plan").success).toBe(false);
    expect(blueprintSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("blueprint review", () => {
  it("passes a complete blueprint", () => {
    expect(reviewBlueprint(validBlueprint())).toHaveLength(0);
  });

  it("errors when a section that decides architecture is missing", () => {
    const blueprint = validBlueprint();
    blueprint.sections = blueprint.sections.filter((s) => s.key !== "networking");

    const issues = reviewBlueprint(blueprint);
    expect(issues.some((i) => i.rule === "missing-required-section" && i.severity === "error")).toBe(
      true,
    );
  });

  it("warns when networking never says what the server owns", () => {
    const blueprint = validBlueprint();
    blueprint.sections = blueprint.sections.map((s) =>
      s.key === "networking"
        ? { ...s, summary: "Things talk to each other.", decisions: ["It works"] }
        : s,
    );

    expect(reviewBlueprint(blueprint).some((i) => i.rule === "networking-unspecified")).toBe(true);
  });

  it("warns when the stated scope contradicts the script estimate", () => {
    const blueprint = { ...validBlueprint(), scope: "small" as const, estimated_scripts: 30 };
    expect(reviewBlueprint(blueprint).some((i) => i.rule === "scope-mismatch")).toBe(true);
  });

  it("warns about a section that states no decisions", () => {
    const blueprint = validBlueprint();
    blueprint.sections = blueprint.sections.map((s) =>
      s.key === "world" ? { ...s, decisions: [] } : s,
    );
    expect(reviewBlueprint(blueprint).some((i) => i.rule === "no-decisions")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("agent context", () => {
  it("carries every section and decision into the agent's context", () => {
    const blueprint = validBlueprint();
    const context = blueprintToContext(blueprint);

    for (const s of blueprint.sections) {
      expect(context).toContain(SECTION_LABELS[s.key]);
      for (const decision of s.decisions) expect(context).toContain(decision);
    }
    expect(context).toContain(blueprint.first_milestone);
  });

  it("tells the agent the decisions are settled", () => {
    const context = blueprintToContext(validBlueprint());
    expect(context).toMatch(/approved/i);
    expect(context).toMatch(/do not quietly redesign|Follow them/i);
  });

  it("names what is out of scope so the agent does not build it", () => {
    const context = blueprintToContext(validBlueprint());
    expect(context).toContain("Out of scope");
    expect(context).toContain("Cosmetic shop");
  });

  it("stays compact enough to prepend to every build turn", () => {
    // This context is paid for on every step of every build; a blueprint that
    // renders to tens of thousands of characters would dominate the bill.
    const context = blueprintToContext(validBlueprint());
    expect(context.length).toBeLessThan(6000);
  });
});

// ---------------------------------------------------------------------------
describe("section ordering", () => {
  it("puts the architecture-deciding sections first", () => {
    const blueprint = validBlueprint();
    const shuffled = [...blueprint.sections].reverse();
    const ordered = orderSections(shuffled);

    expect(ordered[0].key).toBe("concept");
    expect(ordered.findIndex((s) => s.key === "networking")).toBeLessThan(
      ordered.findIndex((s) => s.key === "economy"),
    );
  });

  it("does not lose or duplicate sections", () => {
    const blueprint = validBlueprint();
    const ordered = orderSections(blueprint.sections);
    expect(ordered).toHaveLength(blueprint.sections.length);
    expect(new Set(ordered.map((s) => s.key)).size).toBe(blueprint.sections.length);
  });
});

// ---------------------------------------------------------------------------
describe("duplicate sections", () => {
  /**
   * A live run produced `… networking, persistence, economy, networking`. The
   * schema has no way to say "keys are unique", and reviewBlueprint built a Set
   * of keys — so the duplicate collapsed and the review reported zero issues.
   *
   * Every consumer keys by section.key, so this was not cosmetic: React saw
   * duplicate keys, one expand toggle opened both panels, and "rewrite this
   * section" mapped over the array and replaced *both* with the same new text.
   */
  function withDuplicate(): Blueprint {
    const blueprint = validBlueprint();
    const networking = blueprint.sections.find((s) => s.key === "networking");
    if (!networking) throw new Error("fixture lost its networking section");
    return { ...blueprint, sections: [...blueprint.sections, { ...networking, summary: "again" }] };
  }

  it("keeps the first occurrence and drops later repeats", () => {
    const sections = dedupeSections(withDuplicate().sections);
    const keys = sections.map((s) => s.key);

    expect(new Set(keys).size).toBe(keys.length);
    // The first one is the one the model committed to before it lost track.
    expect(sections.find((s) => s.key === "networking")?.summary).not.toBe("again");
  });

  it("leaves a blueprint without duplicates untouched", () => {
    const original = validBlueprint().sections;
    expect(dedupeSections(original)).toEqual(original);
  });

  it("reports a duplicate as a blocking error rather than passing silently", () => {
    const issues = reviewBlueprint(withDuplicate());
    const duplicate = issues.find((i) => i.rule === "duplicate-section");

    expect(duplicate).toBeDefined();
    expect(duplicate?.severity).toBe("error");
    expect(duplicate?.message).toContain("2 times");
  });

  it("still passes once deduped", () => {
    const blueprint = withDuplicate();
    expect(reviewBlueprint({ ...blueprint, sections: dedupeSections(blueprint.sections) })).toHaveLength(0);
  });
});
