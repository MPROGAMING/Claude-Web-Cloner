import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single empty state used everywhere. Empty states are a product surface,
 * not a fallback — each one names the next action rather than apologising for
 * having nothing to show.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dotgrid opacity-40 [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black,transparent)]"
      />
      <div className="relative mx-auto max-w-sm">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl border border-border bg-surface">
          <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} />
        </span>
        <h3 className="mt-4 text-[0.9375rem] font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
