import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProjectMemoryRow } from "@/lib/supabase/types";
import {
  MAX_LIVE_FACTS,
  type MemoryFact,
  type MemoryKind,
  type MemorySource,
  normaliseFact,
} from "@/lib/memory/facts";

/**
 * Project memory, the database half.
 *
 * Uses the caller's own client throughout, so RLS is the final authority and
 * this module never needs the service role. The explicit project/owner filters
 * are belt-and-braces: they turn "someone else's id" into a clean refusal
 * rather than a silent zero-row write.
 */

type Client = SupabaseClient<Database>;

const COLUMNS =
  "id, kind, content, source, source_run_id, source_message_id, superseded_by, superseded_at, created_at";

type MemorySelection = Pick<
  ProjectMemoryRow,
  | "id"
  | "kind"
  | "content"
  | "source"
  | "source_run_id"
  | "source_message_id"
  | "superseded_by"
  | "superseded_at"
  | "created_at"
>;

function toFact(row: MemorySelection): MemoryFact {
  return {
    id: row.id,
    kind: row.kind,
    content: row.content,
    source: row.source,
    runId: row.source_run_id,
    messageId: row.source_message_id,
    supersededBy: row.superseded_by,
    supersededAt: row.superseded_at,
    createdAt: row.created_at,
  };
}

export interface ListMemoryOptions {
  /** Include corrected facts, which the workspace shows under "Corrected". */
  includeSuperseded?: boolean;
  limit?: number;
}

/**
 * Read a project's memory, newest first.
 *
 * Newest first is what the prompt wants (the most recent statement of a thing
 * is the one to follow) and what the panel wants (recent corrections at the
 * top), so there is no second ordering to keep in sync.
 */
export async function listMemory(
  supabase: Client,
  projectId: string,
  options: ListMemoryOptions = {},
): Promise<MemoryFact[]> {
  let query = supabase
    .from("project_memory")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (!options.includeSuperseded) query = query.is("superseded_by", null);

  const { data } = await query;
  return (data ?? []).map(toFact);
}

export interface RecordMemoryInput {
  projectId: string;
  userId: string;
  kind: MemoryKind;
  content: string;
  source: MemorySource;
  runId?: string | null;
  messageId?: string | null;
  /** Id of a live fact this one corrects. */
  replaces?: string | null;
}

export type RecordMemoryResult =
  | { ok: true; fact: MemoryFact; deduped: boolean; superseded: string | null }
  | { ok: false; error: string };

/**
 * Write one fact, deduplicating and superseding as needed.
 *
 * The insert happens before the supersession update, so a rejected duplicate
 * leaves the existing fact untouched rather than half-corrected. The unique
 * partial index on (project_id, content_key) over live rows is what actually
 * enforces dedup — the pre-read below is an optimisation and a nicer message,
 * not the guarantee, because two concurrent turns can pass it both.
 */
export async function recordMemory(
  supabase: Client,
  input: RecordMemoryInput,
): Promise<RecordMemoryResult> {
  const normalised = normaliseFact(input.content);
  if (!normalised.ok) return { ok: false, error: normalised.reason };

  let replaced: MemoryFact | null = null;
  if (input.replaces) {
    const { data } = await supabase
      .from("project_memory")
      .select(COLUMNS)
      .eq("id", input.replaces)
      .eq("project_id", input.projectId)
      .maybeSingle();

    if (!data) {
      return { ok: false, error: "There is no remembered fact with that id in this project." };
    }
    replaced = toFact(data);
    if (replaced.supersededBy) {
      return { ok: false, error: "That fact has already been corrected." };
    }
  }

  const { data: existing } = await supabase
    .from("project_memory")
    .select(COLUMNS)
    .eq("project_id", input.projectId)
    .eq("content_key", normalised.key)
    .is("superseded_by", null)
    .maybeSingle();

  if (existing) {
    const known = toFact(existing);

    // A correction whose text is already remembered elsewhere. The dedup must
    // not swallow the correction too, or the fact being corrected stays live
    // and the project ends up holding both halves of a contradiction.
    if (replaced && replaced.id !== known.id) {
      await supabase
        .from("project_memory")
        .update({ superseded_by: known.id, superseded_at: new Date().toISOString() })
        .eq("id", replaced.id)
        .eq("owner_id", input.userId);

      return { ok: true, fact: known, deduped: true, superseded: replaced.id };
    }

    // Already known. Saying so is more useful to the agent than a silent
    // success, and it stops a loop of re-recording the same decision.
    return { ok: true, fact: known, deduped: true, superseded: null };
  }

  if (!replaced) {
    const { count } = await supabase
      .from("project_memory")
      .select("id", { count: "exact", head: true })
      .eq("project_id", input.projectId)
      .is("superseded_by", null);

    if ((count ?? 0) >= MAX_LIVE_FACTS) {
      return {
        ok: false,
        error: `This project already remembers ${MAX_LIVE_FACTS} facts. Correct an existing one with \`replaces\` instead of adding another.`,
      };
    }
  }

  const { data: inserted, error } = await supabase
    .from("project_memory")
    .insert({
      project_id: input.projectId,
      owner_id: input.userId,
      kind: input.kind,
      content: normalised.content,
      content_key: normalised.key,
      source: input.source,
      source_run_id: input.runId ?? null,
      source_message_id: input.messageId ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error || !inserted) {
    // A concurrent turn recorded the same fact between the read and the write.
    // That is the dedup working, not a failure.
    const { data: raced } = await supabase
      .from("project_memory")
      .select(COLUMNS)
      .eq("project_id", input.projectId)
      .eq("content_key", normalised.key)
      .is("superseded_by", null)
      .maybeSingle();

    if (raced) return { ok: true, fact: toFact(raced), deduped: true, superseded: null };
    return { ok: false, error: "Could not save that memory." };
  }

  const fact = toFact(inserted);

  if (replaced) {
    await supabase
      .from("project_memory")
      .update({ superseded_by: fact.id, superseded_at: new Date().toISOString() })
      .eq("id", replaced.id)
      .eq("owner_id", input.userId);
  }

  return { ok: true, fact, deduped: false, superseded: replaced?.id ?? null };
}

/**
 * Permanently remove one fact, and the corrections behind it.
 *
 * A hard delete, unlike the changeset tables. This is context the agent acts
 * on, not an audit trail: a creator who says "forget that" has to be able to
 * make it actually gone, or the correction UI is theatre. The FK on
 * `superseded_by` cascades, so the superseded history goes with it rather than
 * resurfacing as live.
 */
export async function forgetMemory(
  supabase: Client,
  factId: string,
  userId: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("project_memory")
    .delete({ count: "exact" })
    .eq("id", factId)
    .eq("owner_id", userId);

  return (count ?? 0) > 0;
}
