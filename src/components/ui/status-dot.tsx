import { cn } from "@/lib/utils";

/**
 * The one status indicator used everywhere: Studio connection, project state,
 * command results. A single component keeps the semantics of each colour
 * consistent across the product.
 */
const TONE = {
  live: "bg-[var(--signal)]",
  active: "bg-[var(--success)]",
  idle: "bg-muted-foreground/50",
  working: "bg-[var(--ember)]",
  error: "bg-[var(--danger)]",
} as const;

export type StatusTone = keyof typeof TONE;

export function StatusDot({
  tone = "idle",
  pulse = false,
  className,
}: {
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            TONE[tone],
          )}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", TONE[tone])} />
    </span>
  );
}
