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
import { formatTokens } from "@/lib/format";
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
 *
 * The tool list added later does not cross that line. Those rows are the same
 * strings the live status rail showed while the run was happening — a tool
 * name, whether it worked, how long it took, and the one-line summary the tool
 * itself wrote. They are a replay of the actions, and `agent_tool_calls`
 * deliberately never stored arguments or results in the first place.
 *
 * Read order is the whole design: state first (a coloured spine you can scan a
 * column of without reading a word), then what it built in play language, then
 * the receipt — files, credits, duration — and only on request the tool-by-tool
 * replay. A run that needs a decision is the loudest thing in the list.
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
  validationMs: number | null;
  errorCategory: string | null;
  createdAt: string;
  completedAt: string | null;
  changeset: {
    id: string;
    status: string;
    operationCount: number;
    hasErrors: boolean;
    issues: RunIssue[];
  } | null;
  steps: { state: string; reason: string }[];
  /** One row per tool the agent actually invoked, in order. */
  tools: RunToolCall[];
}

export interface RunIssue {
  severity: string;
  rule: string;
  message: string;
  path?: string;
}

export interface RunToolCall {
  name: string;
  ok: boolean;
  durationMs: number;
  summary: string;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "awaiting", label: "Needs you" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

/**
 * State, encoded three ways at once: a glyph, an ink, and the colour of the
 * spine down the left edge of the row. Colour alone is never the carrier.
 */
const STATE_TONE: Record<
  string,
  { ink: string; spine: string; tile: string; icon: typeof Check; label: string }
> = {
  COMPLETED: {
    ink: "text-[var(--success)]",
    spine: "bg-[var(--success)]",
    tile: "bg-[var(--success)]/12",
    icon: Check,
    label: "Completed",
  },
  FAILED: {
    ink: "text-[var(--danger)]",
    spine: "bg-[var(--danger)]",
    tile: "bg-[var(--danger)]/12",
    icon: X,
    label: "Failed",
  },
  CANCELLED: {
    ink: "text-muted-foreground",
    spine: "bg-muted-foreground/40",
    tile: "bg-surface-sunken",
    icon: Pause,
    label: "Cancelled",
  },
};

function stateOf(run: RunRow) {
  return (
    STATE_TONE[run.state] ?? {
      ink: "text-[var(--signal)]",
      spine: "bg-[var(--signal)]",
      tile: "bg-[var(--signal)]/12",
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

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
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

export function RunHistory({
  runs,
  initialOpenRunId,
}: {
  runs: RunRow[];
  /** From `/activity?run=<id>`, which is where a failure notification lands. */
  initialOpenRunId?: string;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  // Lazy initial value rather than an effect that syncs the prop into state:
  // the answer is known at first render, and the React Compiler lint rejects
  // the effect form outright.
  const [open, setOpen] = useState<string | null>(() => initialOpenRunId ?? null);

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

  // Grouped by calendar day for the same reason the event feed is: a flat list
  // of forty rows has no landmarks, and "when did it stop working" is the
  // question this page gets asked most.
  const days = useMemo(() => {
    const map = new Map<string, RunRow[]>();
    for (const run of visible) {
      const day = dayOf(run.createdAt);
      map.set(day, [...(map.get(day) ?? []), run]);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div>
      <div
        role="group"
        aria-label="Filter builds"
        className="inline-flex w-full flex-wrap gap-1 rounded-xl border border-border bg-surface-sunken p-1 sm:w-fit"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const urgent = f.id === "awaiting" && counts.awaiting > 0;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={active}
              className={cn(
                "tap-row inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.8125rem] font-medium transition-colors focus-ember",
                active
                  ? "bg-surface text-foreground shadow-flat"
                  : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded px-1.5 py-px font-mono text-[0.6875rem] tabular-nums",
                  urgent
                    ? "bg-[var(--ember)]/15 text-[var(--ember-text)]"
                    : "bg-surface-sunken text-muted-foreground",
                )}
              >
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center text-[0.875rem] text-muted-foreground">
          {filter === "all"
            ? "Nothing here yet. Runs show up as soon as you ask Blockwright to build something."
            : "No builds match that filter."}
        </p>
      ) : (
        <div className="mt-5 space-y-8">
          {days.map(([day, dayRuns]) => (
            <section key={day}>
              <h2 className="label-meta sticky top-14 z-10 -mx-1 bg-background/90 px-1 py-2 backdrop-blur">
                {day}
                <span className="ml-2 normal-case tracking-normal opacity-70">
                  {dayRuns.length} build{dayRuns.length === 1 ? "" : "s"}
                </span>
              </h2>

              <ul className="mt-2 space-y-2">
                {dayRuns.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    expanded={open === run.id}
                    onToggle={() => setOpen(open === run.id ? null : run.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  expanded,
  onToggle,
}: {
  run: RunRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const s = stateOf(run);
  const Icon = s.icon;
  const awaiting = run.changeset?.status === "pending_approval";
  const runDuration = duration(run);

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-xl border bg-surface transition-colors",
        awaiting ? "border-[var(--ember)]/45" : "border-border",
      )}
    >
      {/* The spine. A column of these is readable as a strip of colour before
          a single word has been read, which is what a log is scanned for. */}
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", s.spine)} />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 py-3 pl-4 pr-3.5 text-left transition-colors hover:bg-accent/40 focus-ember sm:gap-3.5"
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            s.tile,
          )}
        >
          <Icon
            aria-hidden
            className={cn("size-4", s.ink, run.state === "GENERATING" && "animate-spin")}
          />
          <span className="sr-only">{s.label}</span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[0.9375rem] font-semibold">
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
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
            <span>{when(run.createdAt)}</span>
            {runDuration && (
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden className="size-3" />
                {runDuration}
              </span>
            )}
            {run.creditsCharged > 0 && (
              <span className="inline-flex items-center gap-1">
                <Coins aria-hidden className="size-3" />
                {run.creditsCharged}
              </span>
            )}
            {run.changeset && run.changeset.operationCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileCode2 aria-hidden className="size-3" />
                {run.changeset.operationCount} file
                {run.changeset.operationCount === 1 ? "" : "s"}
              </span>
            )}
            {run.repairAttempts > 0 && (
              <span className="inline-flex items-center gap-1 text-[var(--warning)]">
                <Wrench aria-hidden className="size-3" />
                fixed {run.repairAttempts}×
              </span>
            )}
          </span>
        </span>

        {awaiting && (
          <span className="shrink-0 rounded-md border border-[var(--ember)]/40 bg-[var(--ember)]/12 px-2 py-1 text-[0.6875rem] font-semibold text-[var(--ember-text)]">
            Needs approval
          </span>
        )}
        {run.mode === "preview" && !awaiting && (
          <span className="hidden shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground sm:inline">
            preview
          </span>
        )}

        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="animate-rise border-t border-hairline px-4 py-4">
          {/* The state walk. This is what the agent did, in order —
              never what it was thinking. */}
          {run.steps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {run.steps.map((step, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span aria-hidden className="text-muted-foreground/50">
                      →
                    </span>
                  )}
                  <span
                    // The machine's own reason for the transition —
                    // a fixed server-authored string, never model text.
                    title={step.reason || undefined}
                    className="rounded border border-hairline bg-surface-sunken px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground"
                  >
                    {step.state.toLowerCase().replace(/_/g, " ")}
                  </span>
                </span>
              ))}
            </div>
          )}

          <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-surface-sunken px-3.5 py-3 sm:grid-cols-4">
            {[
              ["Model", run.modelId.replace(/^openrouter:/, "")],
              ["Steps", String(run.stepCount)],
              ["Tools used", String(run.toolCalls)],
              [
                "Tokens",
                `${formatTokens(run.inputTokens)} in / ${formatTokens(run.outputTokens)} out`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="label-meta truncate">{label}</dt>
                <dd className="mt-0.5 truncate font-mono text-[0.75rem] tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <TimingBreakdown run={run} />
          <ToolCallList tools={run.tools} total={run.toolCalls} />

          {run.changeset && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-3.5">
              {run.changeset.hasErrors ? (
                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--danger)]">
                  <AlertTriangle aria-hidden className="size-3.5" />
                  The proposed changes did not pass validation
                </span>
              ) : run.changeset.status === "applied" ? (
                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--success)]">
                  <ShieldCheck aria-hidden className="size-3.5" />
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
                className={cn(
                  "tap-row ml-auto inline-flex items-center rounded-lg px-3 py-1.5 text-[0.75rem] font-medium transition-colors focus-ember",
                  awaiting
                    ? "border border-[var(--ember)]/45 bg-[var(--ember)]/12 text-[var(--ember-text)] hover:bg-[var(--ember)]/20"
                    : "border border-border hover:bg-accent",
                )}
              >
                {awaiting ? "Review changes" : "Open project"}
              </Link>
            </div>
          )}

          <IssueList issues={run.changeset?.issues ?? []} />

          {run.errorCategory && (
            <p className="mt-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/8 px-3 py-2 text-[0.8125rem] text-[var(--danger)]">
              Stopped during {run.errorCategory}.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Where the time actually went.
 *
 * The three phase timings have been recorded since Step 7 and none of them were
 * ever shown, so "that took two minutes" had no answer. Retrieval, generation
 * and validation are the three things a run spends time on, and which one
 * dominated is the difference between a slow model and a slow corpus.
 */
function TimingBreakdown({ run }: { run: RunRow }) {
  const phases = [
    { label: "Retrieval", ms: run.retrievalMs ?? 0, tone: "bg-[var(--signal)]" },
    { label: "Generation", ms: run.generationMs ?? 0, tone: "bg-[var(--ember)]" },
    { label: "Validation", ms: run.validationMs ?? 0, tone: "bg-[var(--success)]" },
  ].filter((phase) => phase.ms > 0);

  const total = phases.reduce((sum, phase) => sum + phase.ms, 0);
  if (total <= 0) return null;

  return (
    <div className="mt-3.5">
      <p className="label-meta">Time spent</p>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
        {phases.map((phase) => (
          <span
            key={phase.label}
            className={cn("h-full", phase.tone)}
            style={{ width: `${(phase.ms / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {phases.map((phase) => (
          <li
            key={phase.label}
            className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] tabular-nums text-muted-foreground"
          >
            <span className={cn("size-1.5 rounded-[2px]", phase.tone)} aria-hidden />
            {phase.label} {millis(phase.ms)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the agent actually did, tool by tool.
 *
 * The count was already here; the list never was, which made "12 tools" a
 * number with nothing behind it. These are the same summaries the status rail
 * showed live — actions and outcomes, not reasoning.
 */
function ToolCallList({ tools, total }: { tools: RunToolCall[]; total: number }) {
  if (tools.length === 0) return null;

  return (
    <div className="mt-3.5">
      <p className="label-meta">What it did</p>
      <ol className="mt-1.5 space-y-1">
        {tools.map((tool, i) => (
          <li
            key={i}
            className="flex items-center gap-2 rounded-md border border-hairline bg-surface-sunken px-2.5 py-1.5"
          >
            {tool.ok ? (
              <Check aria-hidden className="size-3 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
            ) : (
              <X aria-hidden className="size-3 shrink-0 text-[var(--danger)]" strokeWidth={2.5} />
            )}
            <span className="min-w-0 flex-1 truncate text-[0.75rem]">{tool.summary}</span>
            <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
              {tool.name}
            </span>
            {tool.durationMs > 0 && (
              <span className="hidden shrink-0 font-mono text-[0.625rem] tabular-nums text-muted-foreground sm:inline">
                {millis(tool.durationMs)}
              </span>
            )}
          </li>
        ))}
      </ol>
      {total > tools.length && (
        <p className="mt-1.5 font-mono text-[0.625rem] text-muted-foreground">
          Showing {tools.length} of {total}.
        </p>
      )}
    </div>
  );
}

/**
 * The validator's own words.
 *
 * `hasErrors` was a boolean over rows that already carried a rule, a message and
 * a path — everything needed to act on the failure — and threw all three away.
 * This describes the user's own generated code, so showing it is both safe and
 * the only way they can fix it.
 */
function IssueList({ issues }: { issues: RunIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <ul className="mt-3 space-y-1">
      {issues.slice(0, 12).map((issue, i) => (
        <li
          key={i}
          className={cn(
            "flex items-start gap-2 rounded-md px-2.5 py-1.5 text-[0.75rem]",
            issue.severity === "error"
              ? "bg-[var(--danger)]/8 text-[var(--danger)]"
              : "bg-[var(--warning)]/8 text-[var(--warning)]",
          )}
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0 flex-1">
            {issue.message}
            {issue.path && (
              <span className="ml-1 font-mono text-[0.6875rem] opacity-80">{issue.path}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function millis(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
