import "server-only";

import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  MAX_CONTENT_CHARS,
  MAX_FACTS_PER_RUN,
  MEMORY_KINDS,
  MIN_CONTENT_CHARS,
} from "@/lib/memory/facts";
import { recordMemory } from "@/lib/memory/service";
import { logger } from "@/lib/logger";

/**
 * The agent's write access to project memory.
 *
 * Reading is not a tool: live facts are already in the system prompt, so a
 * `recall_memory` tool would only let the model spend a step fetching what it
 * was handed. Writing has to be a tool, because only the model knows which
 * sentence in a long turn was the durable decision.
 *
 * This tool writes in preview runs as well as apply runs, which is deliberate
 * and is the one place memory departs from the changeset model. Preview is the
 * default mode, so gating memory on apply would mean almost nothing was ever
 * remembered. The write is owner-scoped, capped per run, capped per project,
 * and visible and deletable in the workspace — the properties that make it safe
 * are those, not the mode.
 */

export interface MemoryToolContext {
  supabase: SupabaseClient<Database>;
  projectId: string;
  userId: string;
  runId?: string | null;
  /** Records a human-readable step for the live status rail. */
  onActivity?: (event: { kind: string; summary: string; detail?: unknown }) => void;
}

export function buildMemoryTools(ctx: MemoryToolContext) {
  // Per-run ceiling. A model that decides everything is worth remembering would
  // otherwise fill the project's memory in a single turn, and the next turn
  // would open with eighty lines of noise.
  let recordedThisRun = 0;

  return {
    remember_fact: tool({
      description:
        "Record one durable decision about this project so it survives into later conversations. " +
        "Use it for things that would be wrong to contradict next week: a named mechanic or currency " +
        "(\"the currency is called Sparks\"), a tuned value the creator chose (\"crystals respawn every 45s\"), " +
        "a scope decision (\"no shop system\"), or a stated preference (\"keep all UI in src/ui\"). " +
        "Do NOT record what is already visible elsewhere — file contents, file paths, the current task, " +
        "or anything in the approved plan. Do NOT record a fact that is already listed under PROJECT MEMORY. " +
        "One atomic fact per call. When the creator changes their mind, call this again with `replaces` " +
        "set to the id of the fact that is now wrong.",
      inputSchema: z.object({
        kind: z
          .enum(MEMORY_KINDS)
          .describe(
            "decision = a choice made about the build; constraint = something that must or must not happen; " +
              "preference = how the creator likes things done; terminology = a name this project uses for something; " +
              "fact = anything else durable.",
          ),
        content: z
          .string()
          .min(MIN_CONTENT_CHARS)
          .max(MAX_CONTENT_CHARS)
          .describe(
            "The fact, in one short sentence, stated plainly and in full. It will be read months from now with no conversation around it, so \"45 seconds\" is useless and \"crystals respawn every 45 seconds\" is not.",
          ),
        source: z
          .enum(["agent", "user"])
          .describe(
            "user when the creator stated it themselves; agent when you inferred or decided it. Be honest: user facts outrank agent facts when they conflict.",
          ),
        replaces: z
          .string()
          .uuid()
          .optional()
          .describe(
            "The id of an existing remembered fact this one corrects, taken from the PROJECT MEMORY block. The old fact is kept as history, not deleted.",
          ),
      }),
      execute: async ({ kind, content, source, replaces }) => {
        if (recordedThisRun >= MAX_FACTS_PER_RUN) {
          return {
            ok: false as const,
            error: `You have already recorded ${MAX_FACTS_PER_RUN} facts this turn, which is the limit. Continue with the task.`,
          };
        }

        const result = await recordMemory(ctx.supabase, {
          projectId: ctx.projectId,
          userId: ctx.userId,
          kind,
          content,
          source,
          runId: ctx.runId ?? null,
          replaces: replaces ?? null,
        });

        if (!result.ok) {
          return { ok: false as const, error: result.error };
        }

        recordedThisRun += 1;

        if (result.deduped) {
          ctx.onActivity?.({
            kind: "memory.known",
            summary: `Already remembered: ${result.fact.content.slice(0, 60)}`,
            detail: { id: result.fact.id, kind: result.fact.kind },
          });
          return {
            ok: true as const,
            recorded: false,
            id: result.fact.id,
            note: "This project already remembers that. Nothing was added — do not try again with different wording.",
          };
        }

        logger.info("memory.recorded", {
          projectId: ctx.projectId,
          runId: ctx.runId ?? undefined,
          kind: result.fact.kind,
          source: result.fact.source,
          superseded: result.superseded ?? undefined,
        });

        ctx.onActivity?.({
          kind: result.superseded ? "memory.corrected" : "memory.recorded",
          summary: result.superseded
            ? `Corrected a remembered fact: ${result.fact.content.slice(0, 60)}`
            : `Remembered: ${result.fact.content.slice(0, 60)}`,
          detail: { id: result.fact.id, kind: result.fact.kind, replaces: result.superseded },
        });

        return {
          ok: true as const,
          recorded: true,
          id: result.fact.id,
          kind: result.fact.kind,
          superseded: result.superseded,
          note: result.superseded
            ? "Recorded, and the previous fact is kept as history. The creator can see and delete this from the Memory panel."
            : "Recorded. The creator can see and delete this from the Memory panel.",
        };
      },
    }),
  };
}

export type MemoryTools = ReturnType<typeof buildMemoryTools>;
