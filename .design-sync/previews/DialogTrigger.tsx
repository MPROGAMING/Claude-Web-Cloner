import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "blockwright";
import { Trash2, Plus } from "lucide-react";

// The other Dialog cells are held open to show the surface, so DialogTrigger is
// the one place the closed trigger itself is the subject. `render` is how Base UI
// composes the trigger onto a real control — never asChild.
const Demo = ({
  trigger,
  title,
  description,
  confirm,
  destructive,
}: {
  trigger: React.ReactElement;
  title: string;
  description: string;
  confirm: string;
  destructive?: boolean;
}) => {
  const host = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="min-h-72">
      <Dialog>
        <DialogTrigger render={trigger} />
        <DialogPortal container={host}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button variant={destructive ? "destructive" : "default"}>{confirm}</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export const OnAPrimaryButton = () => (
  <Demo
    trigger={
      <Button>
        <Plus data-icon="inline-start" />
        New project
      </Button>
    }
    title="New project"
    description="Start empty, or from a template that seeds your first prompt."
    confirm="Create project"
  />
);

export const OnADestructiveButton = () => (
  <Demo
    trigger={
      <Button variant="destructive">
        <Trash2 data-icon="inline-start" />
        Delete project
      </Button>
    }
    title="Delete “Sword Fight Arena”?"
    description="This removes the project, its files and its conversations."
    confirm="Delete project"
    destructive
  />
);

export const OnAGhostIconButton = () => (
  <Demo
    trigger={
      <Button size="icon-sm" variant="ghost" aria-label="Delete change set">
        <Trash2 />
      </Button>
    }
    title="Discard change set 14?"
    description="Three unapplied files go with it."
    confirm="Discard"
    destructive
  />
);
