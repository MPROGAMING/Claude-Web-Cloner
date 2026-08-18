"use client";

import { useMemo, useState } from "react";
import { ChevronRight, FileCode2, FileText, Folder, FolderOpen, Search } from "lucide-react";
import { buildFileTree, type FileTreeNode } from "@/lib/roblox/project-model";
import type { ProjectFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const KIND_COLOR: Record<string, string> = {
  script: "text-[var(--ember)]",
  localscript: "text-[var(--signal)]",
  module: "text-foreground/60",
  ui: "text-[var(--warning)]",
  config: "text-foreground/50",
  doc: "text-muted-foreground",
};

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

  const filtered = useMemo(() => {
    if (!query.trim()) return files;
    const needle = query.trim().toLowerCase();
    return files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [files, query]);

  const tree = useMemo(
    () => buildFileTree(filtered.map((file) => ({ path: file.path, kind: file.kind }))),
    [filtered],
  );

  const toggle = (path: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const renderNodes = (nodes: FileTreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      if (node.type === "dir") {
        // While searching, force everything open so matches are visible.
        const isOpen = query.trim() ? true : !collapsed.has(node.path);
        return (
          <li key={node.path}>
            <button
              type="button"
              onClick={() => toggle(node.path)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[0.75rem] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-ember"
              style={{ paddingLeft: depth * 12 + 6 }}
            >
              <ChevronRight
                className={cn("size-3 shrink-0 transition-transform", isOpen && "rotate-90")}
              />
              {isOpen ? (
                <FolderOpen className="size-3.5 shrink-0" />
              ) : (
                <Folder className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {isOpen && node.children && (
              <ul>{renderNodes(node.children, depth + 1)}</ul>
            )}
          </li>
        );
      }

      const active = node.path === activePath;
      const changed = changedPaths?.has(node.path);
      const Icon = node.kind === "doc" ? FileText : FileCode2;

      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => onSelect(node.path)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[0.75rem] transition-colors focus-ember",
              active
                ? "bg-accent text-foreground"
                : "text-foreground/75 hover:bg-accent/60 hover:text-foreground",
            )}
            style={{ paddingLeft: depth * 12 + 18 }}
          >
            <Icon
              className={cn("size-3.5 shrink-0", KIND_COLOR[node.kind ?? "module"])}
              strokeWidth={1.75}
            />
            <span className="truncate">{node.name}</span>
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
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a file"
            aria-label="Find a file"
            className="h-7 w-full rounded-md border border-border bg-surface-sunken pl-7 pr-2 text-[0.75rem] outline-none placeholder:text-muted-foreground focus-visible:border-[var(--ember)]/50"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {tree.length === 0 ? (
          <p className="px-2 py-6 text-center text-[0.75rem] text-muted-foreground">
            {query ? "No files match." : "No files yet."}
          </p>
        ) : (
          <ul>{renderNodes(tree)}</ul>
        )}
      </div>

      <div className="border-t border-hairline px-3 py-2">
        <p className="font-mono text-[0.625rem] text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
