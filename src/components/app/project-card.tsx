"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Copy,
  FileCode2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusDot } from "@/components/ui/status-dot";
import { relativeTime } from "@/lib/format";
import { getModelOrDefault } from "@/lib/ai/registry";
import {
  deleteProject,
  duplicateProject,
  renameProject,
  setProjectStatus,
} from "@/lib/actions/projects";
import type { Project } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Stagger classes rather than an inline `style`, so the landing sequence stays
 * inside Tailwind. Anything past the eighth part lands with the eighth — the
 * cascade is there to read as a sequence, not to be counted.
 */
const LAND_DELAY = [
  "[--i:0]",
  "[--i:1]",
  "[--i:2]",
  "[--i:3]",
  "[--i:4]",
  "[--i:5]",
  "[--i:6]",
  "[--i:7]",
] as const;

/**
 * A project, as a moulded part seated on the plate.
 *
 * `.mount` is doing the real work: it is opaque, so it occludes the lattice
 * underneath, and it carries a hard base plus a contact shadow. That pair is
 * what reads as plastic sitting on something rather than a card floating over
 * a texture — and it is also what keeps the title and the description off bare
 * studs, which is the one flaw a blind critic found in the hero.
 *
 * The landing animation lives on an outer wrapper on purpose: `.land` fills
 * `both`, so a finished animation keeps asserting `translateY(0)` and would
 * silently win over the card's own hover lift.
 */
export function ProjectCard({
  project,
  fileCount,
  studioConnected,
  index = 0,
}: {
  project: Project;
  fileCount?: number;
  studioConnected?: boolean;
  index?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(project.name);

  const model = getModelOrDefault(project.model_id);
  const archived = project.status === "archived";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });

  return (
    <>
      <div className={cn("land", LAND_DELAY[Math.min(index, LAND_DELAY.length - 1)])}>
        <div
          className={cn(
            "mount lift group relative flex h-full flex-col rounded-xl p-5",
            archived && "opacity-70",
            pending && "pointer-events-none opacity-50",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="min-w-0 flex-1 rounded-md before:absolute before:inset-0 focus-ember"
            >
              <h3 className="truncate text-[1.0625rem] font-semibold leading-tight">
                {project.name}
              </h3>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={`Actions for ${project.name}`}
                    className="tap-target relative z-10 -mr-1 -mt-1 flex items-center justify-center rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 focus-ember"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-44 min-w-44">
                <DropdownMenuItem
                  render={
                    <button type="button" onClick={() => setRenaming(true)} className="w-full">
                      <Pencil className="size-4" />
                      Rename
                    </button>
                  }
                />
                <DropdownMenuItem
                  render={
                    <button
                      type="button"
                      className="w-full"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await duplicateProject(project.id);
                          if (result.ok && result.data) {
                            toast.success("Project duplicated");
                            router.push(`/projects/${result.data.id}`);
                          } else {
                            toast.error(result.error ?? "Could not duplicate.");
                          }
                        })
                      }
                    >
                      <Copy className="size-4" />
                      Duplicate
                    </button>
                  }
                />
                <DropdownMenuItem
                  render={
                    <button
                      type="button"
                      className="w-full"
                      onClick={() =>
                        run(
                          () => setProjectStatus(project.id, archived ? "active" : "archived"),
                          archived ? "Project restored" : "Project archived",
                        )
                      }
                    >
                      {archived ? (
                        <ArchiveRestore className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                      {archived ? "Restore" : "Archive"}
                    </button>
                  }
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={
                    <button
                      type="button"
                      className="w-full text-[var(--danger)]"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[0.8125rem] leading-relaxed text-muted-foreground">
            {project.description || "No description yet."}
          </p>

          {/*
            Only states worth announcing. "Studio not paired" is true of almost
            every card almost all the time, and a grid that repeats a blocked
            state twelve times is not information — it is wallpaper. Never
            colour alone: the dot always carries the words it means.
          */}
          {(studioConnected || archived) && (
            <p className="mt-3 flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
              <StatusDot tone={studioConnected ? "live" : "idle"} pulse={studioConnected} />
              {studioConnected ? "Studio live" : "Archived"}
            </p>
          )}

          {/* `mt-auto` on the wrapper, so footers line up across a row whose
              cards do not all carry a status line. */}
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-3 border-t border-hairline pt-3.5 font-mono text-[0.625rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <FileCode2 className="size-3" />
                {fileCount ?? 0}
              </span>
              <span className="truncate">{model.name}</span>
              <span className="ml-auto shrink-0">{relativeTime(project.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rename */}
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Only you can see this name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`name-${project.id}`}>Name</Label>
            <Input
              id={`name-${project.id}`}
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setRenaming(false);
                  run(() => renameProject(project.id, name), "Project renamed");
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setRenaming(false);
                run(() => renameProject(project.id, name), "Project renamed");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{project.name}”?</DialogTitle>
            <DialogDescription>
              This removes the project, its files and its conversations. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                run(() => deleteProject(project.id), "Project deleted");
              }}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
