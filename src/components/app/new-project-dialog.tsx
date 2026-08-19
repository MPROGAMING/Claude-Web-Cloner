"use client";

import { useState, useTransition } from "react";
import { INTENT_KEY } from "@/components/marketing/hero-composer";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATES } from "@/lib/templates";
import { TemplateArt } from "@/components/marketing/template-art";
import { createProject } from "@/lib/actions/projects";
import { cn } from "@/lib/utils";

/**
 * Project creation. Picking a template pre-fills the name and description and
 * seeds the composer with the template's prompt on the next screen — the
 * template never writes files itself, the agent does.
 */
/** "Make a tycoon where players buy droppers" -> "Tycoon Where Players Buy Droppers" */
function deriveProjectName(idea: string): string {
  const cleaned = idea
    // Strip the request framing and any leading article, whether or not a verb
    // was used: "make me a tycoon…" and "a tycoon…" should both name "Tycoon…".
    .replace(/^\s*(make|build|create|i want|i'd like|give me)\s+(me\s+)?/i, "")
    .replace(/^\s*(a|an|the)\s+/i, "")
    .split(/[.!?\n]/)[0]
    .trim();

  const words = cleaned.split(/\s+/).slice(0, 6).join(" ");
  return words
    ? words.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60)
    : "New project";
}

export function NewProjectDialog({
  trigger,
  defaultTemplate,
  defaultOpen = false,
  adoptIntent = false,
  onDismiss,
}: {
  /** Base UI composes via `render`, which needs a single element, not ReactNode. */
  trigger?: React.ReactElement;
  defaultTemplate?: string;
  /** Used by the gallery, which opens the dialog from a card rather than a trigger. */
  defaultOpen?: boolean;
  /** Pick up an idea typed on the landing page and pre-fill from it. */
  adoptIntent?: boolean;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [templateSlug, setTemplateSlug] = useState<string | undefined>(defaultTemplate);
  /**
   * Adopt the idea typed on the landing page.
   *
   * Read once and cleared, so a refresh or a later visit does not resurrect an
   * idea the user has moved on from. Lazy initial state rather than an effect:
   * the value is known at first render, and writing it in an effect would be a
   * derived-state write the React Compiler rejects.
   */
  const [intent] = useState(() => {
    if (!adoptIntent || typeof window === "undefined") return "";
    try {
      const stored = window.sessionStorage.getItem(INTENT_KEY) ?? "";
      if (stored) window.sessionStorage.removeItem(INTENT_KEY);
      return stored;
    } catch {
      return "";
    }
  });

  // A first-line summary makes a usable project name; the full idea is the
  // description, and the workspace seeds the first prompt from it.
  const [name, setName] = useState(() => (intent ? deriveProjectName(intent) : ""));
  const [description, setDescription] = useState(intent);
  const [pending, startTransition] = useTransition();


  const selectTemplate = (slug: string | undefined) => {
    setTemplateSlug(slug);
    const template = TEMPLATES.find((t) => t.slug === slug);
    if (template) {
      if (!name.trim()) setName(template.name);
      setDescription(template.tagline);
    }
  };

  const submit = () => {
    const formData = new FormData();
    formData.set("name", name.trim() || "Untitled project");
    if (description.trim()) formData.set("description", description.trim());
    if (templateSlug) formData.set("templateSlug", templateSlug);

    startTransition(async () => {
      const result = await createProject(formData);
      // createProject redirects on success, so reaching here means it failed.
      if (result && !result.ok) toast.error(result.error ?? "Could not create the project.");
    });
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) onDismiss?.();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      {!defaultOpen && (
        <DialogTrigger
          render={
            trigger ?? (
              <Button>
                <Plus className="size-4" />
                New project
              </Button>
            )
          }
        />
      )}
      <DialogContent className="max-h-[88dvh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Start empty, or from a template that seeds your first prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={name}
                maxLength={80}
                placeholder="Crystal Islands"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Input
                id="project-description"
                value={description}
                maxLength={500}
                placeholder="A collect-and-sell simulator"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2.5 block">Starting point</Label>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => selectTemplate(undefined)}
                aria-pressed={!templateSlug}
                className={cn(
                  "flex flex-col justify-between rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 focus-ember",
                  !templateSlug
                    ? "border-[var(--ember)]/50 bg-[var(--ember)]/6"
                    : "border-border hover:border-foreground/20 hover:bg-accent/50",
                )}
              >
                <Sparkles className="size-4 text-[var(--ember)]" />
                <span className="mt-3 block text-[0.8125rem] font-semibold">Blank project</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  Describe anything you like.
                </span>
              </button>

              {TEMPLATES.map((template) => {
                const active = templateSlug === template.slug;
                return (
                  <button
                    key={template.slug}
                    type="button"
                    onClick={() => selectTemplate(template.slug)}
                    aria-pressed={active}
                    className={cn(
                      "group/pick overflow-hidden rounded-xl border text-left transition-[border-color,transform] duration-150 hover:-translate-y-0.5 focus-ember",
                      active
                        ? "border-[var(--ember)]/60 ring-2 ring-[var(--ember)]/25"
                        : "border-border hover:border-foreground/20",
                    )}
                  >
                    <span className="relative block h-14 overflow-hidden">
                      <span className="absolute inset-0 transition-transform duration-500 group-hover/pick:scale-110 motion-reduce:group-hover/pick:scale-100">
                        <TemplateArt template={template} priority />
                      </span>
                      {active && (
                        <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--ember)]">
                          <Check className="size-2.5 text-[var(--ember-ink)]" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="block p-2.5">
                      <span className="block truncate text-[0.75rem] font-semibold">
                        {template.name}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
                        {template.category}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
