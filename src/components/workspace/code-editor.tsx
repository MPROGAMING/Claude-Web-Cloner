"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Search,
  SplitSquareHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/format";
import { validateLuau } from "@/lib/roblox/luau-validator";
import { highlightLines } from "@/lib/roblox/luau-highlight";
import { revertFile } from "@/lib/actions/projects";
import { DiffView, type DiffMode } from "@/components/workspace/diff-view";
import { diffLines } from "@/lib/diff";
import type { ProjectFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import {
  applyComment,
  applyEnter,
  applyMoveLines,
  applyTab,
  autoDedent,
  caretPosition,
  type EditResult,
} from "@/lib/editor/luau-editing";

/**
 * The file surface: read, edit, and compare.
 *
 * A transparent textarea over a highlighted layer, rather than a code-editor
 * dependency. Measured, not assumed: the whole mini-IDE — this file, the diff,
 * the tokeniser, the edit rules, tabs and go-to-file — adds 10.1 KB gzipped to
 * the client bundle. CodeMirror 6 is 125.6 KB gzipped before a Lua grammar,
 * Monaco 852 KB plus a 44 KB icon font. What that budget buys is a language
 * server, multiple cursors and a virtualised viewport; this app has no Luau LSP
 * and no files over 200 KB, because the write path enforces that ceiling.
 *
 * The layers are the whole trick: everything that paints — line tints, syntax
 * colour, the caret — carries `.code-type`, so the characters land in the same
 * places in every layer. Any divergence in font, size, line height or ligatures
 * shows up immediately as text that drifts out from under its own highlight.
 */

const CONTEXT_LINES = 3;

export function CodeEditor({
  file,
  projectId,
  value,
  baseline,
  dirty,
  saving,
  onChange,
  onSave,
  onDiscard,
  onClose,
  expanded,
  onToggleExpand,
}: {
  file: ProjectFile;
  projectId: string;
  value: string;
  /** The content currently stored on the server — what an edit is measured against. */
  baseline: string;
  dirty: boolean;
  saving: boolean;
  onChange: (next: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  onClose?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [caret, setCaret] = useState({ line: 1, column: 1 });
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [diffMode, setDiffMode] = useState<DiffMode>("inline");
  const [previous, setPrevious] = useState<{ revision: number; content: string } | null>(null);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  /** Selection to install after the next controlled re-render. */
  const pendingSelection = useRef<[number, number] | null>(null);
  /** The line auto-dedent last touched, so `else` → `elseif` does not dedent twice. */
  const dedentedLine = useRef<number | null>(null);

  const lines = useMemo(() => value.split("\n"), [value]);
  const highlighted = useMemo(() => highlightLines(value, file.path), [value, file.path]);
  const isLuau = /\.luau?$/i.test(file.path);

  const diagnostics = useMemo(
    () => (isLuau ? validateLuau(value, file.path) : null),
    [value, file.path, isLuau],
  );

  const severityByLine = useMemo(() => {
    const map = new Map<number, "error" | "warning">();
    for (const diagnostic of diagnostics?.diagnostics ?? []) {
      // An error on a line outranks a warning on the same line.
      if (map.get(diagnostic.line) === "error") continue;
      map.set(diagnostic.line, diagnostic.severity);
    }
    return map;
  }, [diagnostics]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const found: number[] = [];
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) found.push(index);
    });
    return found;
  }, [lines, query]);

  const matchedLines = useMemo(() => new Set(matches), [matches]);
  const activeMatch = matches.length ? matches[matchIndex % matches.length] : null;

  const draftDiff = useMemo(
    () => (dirty ? diffLines(baseline, value, 0) : null),
    [dirty, baseline, value],
  );

  /** Put the caret on a line and bring it into view. */
  const goToLine = useCallback(
    (lineIndex: number, select?: { from: number; to: number }) => {
      const textarea = textareaRef.current;
      const scroller = scrollRef.current;
      const code = codeRef.current;
      if (!textarea || !scroller || !code) return;

      const offset = lines.slice(0, lineIndex).reduce((sum, line) => sum + line.length + 1, 0);
      const from = offset + (select?.from ?? 0);
      const to = offset + (select?.to ?? lines[lineIndex]?.length ?? 0);
      textarea.focus();
      textarea.setSelectionRange(from, to);
      setCaret({ line: lineIndex + 1, column: (select?.from ?? 0) + 1 });

      // Measured rather than assumed: the line box is whatever the rendered
      // font produces, and a hardcoded pixel height drifts the moment the type
      // scale changes.
      const lineHeight = code.getBoundingClientRect().height / Math.max(lines.length, 1);
      const target = lineIndex * lineHeight - scroller.clientHeight / 2;
      scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
    },
    [lines],
  );

  // Install a selection the edit commands asked for. A DOM write after render
  // and nothing else — the caret readout was already set by the command that
  // produced the text, so there is no state to derive here.
  useEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    pendingSelection.current = null;
    textareaRef.current?.setSelectionRange(pending[0], pending[1]);
  });

  useEffect(() => {
    if (searchOpen) searchRef.current?.select();
  }, [searchOpen]);

  const commit = (result: EditResult) => {
    pendingSelection.current = [result.selectionStart, result.selectionEnd];
    setCaret(caretPosition(result.text, result.selectionStart));
    onChange(result.text);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const mod = event.metaKey || event.ctrlKey;

    if (mod && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave();
      return;
    }
    if (mod && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setSearchOpen(true);
      return;
    }
    if (mod && event.key === "/") {
      event.preventDefault();
      commit(applyComment(textarea.value, textarea.selectionStart, textarea.selectionEnd));
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      commit(
        applyMoveLines(
          textarea.value,
          textarea.selectionStart,
          textarea.selectionEnd,
          event.key === "ArrowUp" ? -1 : 1,
        ),
      );
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      commit(
        applyTab(textarea.value, textarea.selectionStart, textarea.selectionEnd, event.shiftKey),
      );
      return;
    }
    if (event.key === "Enter" && !mod) {
      event.preventDefault();
      commit(applyEnter(textarea.value, textarea.selectionStart, textarea.selectionEnd));
      return;
    }
    if (event.key === "Escape" && searchOpen) {
      setSearchOpen(false);
    }
  };

  const onInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const next = textarea.value;
    const position = caretPosition(next, textarea.selectionStart);

    if (isLuau && dedentedLine.current !== position.line - 1) {
      const dedented = autoDedent(next, textarea.selectionStart);
      if (dedented) {
        dedentedLine.current = position.line - 1;
        commit(dedented);
        return;
      }
    }
    if (dedentedLine.current !== null && dedentedLine.current !== position.line - 1) {
      dedentedLine.current = null;
    }

    setCaret({ line: position.line, column: position.column });
    onChange(next);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const revert = async () => {
    setReverting(true);
    const result = await revertFile(file.id);
    setReverting(false);
    if (result.ok) {
      toast.success("Restored the previous version");
      router.refresh();
    } else {
      toast.error(result.error ?? "Could not revert.");
    }
  };

  const toggleCompare = async () => {
    if (comparing) {
      setComparing(false);
      return;
    }
    setComparing(true);
    // A dirty buffer compares against what is stored; there is nothing to fetch.
    if (dirty || previous || file.revision <= 1) return;

    setLoadingPrevious(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files/${file.id}/revisions?revision=${file.revision - 1}`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const data: { revision: number; content: string } = await response.json();
        setPrevious({ revision: data.revision, content: data.content });
      } else {
        toast.error("That revision was not kept.");
        setComparing(false);
      }
    } catch {
      toast.error("Could not load the earlier version.");
      setComparing(false);
    } finally {
      setLoadingPrevious(false);
    }
  };

  const compareBefore = dirty ? baseline : (previous?.content ?? null);
  const compareLabel = dirty
    ? "unsaved edits"
    : previous
      ? `revision ${previous.revision} → ${file.revision}`
      : "no earlier version kept";

  const step = (delta: number) => {
    if (!matches.length) return;
    const next = (matchIndex + delta + matches.length) % matches.length;
    setMatchIndex(next);
    const lineIndex = matches[next];
    const column = lines[lineIndex].toLowerCase().indexOf(query.trim().toLowerCase());
    goToLine(lineIndex, { from: column, to: column + query.trim().length });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-hairline px-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-muted-foreground">
          {file.path}
          {dirty && <span className="ml-1.5 text-[var(--ember)]">•</span>}
        </span>

        {dirty && (
          <>
            <button
              type="button"
              onClick={onDiscard}
              className="rounded px-1.5 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-[var(--ember)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--ember-ink)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-ember"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              Save
            </button>
          </>
        )}

        <ToolbarButton
          label={comparing ? "Hide changes" : "Show changes"}
          pressed={comparing}
          onClick={toggleCompare}
        >
          {loadingPrevious ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <SplitSquareHorizontal className="size-3.5" />
          )}
        </ToolbarButton>

        <ToolbarButton
          label="Search in file"
          pressed={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          <Search className="size-3.5" />
        </ToolbarButton>

        {file.revision > 1 && (
          <ToolbarButton label="Restore previous version" onClick={revert} disabled={reverting}>
            {reverting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <History className="size-3.5" />
            )}
          </ToolbarButton>
        )}

        <ToolbarButton label="Copy file contents" onClick={copy}>
          {copied ? (
            <Check className="size-3.5 text-[var(--success)]" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </ToolbarButton>

        {onToggleExpand && (
          <ToolbarButton
            label={expanded ? "Collapse the editor" : "Expand the editor"}
            onClick={onToggleExpand}
          >
            {expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </ToolbarButton>
        )}

        {onClose && (
          <ToolbarButton label="Close file" onClick={onClose}>
            <X className="size-3.5" />
          </ToolbarButton>
        )}
      </div>

      {searchOpen && (
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-1.5">
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setMatchIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              } else if (event.key === "Escape") {
                setSearchOpen(false);
                textareaRef.current?.focus();
              }
            }}
            placeholder="Find in file"
            aria-label="Find in file"
            className="h-6 min-w-0 flex-1 bg-transparent font-mono text-[0.6875rem] outline-none placeholder:text-muted-foreground"
          />
          <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-muted-foreground">
            {matches.length ? `${(matchIndex % matches.length) + 1}/${matches.length}` : "0"}
          </span>
          <ToolbarButton label="Previous match" onClick={() => step(-1)} disabled={!matches.length}>
            <ChevronUp className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton label="Next match" onClick={() => step(1)} disabled={!matches.length}>
            <ChevronDown className="size-3.5" />
          </ToolbarButton>
        </div>
      )}

      {comparing ? (
        <>
          <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-surface-sunken/50 px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[0.625rem] text-muted-foreground">
              {compareLabel}
            </span>
            <ModeToggle mode={diffMode} onChange={setDiffMode} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {compareBefore === null ? (
              <p className="px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
                No earlier version of this file was kept.
              </p>
            ) : (
              <DiffView
                path={file.path}
                before={compareBefore}
                after={value}
                mode={diffMode}
                context={CONTEXT_LINES}
              />
            )}
          </div>
        </>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-w-max">
            <div className="code-type sticky left-0 z-20 shrink-0 select-none border-r border-hairline bg-surface-sunken text-right">
              {lines.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-[var(--code-line)] px-2 tabular-nums",
                    index + 1 === caret.line
                      ? "text-foreground/70"
                      : severityByLine.get(index + 1) === "error"
                        ? "text-[var(--danger)]"
                        : severityByLine.get(index + 1) === "warning"
                          ? "text-[var(--warning)]"
                          : "text-muted-foreground",
                  )}
                >
                  {index + 1}
                </div>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <div aria-hidden className="absolute inset-0">
                {lines.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-[var(--code-line)]",
                      severityByLine.get(index + 1) === "error" && "bg-[var(--danger)]/10",
                      severityByLine.get(index + 1) === "warning" && "bg-[var(--warning)]/10",
                      matchedLines.has(index) && "bg-[var(--ember)]/10",
                      activeMatch === index && "bg-[var(--ember)]/25",
                      index + 1 === caret.line && "bg-[var(--editor-active-line)]",
                    )}
                  />
                ))}
              </div>

              <div ref={codeRef} aria-hidden className="code-type relative px-3">
                {highlighted.map((html, index) => (
                  <div
                    key={index}
                    className="h-[var(--code-line)] whitespace-pre"
                    dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }}
                  />
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={value}
                onChange={onInput}
                onKeyDown={onKeyDown}
                onSelect={(event) => setCaretFrom(event.currentTarget, setCaret)}
                onClick={(event) => setCaretFrom(event.currentTarget, setCaret)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                aria-label={`Edit ${file.path}`}
                className="code-type absolute inset-0 size-full resize-none overflow-hidden border-0 bg-transparent px-3 text-transparent caret-[var(--ember)] outline-none selection:bg-[var(--signal)]/30"
              />
            </div>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-hairline">
        {diagnostics && diagnostics.diagnostics.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDiagnostics((open) => !open)}
              aria-expanded={showDiagnostics}
              className={cn(
                "flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-mono text-[0.625rem] transition-colors hover:bg-accent/50",
                diagnostics.errors > 0 ? "text-[var(--danger)]" : "text-[var(--warning)]",
              )}
            >
              <TriangleAlert className="size-3" />
              {diagnostics.errors} error{diagnostics.errors === 1 ? "" : "s"} ·{" "}
              {diagnostics.warnings} warning{diagnostics.warnings === 1 ? "" : "s"}
            </button>
            {showDiagnostics && (
              <ul className="max-h-32 overflow-y-auto border-t border-hairline">
                {diagnostics.diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.line}-${index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setComparing(false);
                        goToLine(diagnostic.line - 1);
                      }}
                      className="flex w-full gap-2 px-3 py-1 text-left font-mono text-[0.5625rem] text-muted-foreground transition-colors hover:bg-accent/50"
                    >
                      <span
                        className={
                          diagnostic.severity === "error"
                            ? "text-[var(--danger)]"
                            : "text-[var(--warning)]"
                        }
                      >
                        L{diagnostic.line}
                      </span>
                      <span className="min-w-0 flex-1">{diagnostic.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="flex items-center gap-3 px-3 py-1.5 font-mono text-[0.5625rem] text-muted-foreground">
          <span className="tabular-nums">
            Ln {caret.line}, Col {caret.column}
          </span>
          <span className="tabular-nums">{lines.length} lines</span>
          <span className="hidden tabular-nums sm:inline">
            {formatBytes(dirty ? new Blob([value]).size : file.size_bytes)}
          </span>
          {draftDiff && (
            <span className="tabular-nums">
              <span className="text-[var(--diff-add-ink)]">+{draftDiff.added}</span>{" "}
              <span className="text-[var(--diff-remove-ink)]">−{draftDiff.removed}</span>
            </span>
          )}
          <span className="ml-auto tabular-nums">rev {file.revision}</span>
        </div>
      </div>
    </div>
  );
}

function setCaretFrom(
  textarea: HTMLTextAreaElement,
  set: (position: { line: number; column: number }) => void,
) {
  set(caretPosition(textarea.value, textarea.selectionStart));
}

function ToolbarButton({
  label,
  children,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "tap-target rounded p-1 transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 focus-ember",
        pressed ? "bg-accent text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: DiffMode;
  onChange: (mode: DiffMode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-md border border-border p-0.5">
      {(["inline", "split"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={mode === option}
          className={cn(
            "tap-target rounded px-2 py-0.5 text-[0.625rem] capitalize transition-colors focus-ember",
            mode === option
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
