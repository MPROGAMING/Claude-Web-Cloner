"use client";

import { useState } from "react";
import { TemplateCard } from "@/components/app/template-card";
import { NewProjectDialog } from "@/components/app/new-project-dialog";
import { FEATURED_TEMPLATES, TEMPLATES } from "@/lib/templates";

/** The four featured presets, shown on the dashboard as a fast on-ramp. */
export function DashboardTemplates() {
  const [pending, setPending] = useState<string | null>(null);

  const shown = [...FEATURED_TEMPLATES, ...TEMPLATES.filter((t) => !t.featured)].slice(0, 4);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((template, index) => (
          <TemplateCard
            key={template.slug}
            template={template}
            size="compact"
            priority={index < 2}
            onSelect={() => setPending(template.slug)}
          />
        ))}
      </div>

      {pending && (
        <NewProjectDialog
          key={pending}
          defaultTemplate={pending}
          defaultOpen
          onDismiss={() => setPending(null)}
        />
      )}
    </>
  );
}
