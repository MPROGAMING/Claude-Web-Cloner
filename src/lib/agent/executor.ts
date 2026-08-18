import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { inferService, validateProjectPath } from "@/lib/roblox/project-model";
import { invertOperations } from "@/lib/agent/changesets";
import { logger } from "@/lib/logger";
import type { ChangeOperation, Changeset } from "@/lib/agent/types";

/**
 * Applies an approved changeset.
 *
 * The model is not involved here. This replays the exact operation list the
 * user approved, which is what makes approval mean something — if apply
 * re-prompted the model, the user would be consenting to an intention rather
 * than to a change.
 *
 * Postgres has no transaction across separate PostgREST calls, so atomicity is
 * achieved by compensation: every operation carries the rollback captured when
 * it was staged, and a failure part-way through replays the inverse of what
 * already succeeded.
 */

type Client = SupabaseClient<Database>;

export interface ExecutionResult {
  ok: boolean;
  applied: number;
  failedAt?: number;
  error?: string;
  rolledBack: boolean;
  operations: { kind: string; path: string; ok: boolean; error?: string }[];
}

interface ExecContext {
  supabase: Client;
  projectId: string;
  userId: string;
}

async function currentFile(ctx: ExecContext, path: string) {
  const { data } = await ctx.supabase
    .from("project_files")
    .select("id, content, revision, kind")
    .eq("project_id", ctx.projectId)
    .eq("path", path)
    .maybeSingle();
  return data;
}

/** Snapshot the previous content so the UI can diff and the user can revert. */
async function snapshot(
  ctx: ExecContext,
  file: { id: string; revision: number; content: string },
) {
  await ctx.supabase.from("file_revisions").insert({
    file_id: file.id,
    project_id: ctx.projectId,
    owner_id: ctx.userId,
    revision: file.revision,
    content: file.content,
  });
}

async function runOperation(
  ctx: ExecContext,
  op: ChangeOperation,
): Promise<{ ok: boolean; error?: string }> {
  // Re-validate at execution time. The path was checked when staged, but a
  // stored changeset is data, and data that reaches a write must be re-checked.
  const validation = validateProjectPath(op.path);
  if (!validation.ok || !validation.path) {
    return { ok: false, error: validation.reason ?? "Invalid path." };
  }
  const path = validation.path;
  const existing = await currentFile(ctx, path);

  if (op.precondition.mustExist && !existing) {
    return { ok: false, error: `${path} no longer exists.` };
  }

  switch (op.kind) {
    case "create":
    case "update": {
      if (op.content === undefined) return { ok: false, error: `${path} has no content.` };
      const bytes = Buffer.byteLength(op.content, "utf8");

      if (existing) {
        await snapshot(ctx, { id: existing.id, revision: existing.revision, content: existing.content });
        const { error } = await ctx.supabase
          .from("project_files")
          .update({
            content: op.content,
            kind: op.fileKind ?? existing.kind,
            size_bytes: bytes,
            revision: existing.revision + 1,
            roblox_parent: op.robloxParent ?? inferService(path),
          })
          .eq("id", existing.id);
        if (error) return { ok: false, error: "Could not save that file." };
      } else {
        const { error } = await ctx.supabase.from("project_files").insert({
          project_id: ctx.projectId,
          owner_id: ctx.userId,
          path,
          content: op.content,
          kind: op.fileKind ?? "module",
          size_bytes: bytes,
          roblox_parent: op.robloxParent ?? inferService(path),
        });
        if (error) return { ok: false, error: "Could not create that file." };
      }
      return { ok: true };
    }

    case "delete": {
      const { error, count } = await ctx.supabase
        .from("project_files")
        .delete({ count: "exact" })
        .eq("project_id", ctx.projectId)
        .eq("path", path);
      if (error) return { ok: false, error: "Could not delete that file." };
      if (!count) return { ok: false, error: `${path} does not exist.` };
      return { ok: true };
    }

    case "move":
    case "rename": {
      const target = validateProjectPath(op.toPath ?? "");
      if (!target.ok || !target.path) {
        return { ok: false, error: target.reason ?? "Invalid destination." };
      }
      if (!existing) return { ok: false, error: `${path} does not exist.` };

      const occupied = await currentFile(ctx, target.path);
      if (occupied) return { ok: false, error: `${target.path} already exists.` };

      const { error } = await ctx.supabase
        .from("project_files")
        .update({ path: target.path, roblox_parent: inferService(target.path) })
        .eq("id", existing.id);
      if (error) return { ok: false, error: "Could not move that file." };
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation: ${String(op.kind)}` };
  }
}

/**
 * Execute every operation, compensating on failure.
 *
 * Deliberately sequential: two operations may touch the same path, and running
 * them concurrently would make the outcome depend on scheduling.
 */
export async function applyChangeset(
  supabase: Client,
  changeset: Changeset,
  userId: string,
): Promise<ExecutionResult> {
  const ctx: ExecContext = { supabase, projectId: changeset.projectId, userId };
  const results: ExecutionResult["operations"] = [];
  const completed: ChangeOperation[] = [];

  for (let i = 0; i < changeset.operations.length; i += 1) {
    const op = changeset.operations[i];
    const outcome = await runOperation(ctx, op);
    results.push({ kind: op.kind, path: op.path, ok: outcome.ok, error: outcome.error });

    if (!outcome.ok) {
      logger.warn("agent.apply.operation_failed", {
        runId: changeset.runId,
        index: i,
        kind: op.kind,
        error: outcome.error,
      });

      const rolledBack = await rollback(ctx, completed);
      return {
        ok: false,
        applied: completed.length,
        failedAt: i,
        error: outcome.error,
        rolledBack,
        operations: results,
      };
    }

    completed.push(op);
  }

  return { ok: true, applied: completed.length, rolledBack: false, operations: results };
}

/** Replay the inverse of what succeeded. Best-effort, and reported honestly. */
async function rollback(ctx: ExecContext, completed: ChangeOperation[]): Promise<boolean> {
  if (!completed.length) return true;

  let clean = true;
  for (const inverse of invertOperations(completed)) {
    const outcome = await runOperation(ctx, inverse);
    if (!outcome.ok) {
      clean = false;
      logger.error("agent.rollback.failed", { path: inverse.path, error: outcome.error });
    }
  }
  return clean;
}

/** Undo an applied changeset on request. */
export async function undoChangeset(
  supabase: Client,
  changeset: Changeset,
  userId: string,
): Promise<ExecutionResult> {
  const ctx: ExecContext = { supabase, projectId: changeset.projectId, userId };
  const results: ExecutionResult["operations"] = [];
  let applied = 0;

  for (const inverse of invertOperations(changeset.operations)) {
    const outcome = await runOperation(ctx, inverse);
    results.push({ kind: inverse.kind, path: inverse.path, ok: outcome.ok, error: outcome.error });
    if (outcome.ok) applied += 1;
  }

  return {
    ok: results.every((r) => r.ok),
    applied,
    rolledBack: false,
    operations: results,
  };
}
