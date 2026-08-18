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
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
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
      <h2 className="mt-3 text-3xl font-bold leading-[1.03] tracking-[-0.03em] sm:text-[2.75rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
