"use client";

import { useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { TemplateCard } from "@/components/app/template-card";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { TEMPLATES, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * Filterable template gallery.
 *
 * Selecting a card opens the create dialog pre-seeded with that template, so
 * the path from "that looks like my game" to a running project is two clicks.
 */
export function TemplateGallery({ className }: { className?: string }) {
  const [category, setCategory] = useState<TemplateCategory | "All">("All");
  const [pending, setPending] = useState<string | null>(null);

  const visible = useMemo(
    () => (category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category)),
    [category],
  );

  const categories: (TemplateCategory | "All")[] = ["All", ...TEMPLATE_CATEGORIES];

  return (
    <div className={className}>
      {/* filter rail */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((option) => {
          const active = option === category;
          const count =
            option === "All"
              ? TEMPLATES.length
              : TEMPLATES.filter((t) => t.category === option).length;

          return (
            <button
              key={option}
              type="button"
              onClick={() => setCategory(option)}
              aria-pressed={active}
              className={cn(
                "tap-row inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-medium",
                "transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]",
                active
                  ? "border-[var(--ember)]/45 bg-[var(--ember)]/10 text-[var(--ember-text)]"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {option === "All" && <LayoutGrid className="size-3" />}
              {option}
              <span className="font-mono text-[0.5625rem] opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((template, index) => (
          <TemplateCard
            key={template.slug}
            template={template}
            priority={index < 4}
            onSelect={() => setPending(template.slug)}
          />
        ))}
      </div>

      {/* One dialog instance, re-keyed so it opens with the chosen template. */}
      {pending && (
        <NewProjectDialog
          key={pending}
          defaultTemplate={pending}
          defaultOpen
          onDismiss={() => setPending(null)}
        />
      )}
    </div>
  );
}
