import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for every auth screen.
 *
 * The five screens are one object: a part mounted on the plate that the
 * `(auth)` layout paints. Keeping the mount, the field treatment and the
 * pressable submit in one place is what stops sign-in, reset and verification
 * from drifting into three different materials.
 *
 * Two material rules drive the details, and neither is something the contrast
 * audit can see:
 *   - Running text never sits on bare plate. Every word here is on a `.mount`,
 *     which is opaque and occludes the lattice beneath it.
 *   - Anything painted in a semantic colour — an error, a met requirement —
 *     sits in a recessed `bg-surface-sunken` well rather than on the raised
 *     mount face, because the plate's raised tone is only ~4.4:1 behind an
 *     ember or a danger tone and comfortably past 6:1 behind the sunken one.
 */

/**
 * A field, pressed into the tray.
 *
 * `dark:bg-surface-sunken` is not redundant with the plain utility: the base
 * Input carries `dark:bg-input/30`, and a variantless override loses to it in
 * the dark theme, leaving a translucent tile where an inlet belongs.
 */
export const authFieldClass =
  "h-11 rounded-lg border-transparent bg-surface-sunken px-3 shadow-[inset_0_2px_4px_0_rgb(0_0_0/0.4),inset_0_-1px_0_0_rgb(255_255_255/0.06)] dark:border-transparent dark:bg-surface-sunken";

export function AuthCard({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div className="mount land rounded-2xl p-6 sm:p-7">
        {Icon && (
          <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-surface-sunken shadow-[inset_0_2px_5px_0_rgb(0_0_0/0.45),inset_0_-1px_0_0_rgb(255_255_255/0.06)]">
            <Icon className="size-5 text-[var(--ember)]" strokeWidth={1.75} />
          </span>
        )}
        {eyebrow && <p className="label-meta mb-2.5">{eyebrow}</p>}
        <h1 className="text-[1.5rem] uppercase leading-[1.05]">{title}</h1>
        {subtitle && (
          <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        {children}
      </div>

      {footer && (
        <div className="mount land mt-3 rounded-xl px-4 py-3 text-center text-[0.8125rem] text-muted-foreground [--i:1]">
          {footer}
        </div>
      )}
    </div>
  );
}

export function AuthLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded font-medium text-foreground underline decoration-[var(--ember)] decoration-2 underline-offset-4 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11 hover:text-[var(--ember)] focus-ember",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The one loud, obviously pressable control on the surface.
 *
 * A real moulded part with real travel — the nearest competitor's equivalent
 * is grey inside a grey slab and reads as disabled, which is the single most
 * cited flaw in their sign-in. This one is ember, full width, and gets shorter
 * when you push it.
 */
export function AuthSubmit({
  pending,
  pendingLabel,
  children,
  className,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "brick tap-row mb-1.5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3",
        "font-display text-[1rem] font-extrabold uppercase tracking-[0.045em] text-[var(--ember-ink)]",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ember)]",
        "disabled:opacity-75",
        className,
      )}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Inline form error / notice, wired for screen readers. */
export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "notice";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex animate-rise items-start gap-2 rounded-lg border bg-surface-sunken px-3 py-2.5 text-[0.8125rem] leading-relaxed",
        tone === "error"
          ? "border-[var(--danger)]/45 text-[var(--danger-ink)]"
          : "border-[var(--signal)]/45 text-[var(--signal)]",
      )}
    >
      {children}
    </p>
  );
}

/** A quiet aside inside a card — rate limits, expiry, what happens next. */
export function AuthFootnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.75rem] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
