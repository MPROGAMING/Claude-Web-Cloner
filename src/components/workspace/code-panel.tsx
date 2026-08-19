"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/workspace/code-editor";
import { fileIdentity } from "@/components/workspace/file-identity";
import { createFile, saveFile } from "@/lib/actions/files";
import type { ProjectFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Open files, and the editor showing one of them.
 *
 * Drafts are owned by the workspace, not by this component and not by the
 * editor. Two of these are mounted below `xl` — the side panel and the mobile
 * sheet — and unsaved typing has to survive both switching tabs and closing the
 * sheet, which it cannot do if it lives in whichever tree happens to be
 * rendered.
 *
 * Nothing here writes: every save goes through the `saveFile` server action,
 * which re-validates the path and snapshots the previous revision. The panel's
 * job is to know what is open, what is dirty, and what the user is looking at.
 */

export interface DraftState {
  /** Unsaved buffer per path. Absent means "no edit in progress". */
  drafts: Record<string, string>;
  /** Content last written to the server, so dirty is not measured against a stale prop. */
  saved: Record<string, string>;
  onDraftChange: (path: string, content: string) => void;
  onDraftDiscard: (path: string) => void;
  onSaved: (path: string, content: string) => void;
}

export function CodePanel({
  projectId,
  files,
  openPaths,
  activePath,
  onOpen,
  onClosePath,
  onFilesChanged,
  expanded,
  onToggleExpand,
  changedPaths,
  bindKeys = true,
  draftState,
}: {
  projectId: string;
  files: ProjectFile[];
  openPaths: string[];
  activePath?: string;
  onOpen: (path: string) => void;
  onClosePath: (path: string) => void;
  onFilesChanged: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
  changedPaths?: Set<string>;
  /** False for the instance that is currently off-screen, so one keypress moves one tab. */
  bindKeys?: boolean;
  draftState: DraftState;
}) {
  const router = useRouter();
  const { drafts, saved, onDraftChange, onDraftDiscard, onSaved } = draftState;
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("");
  const newPathRef = useRef<HTMLInputElement>(null);

  const byPath = useMemo(() => new Map(files.map((file) => [file.path, file])), [files]);
  const openFiles = useMemo(
    () => openPaths.map((path) => byPath.get(path)).filter((file): file is ProjectFile => Boolean(file)),
    [openPaths, byPath],
  );
  const activeFile = activePath ? byPath.get(activePath) : undefined;

  const baselineFor = useCallback(
    (file: ProjectFile) => saved[file.path] ?? file.content,
    [saved],
  );

  const isDirty = useCallback(
    (path: string) => {
      const file = byPath.get(path);
      if (!file) return false;
      const draft = drafts[path];
      return draft !== undefined && draft !== baselineFor(file);
    },
    [byPath, drafts, baselineFor],
  );

  useEffect(() => {
    if (creating) newPathRef.current?.focus();
  }, [creating]);

  /** Warn before a reload drops unsaved work. Browsers ignore the message text. */
  useEffect(() => {
    if (!bindKeys) return;
    const dirty = openPaths.some(isDirty);
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [openPaths, isDirty, bindKeys]);

  // Alt + arrow steps between tabs. Alt rather than Ctrl/Cmd because every
  // modifier combination with a bare arrow is already spoken for by the OS or
  // by the textarea's own word-wise motion.
  useEffect(() => {
    if (!bindKeys) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.shiftKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (openPaths.length < 2) return;
      event.preventDefault();
      const index = activePath ? openPaths.indexOf(activePath) : 0;
      const next =
        (index + (event.key === "ArrowLeft" ? -1 : 1) + openPaths.length) % openPaths.length;
      onOpen(openPaths[next]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPaths, activePath, onOpen, bindKeys]);

  const save = async (file: ProjectFile) => {
    const draft = drafts[file.path];
    if (draft === undefined) return;

    setSavingPath(file.path);
    const result = await saveFile({
      projectId,
      path: file.path,
      content: draft,
      expectedRevision: file.revision,
    });
    setSavingPath(null);

    if (!result.ok) {
      toast.error(result.error ?? "Could not save that file.");
      return;
    }

    onSaved(file.path, draft);
    toast.success(`Saved ${file.path.split("/").pop()}`);
    onFilesChanged();
    router.refresh();
  };

  const close = (path: string) => {
    if (isDirty(path) && !window.confirm(`${path} has unsaved changes. Close it anyway?`)) return;
    onDraftDiscard(path);
    onClosePath(path);
  };

  const create = async () => {
    const path = newPath.trim();
    if (!path) {
      setCreating(false);
      return;
    }
    const result = await createFile({ projectId, path });
    if (!result.ok) {
      toast.error(result.error ?? "Could not create that file.");
      return;
    }
    setCreating(false);
    setNewPath("");
    toast.success(`Created ${result.data?.path}`);
    onFilesChanged();
    router.refresh();
    if (result.data?.path) onOpen(result.data.path);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-stretch border-b border-hairline bg-surface-sunken">
        <div
          role="tablist"
          aria-label="Open files"
          className="flex min-w-0 flex-1 overflow-x-auto"
        >
          {openFiles.map((file) => {
            const active = file.path === activePath;
            const dirty = isDirty(file.path);
            const Icon = file.kind === "doc" ? FileText : FileCode2;
            // The tab wears the Instance name Studio will show, not the
            // filename; the path stays on the tooltip.
            const identity = fileIdentity(file.path, file.kind);

            return (
              <div
                key={file.path}
                className={cn(
                  "group flex shrink-0 items-center border-r border-hairline",
                  active ? "bg-[var(--plate-raised)]" : "hover:bg-accent/40",
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onOpen(file.path)}
                  title={`${identity.role} · ${file.path}`}
                  className={cn(
                    "tap-row flex max-w-40 items-center gap-1.5 py-1.5 pl-2.5 pr-1 text-[0.6875rem] transition-colors focus-ember",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-3 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{identity.name}</span>
                  {dirty && <span className="text-[var(--ember)]">•</span>}
                  {!dirty && changedPaths?.has(file.path) && (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-[var(--signal)]"
                      aria-label="Changed by the agent this session"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => close(file.path)}
                  aria-label={`Close ${file.path}`}
                  className="mr-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-ember"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="New file"
          title="New file"
          className="tap-target shrink-0 border-l border-hairline px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {creating && (
        <div className="shrink-0 border-b border-hairline px-3 py-2">
          <input
            ref={newPathRef}
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void create();
              if (event.key === "Escape") setCreating(false);
            }}
            placeholder="src/server/Thing.luau"
            aria-label="Path for the new file"
            className="h-8 w-full rounded-md bg-surface-sunken px-2 font-mono text-[0.6875rem] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--ember)]/50"
          />
          <p className="mt-1 font-mono text-[0.5625rem] text-muted-foreground">
            Under src/ or docs/ · .luau .lua .md .json
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {activeFile ? (
          <CodeEditor
            // A new path is a new buffer: search, caret and compare state all
            // belong to the file being edited, not to the panel.
            key={activeFile.path}
            file={activeFile}
            projectId={projectId}
            value={drafts[activeFile.path] ?? activeFile.content}
            baseline={baselineFor(activeFile)}
            dirty={isDirty(activeFile.path)}
            saving={savingPath === activeFile.path}
            onChange={(next) => onDraftChange(activeFile.path, next)}
            onSave={() => void save(activeFile)}
            onDiscard={() => onDraftDiscard(activeFile.path)}
            onClose={() => close(activeFile.path)}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
          />
        ) : (
          <p className="p-6 text-center text-[0.8125rem] text-muted-foreground">
            Nothing open. Pick a piece of the game on the left, or press ⌘P.
          </p>
        )}
      </div>
    </div>
  );
}
