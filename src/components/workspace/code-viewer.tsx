"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, GitCompare, History, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/format";
import { validateLuau } from "@/lib/roblox/luau-validator";
import { revertFile } from "@/lib/actions/projects";
import type { ProjectFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Code viewer with line numbers, in-file search, diagnostics and revert.
 *
 * Highlighting is done with a small tokenizer rather than a full grammar: the
 * viewer must stay responsive while a file is streaming in, and a re-parse of
 * the whole buffer on every chunk is exactly what makes editors feel slow.
 */

/**
 * Order is significant. The first alternative to match at a position wins, so
 * comments must precede strings (a comment may contain quotes) and both must
 * precede keywords and numbers.
 *
 * None of these may contain a capturing group — they are combined into one
 * alternation below, and the group index is what identifies the token kind.
 */
const TOKEN_PATTERNS: { pattern: string; className: string }[] = [
  { pattern: String.raw`--\[\[[\s\S]*?\]\]|--[^\n]*`, className: "text-muted-foreground/55 italic" },
  {
    pattern: String.raw`"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\[\[[\s\S]*?\]\]`,
    className: "text-[var(--success)]",
  },
  {
    pattern: String.raw`\b(?:local|function|end|if|then|else|elseif|for|while|do|return|break|continue|and|or|not|nil|true|false|in|repeat|until|type|export)\b`,
    className: "text-[var(--ember)]",
  },
  {
    pattern: String.raw`\b(?:game|workspace|script|task|math|table|string|os|Instance|Vector3|CFrame|Color3|UDim2|Enum|self|require|print|warn|assert|pcall|error|typeof|tostring|tonumber|pairs|ipairs|next|setmetatable)\b`,
    className: "text-[var(--signal)]",
  },
  { pattern: String.raw`\b\d+\.?\d*\b`, className: "text-[var(--warning)]" },
];

const TOKEN_RE = new RegExp(TOKEN_PATTERNS.map((t) => `(${t.pattern})`).join("|"), "g");

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Tokenise in a single pass.
 *
 * Running the patterns one after another over the accumulated HTML makes the
 * highlighter re-scan its own output: the string rule matches the quoted class
 * name inside a `<span class="…">` emitted by the comment rule, nests a span
 * inside an attribute, and the browser renders the class name as source code.
 * Every Luau comment displayed wrong because of it. Matching once and emitting
 * once means generated markup is never treated as input.
 */
function highlight(source: string): string {
  let html = "";
  let last = 0;

  TOKEN_RE.lastIndex = 0;
  for (let match = TOKEN_RE.exec(source); match !== null; match = TOKEN_RE.exec(source)) {
    const kind = match.slice(1).findIndex((group) => group !== undefined);
    if (kind === -1) continue;

    html += escapeHtml(source.slice(last, match.index));
    html += `<span class="${TOKEN_PATTERNS[kind].className}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;

    // A zero-length match would spin forever; nudge past it.
    if (match[0].length === 0) TOKEN_RE.lastIndex += 1;
  }

  return html + escapeHtml(source.slice(last));
}

export function CodeViewer({
  file,
  onClose,
}: {
  file: ProjectFile;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [reverting, setReverting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const lines = useMemo(() => file.content.split("\n"), [file.content]);
  const isLuau = /\.luau?$/i.test(file.path);

  const diagnostics = useMemo(
    () => (isLuau ? validateLuau(file.content, file.path) : null),
    [file.content, file.path, isLuau],
  );

  const matches = useMemo(() => {
    if (!query.trim()) return new Set<number>();
    const needle = query.toLowerCase();
    const set = new Set<number>();
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) set.add(index);
    });
    return set;
  }, [lines, query]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const copy = async () => {
    await navigator.clipboard.writeText(file.content);
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

  const errorLines = new Map(
    (diagnostics?.diagnostics ?? []).map((d) => [d.line, d.severity]),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-hairline px-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] text-muted-foreground">
          {file.path}
        </span>

        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search in file"
          aria-pressed={searchOpen}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
        >
          <Search className="size-3.5" />
        </button>

        {file.revision > 1 && (
          <button
            type="button"
            onClick={revert}
            disabled={reverting}
            aria-label="Restore previous version"
            title="Restore previous version"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 focus-ember"
          >
            {reverting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <History className="size-3.5" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={copy}
          aria-label="Copy file contents"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
        >
          {copied ? <Check className="size-3.5 text-[var(--success)]" /> : <Copy className="size-3.5" />}
        </button>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close file"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ember"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {searchOpen && (
        <div className="shrink-0 border-b border-hairline px-3 py-1.5">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setSearchOpen(false)}
            placeholder="Search in file"
            aria-label="Search in file"
            className="h-6 w-full bg-transparent font-mono text-[0.6875rem] outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <p className="mt-0.5 font-mono text-[0.5625rem] text-muted-foreground">
              {matches.size} matching line{matches.size === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}

      {/* code */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[0.6875rem] leading-[1.7]">
          <tbody>
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const severity = errorLines.get(lineNumber);
              const isMatch = matches.has(index);

              return (
                <tr
                  key={lineNumber}
                  className={cn(
                    isMatch && "bg-[var(--ember)]/10",
                    severity === "error" && "bg-[var(--danger)]/8",
                    severity === "warning" && "bg-[var(--warning)]/8",
                  )}
                >
                  <td className="w-10 select-none border-r border-hairline px-2 text-right align-top text-muted-foreground/45">
                    {lineNumber}
                  </td>
                  <td className="whitespace-pre px-3 align-top">
                    {isLuau ? (
                      <span dangerouslySetInnerHTML={{ __html: highlight(line) || "&nbsp;" }} />
                    ) : (
                      line || " "
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-hairline">
        {diagnostics && diagnostics.diagnostics.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowDiagnostics((v) => !v)}
              aria-expanded={showDiagnostics}
              className={cn(
                "flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-mono text-[0.625rem] transition-colors hover:bg-accent/50",
                diagnostics.errors > 0 ? "text-[var(--danger)]" : "text-[var(--warning)]",
              )}
            >
              <GitCompare className="size-3" />
              {diagnostics.errors} error{diagnostics.errors === 1 ? "" : "s"} ·{" "}
              {diagnostics.warnings} warning{diagnostics.warnings === 1 ? "" : "s"}
            </button>
            {showDiagnostics && (
              <ul className="max-h-32 overflow-y-auto border-t border-hairline">
                {diagnostics.diagnostics.map((diagnostic, index) => (
                  <li
                    key={`${diagnostic.line}-${index}`}
                    className="flex gap-2 px-3 py-1 font-mono text-[0.5625rem] text-muted-foreground"
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
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="flex items-center gap-3 px-3 py-1.5 font-mono text-[0.5625rem] text-muted-foreground">
          <span>{lines.length} lines</span>
          <span>{formatBytes(file.size_bytes)}</span>
          <span className="ml-auto">rev {file.revision}</span>
        </div>
      </div>
    </div>
  );
}
