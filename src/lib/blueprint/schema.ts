import { z } from "zod";

/**
 * The Game Blueprint.
 *
 * A blueprint sits between "I want a zombie game" and thirty Luau files. It is
 * the artefact the user actually reviews and approves, so it has to be specific
 * enough to argue with — "the server owns round state" is reviewable, "good
 * architecture" is not.
 *
 * Sections are independent so one can be regenerated or edited without
 * discarding decisions the user already accepted elsewhere.
 */

// ---------------------------------------------------------------------------
// Clarifying questions
// ---------------------------------------------------------------------------

/**
 * Questions asked before planning.
 *
 * Only questions whose answers change what gets built. "What genre?" changes
 * everything; "what colour is the menu?" changes nothing that cannot be fixed
 * later, and asking it wastes the user's patience on the one screen where they
 * are most likely to leave.
 */
export const questionSchema = z.object({
  id: z.string().max(40).describe("Stable slug, e.g. 'core-loop'."),
  question: z.string().max(160).describe("Plain language, one sentence, no jargon."),
  why: z
    .string()
    .max(120)
    .describe("What this answer changes about the build. Shown to the user as a hint."),
  kind: z.enum(["choice", "multi", "text"]),
  options: z
    .array(
      z.object({
        label: z.string().max(60),
        detail: z.string().max(100).describe("One line on what picking this means."),
      }),
    )
    .max(5)
    .describe("2-5 options for choice/multi. Empty for text."),
  /**
   * The option label to preselect, so the flow is answerable by pressing Enter.
   *
   * Nullable rather than optional: OpenAI's strict structured outputs require
   * every property to appear in `required`, so an optional field is rejected
   * outright by the provider. Absence is expressed as null.
   */
  suggested: z.string().max(60).nullable(),
});

export const questionSetSchema = z.object({
  questions: z.array(questionSchema).min(3).max(8),
});

export type BlueprintQuestion = z.infer<typeof questionSchema>;
export type QuestionSet = z.infer<typeof questionSetSchema>;

export type QuestionAnswer = { id: string; answer: string };

// ---------------------------------------------------------------------------
// Blueprint sections
// ---------------------------------------------------------------------------

/**
 * Section keys are fixed rather than model-chosen.
 *
 * A stable set means the UI can render, diff and regenerate a section without
 * guessing, and the agent can look up "what did we decide about the economy"
 * by key instead of searching prose.
 */
export const SECTION_KEYS = [
  "concept",
  "core_loop",
  "players",
  "world",
  "systems",
  "progression",
  "economy",
  "combat",
  "ui",
  "audio",
  "visual_style",
  "persistence",
  "networking",
  "performance",
  "monetization",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  concept: "Concept",
  core_loop: "Core loop",
  players: "Players",
  world: "World & maps",
  systems: "Systems",
  progression: "Progression",
  economy: "Economy",
  combat: "Combat",
  ui: "Interface",
  audio: "Audio",
  visual_style: "Visual style",
  persistence: "Saving",
  networking: "Networking",
  performance: "Performance & mobile",
  monetization: "Monetisation",
};

/** Sections every game needs; the rest are included only when relevant. */
export const REQUIRED_SECTIONS: SectionKey[] = [
  "concept",
  "core_loop",
  "players",
  "world",
  "systems",
  "networking",
  "persistence",
];

export const sectionSchema = z.object({
  key: z.enum(SECTION_KEYS),
  /** Two or three sentences. Prose, not bullet soup. */
  summary: z.string().max(600),
  /** The concrete decisions. Each one must be specific enough to disagree with. */
  decisions: z.array(z.string().max(220)).max(8),
  /** Roblox services, classes or systems this section depends on. */
  roblox: z.array(z.string().max(60)).max(10),
});

