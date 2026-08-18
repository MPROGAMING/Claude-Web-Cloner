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

export function ProjectCard({
  project,
  fileCount,
  studioConnected,
}: {
  project: Project;
  fileCount?: number;
  studioConnected?: boolean;
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
      <div
        className={cn(
          "group lift relative flex flex-col rounded-xl border border-border bg-surface p-5",
          "hover:border-foreground/15",
          archived && "opacity-65",
          pending && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/projects/${project.id}`}
            className="min-w-0 flex-1 rounded-md before:absolute before:inset-0 focus-ember"
          >
            <h3 className="truncate text-[0.9375rem] font-semibold">{project.name}</h3>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={`Actions for ${project.name}`}
                  className="relative z-10 -mr-1 -mt-1 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 focus-ember"
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

        <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[0.8125rem] leading-relaxed text-muted-foreground">
          {project.description || "No description yet."}
        </p>

        <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3.5 font-mono text-[0.625rem] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FileCode2 className="size-3" />
            {fileCount ?? 0}
          </span>
          <span className="truncate">{model.name}</span>
          <span className="ml-auto shrink-0">{relativeTime(project.updated_at)}</span>
          {studioConnected && <StatusDot tone="live" />}
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
