import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  Input,
  Label,
  StatusDot,
} from "blockwright";
import { FilePen, FilePlus2, FileX2, TriangleAlert } from "lucide-react";

export const ApplyChangeSet = () => {
  const host = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="min-h-dvh">
      <p className="label-meta">Bloxburg Tycoon</p>
      <h2 className="mt-1 text-2xl font-semibold">Round timer + shop payout</h2>
      <Dialog defaultOpen>
        <DialogPortal container={host}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply 3 changes to Studio?</DialogTitle>
              <DialogDescription>
                Blockwright will write these files into the paired Studio
                session.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken p-2.5 font-mono text-xs">
              <span className="flex items-center gap-2">
                <FilePlus2 className="size-4 shrink-0 text-success" />
                <span className="truncate">RoundTimer.server.luau</span>
              </span>
              <span className="flex items-center gap-2">
                <FilePen className="size-4 shrink-0 text-signal" />
                <span className="truncate">ShopService.server.luau</span>
              </span>
              <span className="flex items-center gap-2">
                <FileX2 className="size-4 shrink-0 text-danger" />
                <span className="truncate">OldTimer.server.luau</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <StatusDot tone="live" />
              Studio connected — Moshe&rsquo;s Mac
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Apply to Studio</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export const DeleteProject = () => {
  const host = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="min-h-dvh">
      <p className="label-meta">Projects</p>
      <h2 className="mt-1 text-2xl font-semibold">Sword Fight Arena</h2>
      <Dialog defaultOpen>
        <DialogPortal container={host}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete &ldquo;Sword Fight Arena&rdquo;?</DialogTitle>
              <DialogDescription>
                This removes the project, its files and its conversations. It
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-2 rounded-lg bg-danger/10 p-2.5 text-[0.8125rem] text-danger-ink">
              <TriangleAlert className="size-4 shrink-0" />
              14 Luau scripts and 2 unapplied change sets go with it.
            </div>
            <DialogFooter>
              <Button variant="outline">Keep it</Button>
              <Button variant="destructive">Delete project</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export const NewProject = () => {
  const host = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="min-h-dvh">
      <p className="label-meta">Dashboard</p>
      <h2 className="mt-1 text-2xl font-semibold">4 projects</h2>
      <Dialog defaultOpen>
        <DialogPortal container={host}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Start empty, or from a template that seeds your first prompt.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ds-new-name">Name</Label>
                <Input id="ds-new-name" defaultValue="Crystal Islands" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ds-new-desc">Description (optional)</Label>
                <Input
                  id="ds-new-desc"
                  defaultValue="A collect-and-sell simulator"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Create project</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};

export const RenameProject = () => {
  const host = React.useRef<HTMLDivElement>(null);
  return (
    <div ref={host} className="min-h-dvh">
      <p className="label-meta">Obby Checkpoints</p>
      <h2 className="mt-1 text-2xl font-semibold">Project settings</h2>
      <Dialog defaultOpen>
        <DialogPortal container={host}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename project</DialogTitle>
              <DialogDescription>Only you can see this name.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="ds-rename">Name</Label>
              <Input id="ds-rename" defaultValue="Obby Checkpoints" />
            </div>
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};
