"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  FileDiff,
  FilePlus2,
  FilePen,
  FileX2,
  Loader2,
  MoveRight,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { playSound } from "@/lib/sound";
import { Button } from "@/components/ui/button";
import { ChangesetReview } from "@/components/workspace/changeset-review";
import type { ChangesetData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * The approval control for a proposed change set.
 *
 * This component is the authorization surface: approving here is the only path
 * to applying changes. That is why the button says what will happen and shows
 * the exact file list, rather than offering a friendly "Looks good" — the user
 * is consenting to a specific set of writes, not expressing approval of an idea.
 */

const ICONS = {
  create: FilePlus2,
  update: FilePen,
  delete: FileX2,
  move: MoveRight,
  rename: MoveRight,
} as const;

const TONE = {
  create: "text-[var(--success)]",
  update: "text-[var(--signal)]",
  delete: "text-[var(--danger)]",
  move: "text-muted-foreground",
  rename: "text-muted-foreground",
} as const;

type Phase = "idle" | "approving" | "applying" | "applied" | "undoing" | "undone";

export function ChangesetCard({ changeset }: { changeset: ChangesetData }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    changeset.status === "applied" ? "applied" : "idle",
  );
  const [reviewing, setReviewing] = useState(false);

  const blocking = changeset.issues.filter((issue) => issue.severity === "error");
  const busy = phase === "approving" || phase === "applying" || phase === "undoing";

  async function call(
    path: string,
    label: string,
    body?: unknown,
  ): Promise<{ applied?: number; reverted?: number }> {
    const response = await fetch(`/api/agent/changesets/${changeset.changesetId}/${path}`, {
      method: "POST",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      applied?: number;
      reverted?: number;
    };
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Could not ${label}.`);
    }
    return payload;
  }

  /**
   * Approve and apply are separate server actions but one button, because two
   * clicks to accomplish one intent is friction without safety: the approval
   * record is still written, and it is still impossible to reach apply without
   * it.
   */
  async function approveAndApply(paths?: string[]) {
    setPhase("approving");
    try {
      // `paths` is present only when the user narrowed the set in the review
      // dialog. Absent means the whole proposal, which keeps the recorded
      // approval honest about what was actually agreed to.
      await call("approve", "approve these changes", paths ? { paths } : undefined);
      setPhase("applying");
      const result = await call("apply", "apply these changes");
      setPhase("applied");
      playSound("approve");
      toast.success(`Applied ${result.applied} change${result.applied === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (error) {
      setPhase("idle");
      playSound("error");
      toast.error(error instanceof Error ? error.message : "Could not apply those changes.");
    }
  }

  async function undo() {
    setPhase("undoing");
    try {
      const result = await call("undo", "undo these changes");
      setPhase("undone");
      toast.success(`Reverted ${result.reverted} change${result.reverted === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (error) {
      setPhase("applied");
      toast.error(error instanceof Error ? error.message : "Could not undo those changes.");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface-sunken/60">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[0.75rem] font-medium">Proposed changes</span>
        <span className="text-[0.72rem] text-muted-foreground">{changeset.summary}</span>
        {phase === "applied" && (
          <span className="ml-auto flex items-center gap-1 text-[0.72rem] text-[var(--success)]">
            <Check className="size-3" /> Applied
          </span>
        )}
        {phase === "undone" && (
          <span className="ml-auto text-[0.72rem] text-muted-foreground">Reverted</span>
        )}
      </div>

      <ul className="divide-y divide-border/60">
        {changeset.operations.map((op) => {
          const Icon = ICONS[op.kind];
          return (
            <li key={`${op.kind}-${op.path}`}>
              {/* The row is the way into the diff: a summary that cannot be
                  opened teaches people to approve without reading. */}
              <button
                type="button"
                onClick={() => setReviewing(true)}
                className="tap-row flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-accent/50 focus-ember"
              >
                <Icon className={cn("size-3 shrink-0", TONE[op.kind])} />
                <code className="truncate text-[0.72rem]">{op.path}</code>
                {op.toPath && (
                  <code className="truncate text-[0.72rem] text-muted-foreground">→ {op.toPath}</code>
                )}
                {op.validation && op.validation.errors > 0 && (
                  <span className="ml-auto shrink-0 text-[0.7rem] text-[var(--danger)]">
                    {op.validation.errors} error{op.validation.errors === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {blocking.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          {blocking.map((issue) => (
            <p
              key={`${issue.rule}-${issue.path ?? ""}`}
              className="flex items-start gap-1.5 text-[0.72rem] text-[var(--danger)]"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              {issue.message}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3 py-2">
        <Button size="sm" variant="outline" onClick={() => setReviewing(true)}>
          <FileDiff className="size-3" />
          Review changes
        </Button>

        {phase === "applied" || phase === "undoing" ? (
          <Button size="sm" variant="ghost" onClick={undo} disabled={busy}>
            {phase === "undoing" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Undo2 className="size-3" />
            )}
            Undo
          </Button>
        ) : phase === "undone" ? null : (
          <>
            <Button size="sm" onClick={() => approveAndApply()} disabled={busy || blocking.length > 0}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {phase === "approving"
                ? "Approving…"
                : phase === "applying"
                  ? "Applying…"
                  : "Approve and apply"}
            </Button>
            <span className="text-[0.7rem] text-muted-foreground">
              {blocking.length > 0
                ? "Fix the errors above before applying."
                : "Nothing is written until you approve."}
            </span>
          </>
        )}
      </div>

      {reviewing && (
        <ChangesetReview
          changeset={changeset}
          onClose={() => setReviewing(false)}
          onApprove={approveAndApply}
          busy={busy}
          applied={phase === "applied" || phase === "undone"}
        />
      )}
    </div>
  );
}
