import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, errorResponse } from "@/lib/errors";
import { loadChangeset, setChangesetStatus } from "@/lib/agent/audit";
import { toPreview } from "@/lib/agent/changesets";
import { logger } from "@/lib/logger";

/**
 * Approve a proposed change set.
 *
 * This endpoint is the authorization event. It exists as its own explicit user
 * action precisely so that approval cannot be produced by the model, by
 * retrieved documentation, or by anything the user happens to type in chat —
 * the only way to reach it is to press the control.
 */
/**
 * An optional subset. Absent means the whole change set, which is what every
 * approval meant before this existed.
 */
const bodySchema = z.object({
  paths: z.array(z.string().max(240)).min(1).max(200).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthorized", "Sign in to continue.", 401);

    const changeset = await loadChangeset(supabase, id, user.id);
    if (!changeset) throw new AppError("not_found", "That change set does not exist.", 404);

    if (changeset.status === "applied") {
      throw new AppError("conflict", "Those changes have already been applied.", 409);
    }
    if (changeset.issues.some((issue) => issue.severity === "error")) {
      throw new AppError(
        "validation_failed",
        "Those changes did not pass validation and cannot be approved.",
        422,
      );
    }

    // A partial approval. The subset is checked against the stored proposal
    // rather than trusted: the request may only ever narrow what the agent
    // proposed, never add to it, so a crafted body cannot smuggle in a write.
    const raw = await request.json().catch(() => ({}));
    const { paths } = bodySchema.parse(raw ?? {});

    let approvedPaths: string[] | undefined;
    if (paths) {
      const proposed = new Set(changeset.operations.map((op) => op.path));
      const unknown = paths.filter((path) => !proposed.has(path));
      if (unknown.length > 0) {
        throw new AppError(
          "invalid_request",
          "Those changes are not part of this change set.",
          400,
        );
      }
      approvedPaths = [...new Set(paths)];
    }

    await setChangesetStatus(supabase, id, "approved", {
      approvedAt: new Date().toISOString(),
      approvedPaths,
    });
    logger.info("agent.changeset.approved", {
      changesetId: id,
      runId: changeset.runId,
      operations: changeset.operations.length,
      approved: approvedPaths ? approvedPaths.length : changeset.operations.length,
      partial: Boolean(approvedPaths && approvedPaths.length < changeset.operations.length),
    });

    return NextResponse.json({
      ok: true,
      changeset: toPreview({ ...changeset, status: "approved", approvedPaths }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
