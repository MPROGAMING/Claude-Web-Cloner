"use client";

import { useState, useTransition } from "react";
import { INTENT_KEY } from "@/components/marketing/hero-composer";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/lib/actions/projects";

/**
 * Project creation.
 *
 * A name and, optionally, the idea itself. The idea becomes the project's
 * description and seeds the composer on the next screen, where the agent turns
 * it into real files — nothing is pre-written here.
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
  defaultOpen = false,
  adoptIntent = false,
  idea,
  onDismiss,
}: {
  /** Base UI composes via `render`, which needs a single element, not ReactNode. */
  trigger?: React.ReactElement;
  /** Lets a caller open the dialog directly rather than from a trigger. */
  defaultOpen?: boolean;
  /** Pick up an idea typed on the landing page and pre-fill from it. */
  adoptIntent?: boolean;
  /**
   * An idea handed straight in — the dashboard composer, which already holds a
   * real sentence when the button is pressed. Read once at mount, so the caller
   * mounts this component at press time rather than keeping it alive and
   * expecting the fields to track its state.
   */
  idea?: string;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  /**
   * Adopt the idea typed on the landing page.
   *
   * Read once and cleared, so a refresh or a later visit does not resurrect an
   * idea the user has moved on from. Lazy initial state rather than an effect:
   * the value is known at first render, and writing it in an effect would be a
   * derived-state write the React Compiler rejects.
   */
  const [intent] = useState(() => {
    if (idea) return idea;
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

  const submit = () => {
    const formData = new FormData();
    formData.set("name", name.trim() || "Untitled project");
    if (description.trim()) formData.set("description", description.trim());

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
      <DialogContent className="max-h-[88dvh] gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Name it, then tell the AI what you want to make.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
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
            <Label htmlFor="project-description">The mechanic (optional)</Label>
            <Textarea
              id="project-description"
              rows={3}
              value={description}
              maxLength={500}
              placeholder="Coins scattered around the map that disappear when someone grabs one and reappear eight seconds later."
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="font-mono text-[0.6875rem] text-muted-foreground">
              This becomes the first thing the agent plans against.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
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
