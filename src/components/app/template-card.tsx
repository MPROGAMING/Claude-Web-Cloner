"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { TemplateArt } from "@/components/marketing/template-art";
import type { Template } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * A template presented as a creation preset rather than a row of text.
 *
 * The art is generated inline (see template-art.tsx), so the card has its final
 * dimensions on first paint — the hover motion is the only thing that moves.
 */
export function TemplateCard({
  template,
  onSelect,
  size = "default",
  priority = false,
  className,
}: {
  template: Template;
  onSelect: () => void;
  size?: "default" | "compact";
  priority?: boolean;
  className?: string;
}) {
  const [accent] = template.accent;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Create a project from the ${template.name} template`}
      className={cn(
        "group/tpl relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface text-left",
        "transition-[transform,border-color,box-shadow] duration-200 ease-out",
        "hover:-translate-y-1 hover:shadow-[var(--shadow-raised)] focus-ember",
        "motion-reduce:hover:translate-y-0",
        className,
      )}
      style={{ ["--tpl-accent" as string]: accent }}
      onMouseEnter={(event) => {
        event.currentTarget.style.borderColor = `color-mix(in oklch, ${accent} 45%, transparent)`;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.borderColor = "";
      }}
    >
      {/* hero */}
      <span
        className={cn(
          "relative block w-full overflow-hidden",
          size === "compact" ? "h-20" : "h-28",
        )}
      >
        <span className="absolute inset-0 transition-transform duration-500 ease-out group-hover/tpl:scale-[1.07] motion-reduce:group-hover/tpl:scale-100">
          <TemplateArt template={template} priority={priority} />
        </span>

        <span
          className="absolute left-2.5 top-2.5 rounded-md border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.1em] backdrop-blur-sm"
          style={{
            // Mixed toward the page ink rather than used raw. The accents are
            // chosen to look right as a gradient, and the darkest of them
            // (horror, oklch 0.5) reads 3.0:1 as 9px text. Mixing keeps each
            // template's hue and lets the theme supply the lightness the label
            // needs.
            color: `color-mix(in oklch, ${accent} 55%, var(--foreground))`,
            borderColor: `color-mix(in oklch, ${accent} 35%, transparent)`,
            backgroundColor: "color-mix(in oklch, var(--background) 62%, transparent)",
          }}
        >
          {template.category}
        </span>

        {template.featured && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md border border-[var(--ember)]/35 bg-background/65 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.1em] text-[var(--ember)] backdrop-blur-sm">
            <Sparkles className="size-2.5" />
            Popular
          </span>
        )}
      </span>

      {/* body */}
      <span className="flex flex-1 flex-col p-4">
        <span className="text-[0.9375rem] font-semibold leading-snug">{template.name}</span>
        <span className="mt-1.5 line-clamp-2 flex-1 text-[0.8125rem] leading-relaxed text-muted-foreground">
          {template.tagline}
        </span>

        <span className="mt-3.5 flex items-center justify-between gap-2 border-t border-hairline pt-3">
          <span className="font-mono text-[0.625rem] text-muted-foreground">
            ~{template.estimatedFiles} files
          </span>
          <span
            className="inline-flex items-center gap-1 text-[0.75rem] font-medium transition-transform duration-200 group-hover/tpl:translate-x-0.5 motion-reduce:group-hover/tpl:translate-x-0"
            style={{ color: accent }}
          >
            Create
            <ArrowRight className="size-3" />
          </span>
        </span>
      </span>
    </button>
  );
}
