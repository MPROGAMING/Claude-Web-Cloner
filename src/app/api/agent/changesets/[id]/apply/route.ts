import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { authorizeApply } from "@/lib/agent/authorization";
import { loadChangeset, setChangesetStatus } from "@/lib/agent/audit";
import { applyChangeset } from "@/lib/agent/executor";
import { validateChangesetFiles } from "@/lib/agent/repair";
import { logger } from "@/lib/logger";

/**
 * Apply an approved change set.
 *
 * The model is not involved. This replays the exact operations recorded when
 * the preview was produced, which is what makes approval meaningful — if apply
 * re-generated the code, the user would have approved an intention rather than
 * a change.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const changeset = await loadChangeset(supabase, id, user.id);

    // Ownership of the project is checked independently of ownership of the
    // change set: RLS covers both, and this is the second, explicit gate.
    const { data: project } = await supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", changeset?.projectId ?? "")
      .maybeSingle();

    const decision = authorizeApply({
      userId: user.id,
      projectOwnerId: project?.owner_id ?? null,
      changeset,
    });

    if (!decision.ok || !changeset) {
      logger.warn("agent.apply.denied", { changesetId: id, denial: decision.denial });
      // The denial reason is logged above; the client gets a stable code and the
      // human-readable message, not the internal denial vocabulary.
      const code =
        decision.denial === "not_authenticated"
          ? "unauthorized"
          : decision.denial === "changeset_not_approved" ||
              decision.denial === "conversational_assent_is_not_approval"
            ? "changeset_not_approved"
            : decision.denial === "changeset_has_errors"
              ? "validation_failed"
              : "forbidden";
      throw new AppError(code, decision.message ?? "Not allowed.", code === "unauthorized" ? 401 : 403);
    }

    // Re-validate the stored operations. A change set is data, and data that
    // reaches a write is re-checked no matter who stored it.
    const validation = validateChangesetFiles(changeset.operations);
    if (!validation.ok) {
      await setChangesetStatus(supabase, id, "failed");
      logger.warn("agent.apply.validation_failed", {
        changesetId: id,
        luauErrors: validation.luauErrors,
        securityErrors: validation.securityErrors,
      });
      // The report describes the user's own generated code, so returning it is
      // both safe and the only way they can act on the refusal.
      throw new AppError(
        "validation_failed",
        "Those changes no longer pass validation and were not applied.",
        422,
        { report: validation.report.slice(0, 2000) },
      );
    }

    const result = await applyChangeset(supabase, changeset, user.id);

    await setChangesetStatus(supabase, id, result.ok ? "applied" : "failed", {
      appliedAt: result.ok ? new Date().toISOString() : undefined,
    });

    if (result.ok) {
      await supabase
        .from("projects")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", changeset.projectId);

      await supabase.from("activity_events").insert({
        owner_id: user.id,
        project_id: changeset.projectId,
        kind: "changeset.applied",
        summary: `Applied ${result.applied} change${result.applied === 1 ? "" : "s"}`,
        detail: { changesetId: id, runId: changeset.runId } as never,
      });
    }

    logger.info("agent.changeset.applied", {
      changesetId: id,
      runId: changeset.runId,
      ok: result.ok,
      applied: result.applied,
      rolledBack: result.rolledBack,
    });

    return NextResponse.json({
      ok: result.ok,
      applied: result.applied,
      rolledBack: result.rolledBack,
      failedAt: result.failedAt,
      operations: result.operations,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
