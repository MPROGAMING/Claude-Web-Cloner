import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  FilePen,
  FileX2,
  ListChecks,
  Plug2,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { relativeTime } from "@/lib/format";
import type { ActivityEvent } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Activity is stored as `kind` + human summary. The icon map is the only place
 * that knows what a kind looks like, so adding a new event type is one line.
 */
const ICONS: Record<string, { icon: LucideIcon; className: string }> = {
  "project.created": { icon: Sparkles, className: "text-[var(--ember)]" },
  plan: { icon: ListChecks, className: "text-[var(--ember)]" },
  "file.created": { icon: FilePlus2, className: "text-[var(--success)]" },
  "file.updated": { icon: FilePen, className: "text-[var(--signal)]" },
  "file.deleted": { icon: FileX2, className: "text-[var(--danger)]" },
  "file.read": { icon: FilePen, className: "text-muted-foreground" },
  validation: { icon: CheckCircle2, className: "text-[var(--success)]" },
  "studio.connected": { icon: Plug2, className: "text-[var(--signal)]" },
  "studio.queued": { icon: Plug2, className: "text-muted-foreground" },
  "studio.succeeded": { icon: CheckCircle2, className: "text-[var(--success)]" },
  "studio.failed": { icon: AlertTriangle, className: "text-[var(--danger)]" },
};

function iconFor(kind: string) {
  return ICONS[kind] ?? { icon: Sparkles, className: "text-muted-foreground" };
}

export function ActivityTimeline({
  events,
  compact = false,
  className,
}: {
  events: ActivityEvent[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((event, index) => {
        const { icon: Icon, className: iconClass } = iconFor(event.kind);
        const last = index === events.length - 1;

        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute left-[0.6875rem] top-6 h-[calc(100%-1rem)] w-px bg-border"
              />
            )}
            <span className="relative z-10 mt-0.5 flex size-[1.375rem] shrink-0 items-center justify-center rounded-full border border-border bg-surface">
              <Icon className={cn("size-3", iconClass)} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate", compact ? "text-[0.8125rem]" : "text-sm")}>
                {event.summary}
              </p>
              <p className="mt-0.5 font-mono text-[0.625rem] text-muted-foreground">
                {relativeTime(event.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
