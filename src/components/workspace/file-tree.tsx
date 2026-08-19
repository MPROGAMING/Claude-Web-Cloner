"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight, FileCode2, FileText, Folder, FolderOpen, Search } from "lucide-react";
import { buildFileTree, type FileTreeNode } from "@/lib/roblox/project-model";
import {
  ROLE_TINT,
  fileIdentity,
  folderIdentity,
  folderRank,
} from "@/components/workspace/file-identity";
import type { ProjectFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * The parts of the game, and where each one runs.
 *
 * It is a tree over the same paths it has always been over — but a path is a
 * developer's name for a file. What a creator needs to know is that this is
 * the Server, that is the Client, and the thing inside is called RoundService.
 * So `src` (a folder that exists for the file system, not for the game) is
 * lifted away, the remaining folders take the names `PROJECT_LAYOUT` already
 * gives them, and every leaf reads as the Instance name Studio will show.
 * Paths are preserved on every row's `title` and in the editor header; they
 * are demoted, never hidden.
 *
 * Keyboard behaviour follows the ARIA tree pattern rather than tab-through-
 * everything: one tab stop for the whole tree, arrows to move, Left/Right to
 * collapse and expand. A tree with fifty tab stops in front of the editor is
 * the reason people stop using the keyboard.
 */

/** A node as it appears on screen, flattened so the arrow keys have an order. */
interface VisibleNode {
  node: FileTreeNode;
  depth: number;
  open?: boolean;
}

export function FileTree({
  files,
  activePath,
  onSelect,
  changedPaths,
}: {
  files: ProjectFile[];
  activePath?: string;
  onSelect: (path: string) => void;
  changedPaths?: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusPath, setFocusPath] = useState<string | undefined>(activePath);
  const treeRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const needle = query.trim().toLowerCase();
    return files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [files, query]);

  const tree = useMemo(
    () => buildFileTree(filtered.map((file) => ({ path: file.path, kind: file.kind }))),
    [filtered],
  );

  /**
   * The tree as a creator reads it: `src` lifted out, and the top level in the
   * order the game is built in — server first, notes last — rather than
   * alphabetically. Only labels and order change; every `path` is untouched,
   * so selection, focus and the keyboard walk all still key on the real file.
   */
  const display = useMemo(() => {
    const roots: FileTreeNode[] = [];
    for (const node of tree) {
      if (node.type === "dir" && node.path === "src" && node.children) roots.push(...node.children);
      else roots.push(node);
    }
    return roots.sort((a, b) => {
      const byLayout = folderRank(a.path) - folderRank(b.path);
      return byLayout !== 0 ? byLayout : a.path.localeCompare(b.path);
    });
  }, [tree]);

  const searching = query.trim().length > 0;

  // While searching, everything is forced open so matches are visible.
  const isOpen = (path: string) => searching || !collapsed.has(path);

  const visible = useMemo(() => {
    const rows: VisibleNode[] = [];
    const walk = (nodes: FileTreeNode[], depth: number) => {
      for (const node of nodes) {
        if (node.type === "dir") {
          const open = searching || !collapsed.has(node.path);
          rows.push({ node, depth, open });
          if (open && node.children) walk(node.children, depth + 1);
        } else {
          rows.push({ node, depth });
        }
      }
    };
    walk(display, 0);
    return rows;
  }, [display, collapsed, searching]);

  const cursor = focusPath ?? activePath ?? visible[0]?.node.path;

  const toggle = (path: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const focusRow = (path: string) => {
    setFocusPath(path);
    // The roving tabindex has not moved yet, so address the row by its path.
    treeRef.current
      ?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)
      ?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const index = visible.findIndex((row) => row.node.path === cursor);
    if (index === -1) return;
    const row = visible[index];

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (index + 1 < visible.length) focusRow(visible[index + 1].node.path);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (index > 0) focusRow(visible[index - 1].node.path);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.node.type === "dir" && !row.open) toggle(row.node.path);
        else if (index + 1 < visible.length) focusRow(visible[index + 1].node.path);
        break;
      case "ArrowLeft": {
        event.preventDefault();
        if (row.node.type === "dir" && row.open) {
          toggle(row.node.path);
          break;
        }
        // Otherwise step out to the containing folder.
        const parent = [...visible.slice(0, index)]
          .reverse()
          .find((candidate) => candidate.depth < row.depth);
        if (parent) focusRow(parent.node.path);
        break;
      }
      case "Home":
        event.preventDefault();
        if (visible[0]) focusRow(visible[0].node.path);
        break;
      case "End":
        event.preventDefault();
        if (visible.length) focusRow(visible[visible.length - 1].node.path);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (row.node.type === "dir") toggle(row.node.path);
        else onSelect(row.node.path);
        break;
      default:
        break;
    }
  };

  const renderNodes = (nodes: FileTreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const focused = node.path === cursor;

      if (node.type === "dir") {
        const open = isOpen(node.path);
        const folder = folderIdentity(node.path);
        return (
          <li key={node.path} role="none">
            <button
              type="button"
              role="treeitem"
              data-path={node.path}
              tabIndex={focused ? 0 : -1}
              onClick={() => {
                setFocusPath(node.path);
                toggle(node.path);
              }}
              aria-expanded={open}
              aria-level={depth + 1}
              // A folder is never the open file; the attribute is required on
              // every treeitem, so it says so explicitly.
              aria-selected={false}
              title={folder.blurb ? `${node.path} — ${folder.blurb}` : node.path}
              className={cn(
                "tap-row flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left transition-colors hover:bg-accent/60 hover:text-foreground focus-ember",
                depth === 0
                  ? "text-[0.75rem] font-semibold text-foreground/80"
                  : "text-[0.75rem] text-muted-foreground",
              )}
              style={{ paddingLeft: depth * 12 + 6 }}
            >
              <ChevronRight
                className={cn("size-3 shrink-0 transition-transform", open && "rotate-90")}
              />
              {open ? (
                <FolderOpen className="size-3.5 shrink-0" />
              ) : (
                <Folder className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{folder.label}</span>
            </button>
            {open && node.children && <ul role="group">{renderNodes(node.children, depth + 1)}</ul>}
          </li>
        );
      }

      const active = node.path === activePath;
      const changed = changedPaths?.has(node.path);
      const Icon = node.kind === "doc" ? FileText : FileCode2;
      const identity = fileIdentity(node.path, node.kind);

      return (
        <li key={node.path} role="none">
          <button
            type="button"
            role="treeitem"
            data-path={node.path}
            tabIndex={focused ? 0 : -1}
            aria-level={depth + 1}
            aria-selected={active}
            onClick={() => {
              setFocusPath(node.path);
              onSelect(node.path);
            }}
            // The role and the real path stay one hover away; the name leads.
            title={`${identity.role} · ${node.path}`}
            className={cn(
              "tap-row flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[0.75rem] transition-colors focus-ember",
              active
                ? "bg-accent text-foreground"
                : "text-foreground/75 hover:bg-accent/60 hover:text-foreground",
            )}
            style={{ paddingLeft: depth * 12 + 18 }}
          >
            <Icon
              className={cn("size-3.5 shrink-0", ROLE_TINT[node.kind ?? "module"])}
              strokeWidth={1.75}
            />
            <span className="truncate">{identity.name}</span>
            {changed && (
              <span
                className="ml-auto size-1.5 shrink-0 rounded-full bg-[var(--ember)]"
                aria-label="Changed in this session"
              />
            )}
          </button>
        </li>
      );
    });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline p-2">
        <p className="label-meta mb-2 px-1">Your game</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // Enter in the filter opens the single remaining match, which is
              // the whole point of typing a filter that narrows to one file.
              if (event.key !== "Enter") return;
              const only = visible.filter((row) => row.node.type === "file");
              if (only.length >= 1) {
                event.preventDefault();
                onSelect(only[0].node.path);
              }
            }}
            placeholder="Find a script or note"
            aria-label="Find a script or note"
            className="h-8 w-full rounded-md bg-surface-sunken pl-7 pr-2 text-[0.75rem] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-[var(--ember)]/50"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {display.length === 0 ? (
          <p className="px-2 py-6 text-center text-[0.75rem] text-muted-foreground">
            {query ? "Nothing matches that." : "Nothing built yet. Describe a mechanic to start."}
          </p>
        ) : (
          <ul ref={treeRef} role="tree" aria-label="The parts of your game" onKeyDown={onKeyDown}>
            {renderNodes(display)}
          </ul>
        )}
      </div>

      {/* Only claim this once there is something to open. */}
      {files.length > 0 && (
        <div className="border-t border-hairline px-3 py-2">
          <p className="text-[0.6875rem] leading-snug text-muted-foreground">
            Every script here is real Luau. Open it, read it, change it.
          </p>
        </div>
      )}
    </div>
  );
}
