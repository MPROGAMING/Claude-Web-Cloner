import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for every auth screen, so sign-in, reset and verification all
 * share one visual language rather than drifting apart as they get added.
 */
export function AuthCard({
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-sm animate-rise", className)}>
      <div className="rounded-xl border border-border bg-surface p-7 shadow-[var(--shadow-raised)] sm:p-8">
        {Icon && (
          <span className="mb-5 flex size-10 items-center justify-center rounded-xl border border-[var(--ember)]/30 bg-[var(--ember)]/10">
            <Icon className="size-5 text-[var(--ember)]" strokeWidth={1.75} />
          </span>
        )}
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        {children}
      </div>
      {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded text-foreground underline-offset-4 transition-colors hover:underline focus-ember"
    >
      {children}
    </Link>
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
        "flex animate-rise items-start gap-2 rounded-lg border px-3 py-2.5 text-[0.8125rem]",
        tone === "error"
          ? "border-[var(--danger)]/30 bg-[var(--danger)]/8 text-[var(--danger)]"
          : "border-[var(--signal)]/30 bg-[var(--signal)]/8 text-[var(--signal)]",
      )}
    >
      {children}
    </p>
  );
}
