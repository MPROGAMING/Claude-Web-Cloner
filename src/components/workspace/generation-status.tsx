"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  Check,
  FileCheck2,
  FilePlus2,
  FilePen,
  ListChecks,
  Loader2,
  Plug2,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StatusData } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * The live generation rail.
 *
 * Every line corresponds to a tool that actually executed — there is no
 * synthetic progress anywhere in this component. Before the first tool call we
 * say "Understanding your request", because that is genuinely what is happening
 * (the model is streaming its opening reasoning), and we do not pretend to know
 * which step comes next.
 */

/** Maps a real activity kind to how it reads in the rail. */
const STEP: Record<string, { icon: LucideIcon; tint: string }> = {
  plan: { icon: ListChecks, tint: "text-[var(--ember)]" },
  "file.read": { icon: ScanSearch, tint: "text-muted-foreground" },
  "file.created": { icon: FilePlus2, tint: "text-[var(--success)]" },
  "file.updated": { icon: FilePen, tint: "text-[var(--signal)]" },
  "file.deleted": { icon: AlertTriangle, tint: "text-[var(--danger)]" },
  validation: { icon: ShieldCheck, tint: "text-[var(--success)]" },
  "studio.queued": { icon: Plug2, tint: "text-[var(--signal)]" },
};

function stepFor(id: string) {
  const kind = id.replace(/-\d+$/, "");
  return STEP[kind] ?? { icon: FileCheck2, tint: "text-[var(--success)]" };
}

/** What the agent is doing right now, inferred only from what has happened. */
function activeLabel(statuses: StatusData[]): string {
  if (statuses.length === 0) return "Understanding your request";
  const last = statuses[statuses.length - 1]!.id;
  if (last.startsWith("plan")) return "Preparing files";
  if (last.startsWith("file.read")) return "Reading the project";
  if (last.startsWith("file.")) return "Writing code";
  if (last.startsWith("validation")) return "Checking scripts";
  if (last.startsWith("studio")) return "Applying changes in Studio";
  return "Working";
}

export function GenerationStatus({
  statuses,
  active,
  className,
}: {
  statuses: StatusData[];
  active: boolean;
  className?: string;
}) {
  const recent = useMemo(() => statuses.slice(-7), [statuses]);

  if (!active && statuses.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Generation progress"
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-surface-sunken/70 px-3.5 py-3",
        className,
      )}
    >
      {/* A single sweep across the top edge marks "still working" without
          animating the whole panel. */}
      {active && (
        <span aria-hidden className="absolute inset-x-0 top-0 h-px overflow-hidden">
          <span className="block h-px w-1/3 animate-sweep bg-gradient-to-r from-transparent via-[var(--ember)] to-transparent" />
        </span>
      )}

      <ol className="space-y-1.5">
        {recent.map((status, index) => {
          const { icon: Icon, tint } = stepFor(status.id);
          return (
            <li
              key={status.id}
              className="flex animate-slide-in items-center gap-2 text-[0.75rem] text-muted-foreground"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <Icon className={cn("size-3 shrink-0", tint)} strokeWidth={2.2} />
              <span className="truncate">{status.label}</span>
            </li>
          );
        })}

        {active && (
          <li className="flex items-center gap-2 text-[0.75rem] font-medium text-foreground">
            <Loader2 className="size-3 shrink-0 animate-spin text-[var(--ember)]" />
            <span>{activeLabel(statuses)}</span>
            <span className="ml-0.5 flex gap-0.5" aria-hidden>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1 animate-breathe rounded-full bg-[var(--ember)]"
                  style={{ animationDelay: `${dot * 180}ms` }}
                />
              ))}
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}

/**
 * Post-run summary. Counts come from the artifact parts the server actually
 * streamed, so this cannot claim a file was written that was not.
 */
export function GenerationSummary({
  created,
  updated,
  deleted,
  className,
}: {
  created: number;
  updated: number;
  deleted: number;
  className?: string;
}) {
  const total = created + updated + deleted;
  if (total === 0) return null;

  const parts = [
    { label: "created", value: created, tint: "text-[var(--success)]" },
    { label: "modified", value: updated, tint: "text-[var(--signal)]" },
    { label: "deleted", value: deleted, tint: "text-[var(--danger)]" },
  ].filter((part) => part.value > 0);

  return (
    <div
      className={cn(
        "flex animate-rise flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-hairline bg-surface-sunken/60 px-3 py-2",
        className,
      )}
    >
      <Check className="size-3.5 shrink-0 text-[var(--success)]" strokeWidth={2.5} />
      {parts.map((part) => (
        <span key={part.label} className="text-[0.75rem] text-muted-foreground">
          <span className={cn("font-mono font-semibold", part.tint)}>{part.value}</span>{" "}
          {part.label}
        </span>
      ))}
    </div>
  );
}
