"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, FileCode2, FileText, Search } from "lucide-react";
import { scorePath } from "@/lib/editor/fuzzy";
import type { ProjectFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Go-to-file, on ⌘P.
 *
 * The tree's filter box is for browsing; this is for people who already know
 * the name. Matching is subsequence-based on the whole path, so `srvround`
 * finds `src/server/RoundService.luau` — which is the behaviour that makes a
 * quick-open worth reaching for instead of the tree.
 *
 * ⌘P is the browser's print shortcut, and taking it is a deliberate trade: in a
 * surface that is an editor, go-to-file is the overwhelmingly more likely
 * intent, and print still works from the browser menu.
 */

interface Scored {
  file: ProjectFile;
  score: number;
}

export function FileQuickOpen({
  files,
  onSelect,
}: {
  files: ProjectFile[];
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const scored: Scored[] = files
      .map((file) => ({ file, score: scorePath(file.path, query) }))
      .filter((entry) => entry.score > 0);
    scored.sort((a, b) => b.score - a.score || a.file.path.localeCompare(b.file.path));
    return scored.slice(0, 40).map((entry) => entry.file);
  }, [files, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const pick = (path: string) => {
    close();
    onSelect(path);
  };

  return (
    <div
      role="presentation"
      onClick={close}
      className="fixed inset-0 z-[95] flex items-start justify-center bg-background/70 px-4 pt-[14vh] backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Go to file"
        onClick={(event) => event.stopPropagation()}
        className="animate-pop w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-raised)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                pick(results[active].path);
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            placeholder="Go to file…"
            aria-label="Go to file"
            className="h-12 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[0.8125rem] text-muted-foreground">
              No file matches “{query}”.
            </p>
          ) : (
            results.map((file, index) => {
              const Icon = file.kind === "doc" ? FileText : FileCode2;
              const isActive = index === active;
              const name = file.path.split("/").pop();
              const directory = file.path.slice(0, file.path.length - (name?.length ?? 0));

              return (
                <button
                  key={file.path}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(file.path)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    isActive ? "bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[0.8125rem]">{name}</span>
                    <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                      {directory}
                    </span>
                  </span>
                  {isActive && <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
