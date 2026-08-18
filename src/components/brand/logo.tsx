import { cn } from "@/lib/utils";

/**
 * Blockwright mark — an isometric block being drawn: three faces, one of them
 * still "under construction" (the ember stroke). Original artwork; the geometry
 * is generated from a single unit cube projection so it stays crisp at 16px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-7", className)}
    >
      {/* left face */}
      <path
        d="M16 16.6 4.5 10.1v11.4L16 28V16.6Z"
        className="fill-foreground/25"
      />
      {/* right face */}
      <path
        d="M16 16.6 27.5 10.1v11.4L16 28V16.6Z"
        className="fill-foreground/55"
      />
      {/* top face — the ember one */}
      <path
        d="M16 4 27.5 10.1 16 16.6 4.5 10.1 16 4Z"
        className="fill-[var(--ember)]"
      />
      {/* construction edge */}
      <path
        d="M16 16.6V28"
        className="stroke-background/40"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-display text-[0.975rem] font-semibold tracking-[-0.03em]",
        className,
      )}
    >
      Blockwright
    </span>
  );
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {showWordmark && <Wordmark />}
    </span>
  );
}