export const blueprintSchema = z.object({
  title: z.string().max(80).describe("The game's working name."),
  pitch: z.string().max(240).describe("One sentence a player would understand."),
  genre: z.string().max(40),
  /** Honest scope signal, so the user knows what they are approving. */
  scope: z.enum(["small", "medium", "large"]),
  estimated_scripts: z.number().int().min(1).max(60),
  /**
   * Capped at 9, not 15.
   *
   * The instruction to include only the sections a game needs was ignored — the
   * first real run produced all fifteen, which is ~8k output tokens and most of
   * the two-minute wait. Seven of these are required, so nine leaves room for
   * the two that genuinely matter to this game and makes the limit structural
   * rather than a request.
   */
  sections: z.array(sectionSchema).min(5).max(9),
  /** What is deliberately NOT in version one. Prevents silent scope creep. */
  out_of_scope: z.array(z.string().max(160)).max(8),
  /** The first slice to build — what "done" means for the first build. */
  first_milestone: z.string().max(400),
});

export type Blueprint = z.infer<typeof blueprintSchema>;
export type BlueprintSection = z.infer<typeof sectionSchema>;

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export interface BlueprintIssue {
  severity: "error" | "warning";
  rule: string;
  message: string;
  section?: SectionKey;
}

/**
 * Application-boundary review of a schema-valid blueprint.
 *
 * The schema guarantees shape. These catch blueprints that parse and would
 * still mislead the user about what they are approving — a missing section they
 * will assume was considered, or a scope claim the section count contradicts.
 */
export function reviewBlueprint(blueprint: Blueprint): BlueprintIssue[] {
  const issues: BlueprintIssue[] = [];
  const present = new Set(blueprint.sections.map((s) => s.key));

  for (const key of REQUIRED_SECTIONS) {
    if (!present.has(key)) {
      issues.push({
        severity: "error",
        rule: "missing-required-section",
        message: `The blueprint has no ${SECTION_LABELS[key]} section.`,
        section: key,
      });
    }
  }

  for (const section of blueprint.sections) {
    if (section.decisions.length === 0) {
      issues.push({
        severity: "warning",
        rule: "no-decisions",
        message: `${SECTION_LABELS[section.key]} states no concrete decisions.`,
        section: section.key,
      });
    }
  }

  // A multiplayer game whose networking section never mentions the server is a
  // blueprint that has not thought about the thing that breaks Roblox games.
  const networking = blueprint.sections.find((s) => s.key === "networking");
  if (networking && !/server|remote|replicat/i.test(networking.summary + networking.decisions.join(" "))) {
    issues.push({
      severity: "warning",
      rule: "networking-unspecified",
      message: "Networking does not say what the server owns.",
      section: "networking",
    });
  }

  if (blueprint.scope === "small" && blueprint.estimated_scripts > 12) {
    issues.push({
      severity: "warning",
      rule: "scope-mismatch",
      message: `Scope says small but estimates ${blueprint.estimated_scripts} scripts.`,
    });
  }

  return issues;
}

/** Ordered for display: required sections first, then the rest as generated. */
export function orderSections(sections: BlueprintSection[]): BlueprintSection[] {
  const rank = (key: SectionKey) => {
    const index = REQUIRED_SECTIONS.indexOf(key);
    return index === -1 ? REQUIRED_SECTIONS.length + SECTION_KEYS.indexOf(key) : index;
  };
  return [...sections].sort((a, b) => rank(a.key) - rank(b.key));
}

/**
 * The blueprint as durable context for the agent.
 *
 * Compact on purpose: this is prepended to build turns, so every wasted token
 * is paid for on every step of every build.
 */
export function blueprintToContext(blueprint: Blueprint): string {
  const lines = [
    `# Game blueprint — ${blueprint.title}`,
    `${blueprint.pitch}`,
    `Genre: ${blueprint.genre} · Scope: ${blueprint.scope}`,
    "",
    "These decisions are approved. Follow them; do not quietly redesign them.",
    "",
  ];

  for (const section of orderSections(blueprint.sections)) {
    lines.push(`## ${SECTION_LABELS[section.key]}`);
    lines.push(section.summary);
    for (const decision of section.decisions) lines.push(`- ${decision}`);
    lines.push("");
  }

  if (blueprint.out_of_scope.length) {
    lines.push("## Out of scope for now");
    for (const item of blueprint.out_of_scope) lines.push(`- ${item}`);
    lines.push("");
  }

  lines.push("## First milestone");
  lines.push(blueprint.first_milestone);

  return lines.join("\n");
}
