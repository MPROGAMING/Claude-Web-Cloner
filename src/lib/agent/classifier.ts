import { detectSymbols } from "@/lib/knowledge/symbols";
import type { Classification, RequestKind } from "@/lib/agent/types";

/**
 * What kind of request is this?
 *
 * Section 2 of the brief: do not force every request through the same pipeline.
 * A question deserves an answer, not a build plan; "make me a round-based
 * game" deserves a plan before a single file is written.
 *
 * This runs before the model is called, so it is deterministic pattern matching
 * rather than a classification round-trip. That is a deliberate trade: it costs
 * nothing, it cannot hallucinate a category, and the consequence of being wrong
 * is bounded — an under-classified request still has every tool available to
 * it, it just starts with a smaller budget.
 */

const DEBUG = /\b(fix|broken|not working|doesn'?t work|does not work|why (is|does|isn'?t|doesn'?t)|error|fails?|failing|bug|crash(es|ing)?|nil value|attempt to index|stack ?trace)\b/i;

const MODIFY = /\b(change|modify|update|edit|refactor|rename|adjust|tweak|improve|replace|add (a |an )?\w+ to|remove .* from)\b/i;

const STUDIO = /\b(studio|sync|push (it |them |this )?(in)?to|apply (it|them|these|the changes)|put (it|them|these|the scripts) (in)?to|open place|play ?test|run (it|the game|a test))\b/i;

const STRUCTURE = /\b(project structure|folder structure|map structure|organi[sz]e|scaffold|set ?up the (project|folders)|directory layout|instance tree)\b/i;

const ASSET = /\b(asset|model|mesh|texture|image|sound|audio|animation|gui layout|icon)\b/i;

/** Systems that are inherently multi-file: a server half, a client half, remotes. */
const SYSTEM_NOUNS =
  /\b(round[- ]based|round system|lobby|matchmaking|inventory|shop|currency|leaderboard|leaderstats|save system|data ?store|combat|sword|weapon|damage system|zombie|wave|farming|crop|quest|dialog(ue)?|team|spawn system|teleport|checkpoint|obby|tycoon|pet system|skill tree|crafting|minigame|countdown|arena)\b/i;

const BUILD_VERB = /\b(make|build|create|implement|add|write|generate|set ?up|code)\b/i;

const EXPLAIN =
  /^\s*(what|why|when|how does|how do(es)? .* work|explain|tell me about|difference between|is it|should i|can i|which)\b/i;

function countIndicators(text: string): number {
  // Several named systems, or an explicit list, means multi-file.
  const systems = text.match(new RegExp(SYSTEM_NOUNS.source, "gi"))?.length ?? 0;
  const conjunctions = text.match(/\b(and then|then|also|plus|as well as)\b/gi)?.length ?? 0;
  return systems + Math.min(conjunctions, 3);
}

export function classifyRequest(userText: string): Classification {
  const text = (userText ?? "").trim();
  const signals: string[] = [];

  if (!text) {
    return {
      kind: "explanation",
      requiresPlan: false,
      requiresRetrieval: false,
      mutatesProject: false,
      confidence: 1,
      signals: ["empty"],
    };
  }

  const hasSymbol = detectSymbols(text).length > 0;
  if (hasSymbol) signals.push("api-symbol");

  const indicators = countIndicators(text);
  if (indicators) signals.push(`systems:${indicators}`);

  // Order matters. Studio execution is checked first because "put the scripts
  // into my Studio project" is a build *and* an execution request, and the
  // execution half is what determines the pipeline and the authorization path.
  let kind: RequestKind;
  let confidence = 0.6;

  if (STUDIO.test(text)) {
    kind = "studio_execution";
    confidence = 0.75;
    signals.push("studio");
  } else if (DEBUG.test(text)) {
    kind = "debugging";
    confidence = 0.8;
    signals.push("debug");
  } else if (STRUCTURE.test(text)) {
    kind = "project_structure";
    confidence = 0.7;
    signals.push("structure");
  } else if (BUILD_VERB.test(text) && (indicators >= 2 || (indicators >= 1 && text.length > 90))) {
    kind = "multi_file_implementation";
    confidence = 0.85;
    signals.push("multi-system-build");
  } else if (ASSET.test(text) && BUILD_VERB.test(text)) {
    kind = "asset_generation";
    confidence = 0.6;
    signals.push("asset");
  } else if (MODIFY.test(text) && !BUILD_VERB.test(text)) {
    kind = "code_modification";
    confidence = 0.7;
    signals.push("modify");
  } else if (BUILD_VERB.test(text)) {
    // A single named system is still a build; whether it is one file or several
    // is decided by how much it names.
    kind = indicators >= 1 ? "multi_file_implementation" : "code_generation";
    confidence = 0.7;
    signals.push(indicators >= 1 ? "named-system" : "single-build");
  } else if (EXPLAIN.test(text)) {
    kind = "explanation";
    confidence = 0.75;
    signals.push("question");
  } else {
    kind = "explanation";
    confidence = 0.4;
    signals.push("default");
  }

  const mutatesProject = kind !== "explanation" && kind !== "debugging";
  const requiresPlan = kind === "multi_file_implementation" || kind === "project_structure";

  return {
    kind,
    requiresPlan,
    requiresRetrieval: kind !== "explanation" || hasSymbol || text.length > 24,
    mutatesProject,
    confidence,
    signals,
  };
}
