"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Coins,
  FileCode2,
  Loader2,
  Pause,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Agent run history.
 *
 * Four tables recorded every run since Step 7 and nothing ever showed them. A
 * creator needs to be able to ask "what did it do, did it work, and what did it
 * cost" days later, which is exactly what these rows already answer.
 *
 * Deliberately absent: anything resembling the model's reasoning. The record
 * shows states, tools, artefacts and outcomes — what the system did, not what it
 * was thinking.
 */

export interface RunRow {
  id: string;
  projectId: string;
  projectName: string;
  state: string;
  mode: "preview" | "apply";
  classification: string;
  modelId: string;
  stepCount: number;
  repairAttempts: number;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  creditsCharged: number;
  retrievalMs: number | null;
  generationMs: number | null;
  errorCategory: string | null;
  createdAt: string;
  completedAt: string | null;
  changeset: {
    id: string;
    status: string;
    operationCount: number;
    hasErrors: boolean;
  } | null;
  steps: { state: string; reason: string }[];
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "awaiting", label: "Awaiting approval" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const STATE_TONE: Record<string, { tone: string; icon: typeof Check; label: string }> = {
  COMPLETED: { tone: "text-[var(--success)]", icon: Check, label: "Completed" },
  FAILED: { tone: "text-[var(--danger)]", icon: X, label: "Failed" },
  CANCELLED: { tone: "text-muted-foreground", icon: Pause, label: "Cancelled" },
};

function stateOf(run: RunRow) {
  return (
    STATE_TONE[run.state] ?? {
      tone: "text-[var(--signal)]",
      icon: Loader2,
      label: run.state.charAt(0) + run.state.slice(1).toLowerCase().replace(/_/g, " "),
    }
  );
}

/** "2m 14s" reads better than a millisecond count for a creator. */
function duration(run: RunRow): string | null {
  if (!run.completedAt) return null;
  const ms = new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime();
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function when(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const KIND_LABEL: Record<string, string> = {
  multi_file_implementation: "Built a system",
  code_generation: "Wrote a script",
  code_modification: "Changed a script",
  project_structure: "Organised the project",
  studio_execution: "Sent to Studio",
  debugging: "Fixed a problem",
  explanation: "Answered a question",
  asset_generation: "Made an asset",
};

export function RunHistory({ runs }: { runs: RunRow[] }) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => {
    const awaiting = runs.filter((r) => r.changeset?.status === "pending_approval").length;
    return {
      all: runs.length,
      awaiting,
      completed: runs.filter((r) => r.state === "COMPLETED").length,
      failed: runs.filter((r) => r.state === "FAILED").length,
    };
  }, [runs]);

  const visible = useMemo(() => {
    if (filter === "awaiting") return runs.filter((r) => r.changeset?.status === "pending_approval");
    if (filter === "completed") return runs.filter((r) => r.state === "COMPLETED");
    if (filter === "failed") return runs.filter((r) => r.state === "FAILED");
    return runs;
  }, [runs, filter]);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors focus-ember",
              filter === f.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {f.label}
            <span className="ml-1.5 text-muted-foreground">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-border px-4 py-8 text-center text-[0.875rem] text-muted-foreground">
          Nothing here yet. Runs show up as soon as you ask Blockwright to build something.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {visible.map((run) => {
            const s = stateOf(run);
            const Icon = s.icon;
            const expanded = open === run.id;
            const awaiting = run.changeset?.status === "pending_approval";

            return (
              <li
                key={run.id}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : run.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-ember"
                >
                  <Icon
                    className={cn("size-4 shrink-0", s.tone, run.state === "GENERATING" && "animate-spin")}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[0.9375rem] font-medium">
                        {KIND_LABEL[run.classification] ?? "Run"}
                      </span>
                      <Link
                        href={`/projects/${run.projectId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate text-[0.8125rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        {run.projectName}
                      </Link>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.75rem] text-muted-foreground">
                      <span>{when(run.createdAt)}</span>
                      {duration(run) && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" />
                          {duration(run)}
                        </span>
                      )}
                      {run.creditsCharged > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Coins className="size-3" />
                          {run.creditsCharged}
                        </span>
                      )}
                      {run.changeset && run.changeset.operationCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <FileCode2 className="size-3" />
                          {run.changeset.operationCount} file
                          {run.changeset.operationCount === 1 ? "" : "s"}
                        </span>
                      )}
                      {run.repairAttempts > 0 && (
                        <span className="inline-flex items-center gap-1 text-[var(--warning)]">
                          <Wrench className="size-3" />
                          fixed {run.repairAttempts}×
                        </span>
                      )}
                    </span>
                  </span>

                  {awaiting && (
                    <span className="shrink-0 rounded-md border border-[var(--ember)]/40 bg-[var(--ember)]/10 px-2 py-1 text-[0.6875rem] font-medium text-[var(--ember)]">
                      Needs approval
                    </span>
                  )}
                  {run.mode === "preview" && !awaiting && (
                    <span className="hidden shrink-0 text-[0.6875rem] text-muted-foreground sm:inline">
                      preview
                    </span>
                  )}

                  <ChevronDown
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                      expanded && "rotate-180",
                    )}
                  />
                </button>

                {expanded && (
                  <div className="animate-rise border-t border-border/60 px-4 py-3">
                    {/* The state walk. This is what the agent did, in order —
                        never what it was thinking. */}
                    {run.steps.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {run.steps.map((step, i) => (
                          <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-muted-foreground/50">→</span>}
                            <span className="rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
                              {step.state.toLowerCase().replace(/_/g, " ")}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem] sm:grid-cols-4">
                      {[
                        ["Model", run.modelId.replace(/^openrouter:/, "")],
                        ["Steps", String(run.stepCount)],
                        ["Tools used", String(run.toolCalls)],
                        [
                          "Tokens",
                          `${(run.inputTokens / 1000).toFixed(1)}k in / ${(run.outputTokens / 1000).toFixed(1)}k out`,
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-0.5 truncate font-mono text-[0.75rem]">{value}</dd>
                        </div>
                      ))}
                    </dl>

                    {run.changeset && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {run.changeset.hasErrors ? (
                          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--danger)]">
                            <AlertTriangle className="size-3.5" />
                            The proposed changes did not pass validation
                          </span>
                        ) : run.changeset.status === "applied" ? (
                          <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--success)]">
                            <ShieldCheck className="size-3.5" />
                            Approved and applied
                          </span>
                        ) : (
                          <span className="text-[0.8125rem] text-muted-foreground">
                            {run.changeset.operationCount} change
                            {run.changeset.operationCount === 1 ? "" : "s"} proposed ·{" "}
                            {run.changeset.status.replace(/_/g, " ")}
                          </span>
                        )}

                        <Link
                          href={`/projects/${run.projectId}`}
                          className="ml-auto rounded-lg border border-border px-2.5 py-1 text-[0.75rem] transition-colors hover:bg-accent focus-ember"
                        >
                          {awaiting ? "Review changes" : "Open project"}
                        </Link>
                      </div>
                    )}

                    {run.errorCategory && (
                      <p className="mt-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3 py-2 text-[0.8125rem] text-[var(--danger)]">
                        Stopped during {run.errorCategory}.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
