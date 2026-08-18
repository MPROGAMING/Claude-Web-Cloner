import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { TemplateArt } from "@/components/marketing/template-art";
import { TEMPLATES } from "@/lib/templates";
import { cn } from "@/lib/utils";

export function TemplateStrip({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {TEMPLATES.slice(0, 8).map((template, index) => {
        const [accent] = template.accent;
        return (
          <Link
            key={template.slug}
            href="/sign-up"
            aria-label={`Start from the ${template.name} template`}
            className="group/tpl flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[var(--shadow-raised)] focus-ember motion-reduce:hover:translate-y-0"
          >
            <span className="relative block h-24 overflow-hidden">
              <span className="absolute inset-0 transition-transform duration-500 ease-out group-hover/tpl:scale-[1.07] motion-reduce:group-hover/tpl:scale-100">
                <TemplateArt template={template} priority={index < 4} />
              </span>
              <span
                className="absolute left-2.5 top-2.5 rounded-md border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.1em] backdrop-blur-sm"
                style={{
                  color: accent,
                  borderColor: `color-mix(in oklch, ${accent} 35%, transparent)`,
                  backgroundColor: "color-mix(in oklch, var(--background) 62%, transparent)",
                }}
              >
                {template.category}
              </span>
              {template.featured && (
                <Sparkles className="absolute right-2.5 top-2.5 size-3 text-[var(--ember)]" />
              )}
            </span>

            <span className="flex flex-1 flex-col p-4">
              <span className="text-[0.9375rem] font-semibold leading-snug">{template.name}</span>
              <span className="mt-1.5 flex-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
                {template.tagline}
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-[0.75rem] font-medium text-muted-foreground transition-colors group-hover/tpl:text-foreground">
                Start here
                <ArrowRight className="size-3 transition-transform duration-200 group-hover/tpl:translate-x-0.5" />
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
