import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single empty state used everywhere. Empty states are a product surface,
 * not a fallback — each one names the next action rather than apologising for
 * having nothing to show.
 *
 * The ground is Inlet: the lattice pressed in rather than raised, which is the
 * platform's own way of saying "nothing is seated here yet". Everything is
 * driven by tokens, so the same component reads correctly on the page and on a
 * plate without learning which one it is on.
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
        "relative overflow-hidden rounded-xl border border-dashed border-border bg-surface-sunken/40 px-6 py-14 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="stud-plate-inlet pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_58%_58%_at_50%_50%,black,transparent)]"
      />
      {/* Wide enough that the copy sets in two or three lines rather than a
          narrow column stacked in the middle of a large blank socket. */}
      <div className="relative mx-auto max-w-md">
        <span className="mount mx-auto flex size-12 items-center justify-center rounded-xl">
          <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} />
        </span>
        {/* The copy sits on an opaque tile, never on the bare lattice. */}
        <div className="mount mt-5 rounded-xl px-5 py-4">
          <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}
