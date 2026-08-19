import { Button } from "blockwright";
import { Plus, Trash2, ArrowRight } from "lucide-react";

// Variant meanings are fixed by docs/DESIGN_SYSTEM.md § Components › Buttons.
export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Build it</Button>
    <Button variant="outline">Preview</Button>
    <Button variant="secondary">Duplicate</Button>
    <Button variant="ghost">Cancel</Button>
    <Button variant="destructive">Delete project</Button>
    <Button variant="link">Read the docs</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button>Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>
      <Plus data-icon="inline-start" />
      New project
    </Button>
    <Button variant="outline">
      Open in Studio
      <ArrowRight data-icon="inline-end" />
    </Button>
    <Button variant="destructive">
      <Trash2 data-icon="inline-start" />
      Delete
    </Button>
  </div>
);

export const IconOnly = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="icon-xs" aria-label="Add">
      <Plus />
    </Button>
    <Button size="icon-sm" variant="outline" aria-label="Add">
      <Plus />
    </Button>
    <Button size="icon" variant="ghost" aria-label="Add">
      <Plus />
    </Button>
    <Button size="icon-lg" variant="secondary" aria-label="Add">
      <Plus />
    </Button>
  </div>
);

export const Disabled = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button disabled>Build it</Button>
    <Button variant="outline" disabled>
      Preview
    </Button>
    <Button variant="destructive" disabled>
      Delete project
    </Button>
  </div>
);
