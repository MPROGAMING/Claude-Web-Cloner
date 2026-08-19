"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FilePen,
  FilePlus2,
  FileX2,
  Loader2,
  MoveRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiffView, diffStats, type DiffMode } from "@/components/workspace/diff-view";
import { ModeToggle } from "@/components/workspace/code-editor";
import type { ChangesetData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * Read the change before approving it.
 *
 * The change *summary* — a list of paths and an operation each — is enough to
 * recognise a change set but not enough to consent to one. This is the surface
 * where the two halves meet: the exact stored content on the left of every
 * diff, the exact content that will be written on the right, and the approval
 * control in the same frame so the decision is made where the evidence is.
 *
 * The content is fetched rather than streamed with the message. A change set
 * can be reopened tomorrow, and the "before" side must be what is stored *now*,
 * not what was stored when the model proposed it.
 */

const ICONS = {
  create: FilePlus2,
  update: FilePen,
  delete: FileX2,
  move: MoveRight,
  rename: MoveRight,
} as const;

const TONE: Record<string, string> = {
  create: "text-[var(--success)]",
  update: "text-[var(--signal)]",
  delete: "text-[var(--danger)]",
  move: "text-muted-foreground",
  rename: "text-muted-foreground",
};

interface DiffFile {
  kind: string;
  path: string;
  toPath?: string;
  summary: string;
  before: string | null;
  after: string | null;
}

export function ChangesetReview({
  changeset,
  onClose,
  onApprove,
  busy,
  applied,
}: {
  changeset: ChangesetData;
  onClose: () => void;
  onApprove: () => void;
  busy: boolean;
  applied: boolean;
}) {
  const [files, setFiles] = useState<DiffFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<DiffMode>("inline");

  const blocking = changeset.issues.filter((issue) => issue.severity === "error");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/agent/changesets/${changeset.changesetId}/diff`, {
          cache: "no-store",
        });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setError(body?.error?.message ?? "Could not load these changes.");
          return;
        }
        setFiles(body.files as DiffFile[]);
      } catch {
        if (!cancelled) setError("Could not load these changes.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [changeset.changesetId]);

  const stats = useMemo(
    () => (files ?? []).map((file) => diffStats(file.before, file.after)),
    [files],
  );

  const totals = useMemo(
    () =>
      stats.reduce(
        (sum, stat) => ({ added: sum.added + stat.added, removed: sum.removed + stat.removed }),
        { added: 0, removed: 0 },
      ),
    [stats],
  );

  const step = useCallback(
    (delta: number) => {
      if (!files?.length) return;
      setIndex((current) => (current + delta + files.length) % files.length);
    },
    [files],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      // Cursor's Next File / Previous File, on the keys next to each other.
      if (event.key === "[") step(-1);
      if (event.key === "]") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  const active = files?.[index];

  return (
    <div className="fixed inset-0 z-[90] flex bg-background/80 p-2 backdrop-blur-sm md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Review proposed changes"
        className="animate-pop flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-overlay)]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="text-[0.9375rem] font-semibold">Review changes</h2>
            <p className="truncate font-mono text-[0.625rem] text-muted-foreground">
              {changeset.summary}
              {files && (
                <>
                  {" · "}
                  <span className="text-[var(--diff-add-ink)]">+{totals.added}</span>{" "}
                  <span className="text-[var(--diff-remove-ink)]">−{totals.removed}</span>
                </>
              )}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ModeToggle mode={mode} onChange={setMode} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review"
              className="tap-target rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav
            aria-label="Changed files"
            className="shrink-0 overflow-auto border-b border-hairline md:w-64 md:border-b-0 md:border-r"
          >
            <ul className="flex md:block">
              {(files ?? []).map((file, fileIndex) => {
                const Icon = ICONS[file.kind as keyof typeof ICONS] ?? FilePen;
                const stat = stats[fileIndex];
                const selected = fileIndex === index;

                return (
                  <li key={`${file.kind}-${file.path}`} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => setIndex(fileIndex)}
                      aria-current={selected ? "true" : undefined}
                      className={cn(
                        "tap-row flex w-full items-center gap-2 px-3 py-2 text-left transition-colors focus-ember",
                        selected ? "bg-accent" : "hover:bg-accent/50",
                      )}
                    >
                      <Icon className={cn("size-3.5 shrink-0", TONE[file.kind])} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[0.6875rem]">
                          {(file.toPath ?? file.path).split("/").pop()}
                        </span>
                        <span className="hidden truncate font-mono text-[0.5625rem] text-muted-foreground md:block">
                          {file.toPath ?? file.path}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-[0.5625rem] tabular-nums">
                        <span className="text-[var(--diff-add-ink)]">+{stat.added}</span>{" "}
                        <span className="text-[var(--diff-remove-ink)]">−{stat.removed}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            {error ? (
              <p className="px-4 py-10 text-center text-[0.8125rem] text-[var(--danger)]">{error}</p>
            ) : !files ? (
              <p className="flex items-center justify-center gap-2 px-4 py-10 text-[0.8125rem] text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading the diff…
              </p>
            ) : !active ? (
              <p className="px-4 py-10 text-center text-[0.8125rem] text-muted-foreground">
                This change set has no file operations.
              </p>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-hairline bg-surface/95 px-3 py-1.5 backdrop-blur">
                  <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem]">
                    {active.summary}
                  </span>
                  <span className="shrink-0 font-mono text-[0.5625rem] text-muted-foreground">
                    {index + 1} of {files.length} · [ ]
                  </span>
                </div>
                <DiffView
                  key={active.path}
                  path={active.toPath ?? active.path}
                  before={active.before}
                  after={active.after}
                  mode={mode}
                />
              </>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border px-4 py-2.5">
          {blocking.length > 0 && (
            <ul className="mb-2 space-y-0.5">
              {blocking.map((issue) => (
                <li
                  key={`${issue.rule}-${issue.path ?? ""}`}
                  className="flex items-start gap-1.5 text-[0.72rem] text-[var(--danger)]"
                >
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3">
            {applied ? (
              <span className="flex items-center gap-1.5 text-[0.8125rem] text-[var(--success)]">
                <Check className="size-3.5" /> Applied
              </span>
            ) : (
              <>
                <Button size="sm" onClick={onApprove} disabled={busy || blocking.length > 0}>
                  {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                  Approve and apply
                </Button>
                <span className="text-[0.72rem] text-muted-foreground">
                  {blocking.length > 0
                    ? "Fix the errors above before applying."
                    : "Nothing is written until you approve."}
                </span>
              </>
            )}
            <Button size="sm" variant="ghost" onClick={onClose} className="ml-auto">
              Close
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
