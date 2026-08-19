import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16", className)}>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-14">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Heading = "h2",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  /**
   * The heading level. h2 is right on a page whose hero already owns the h1,
   * which is every page except the ones built entirely out of Sections —
   * /pricing had no h1 at all and started at h2, so its outline began mid-air.
   */
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {/*
        The eyebrow was a mono all-caps letterspaced label on every section —
        the most worn-out device in developer-tool marketing, and six of them
        made the page read as a template. It survives as a small stud-marked
        tag: same job, drawn from the product's own material rather than from
        the house style of every other dark landing page.
      */}
      <span
        className={cn(
          "inline-flex items-center gap-2 text-[0.8125rem] font-semibold text-[var(--ember)]",
          align === "center" && "justify-center",
        )}
      >
        <span aria-hidden className="size-1.5 rounded-[2px] bg-[var(--ember)]" />
        {eyebrow}
      </span>
      <Heading className="mt-2.5 text-[1.75rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[2.25rem]">
        {title}
      </Heading>
      {description && (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
