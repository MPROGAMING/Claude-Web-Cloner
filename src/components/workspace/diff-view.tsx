"use client";

import { useMemo } from "react";
import { diffLines, intraLineSpans, toRows, type DiffLine, type TokenSpan } from "@/lib/diff";
import { highlightFragment } from "@/lib/roblox/luau-highlight";
import { cn } from "@/lib/utils";

/**
 * A syntax-highlighted diff.
 *
 * This is the approval surface. Someone is about to let an agent write to their
 * game, and the only thing standing between "I trust this" and "I hope this is
 * fine" is being able to read the change. So the priorities are, in order:
 * never show a line that is not in one of the two files, show changed lines
 * next to what they replaced, and make the changed *part* of a changed line
 * findable without re-reading it.
 *
 * Change tint and syntax colour are painted as two layers over identical text
 * rather than fought over in one pass. Interleaving them would mean cutting
 * syntax tokens at word-diff boundaries, which mis-colours exactly the lines a
 * reader is looking hardest at.
 */

export type DiffMode = "inline" | "split";

export function DiffView({
  path,
  before,
  after,
  mode = "inline",
  context = 3,
  className,
}: {
  path: string;
  before: string | null;
  after: string | null;
  mode?: DiffMode;
  context?: number;
  className?: string;
}) {
  const diff = useMemo(
    () => diffLines(before ?? "", after ?? "", context),
    [before, after, context],
  );

  if (diff.hunks.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[0.8125rem] text-muted-foreground">
        No differences — this file is byte for byte identical.
      </p>
    );
  }

  return (
    <div className={cn("code-type", className)}>
      {diff.truncated && (
        <p className="border-b border-hairline bg-[var(--warning)]/10 px-3 py-1.5 text-[0.6875rem] text-[var(--warning)]">
          These two versions have almost nothing in common, so this is shown as a
          wholesale replacement rather than a line-by-line edit.
        </p>
      )}

      {diff.hunks.map((hunk, index) => {
        const previous = diff.hunks[index - 1];
        const skipped = previous ? hunk.beforeStart - (previous.beforeStart + previous.beforeCount) : 0;

        return (
          <div key={`${hunk.beforeStart}-${hunk.afterStart}-${index}`}>
            {(index > 0 || hunk.beforeStart > 1 || hunk.afterStart > 1) && (
              <HunkSeparator
                skipped={index > 0 ? skipped : Math.max(hunk.beforeStart, hunk.afterStart) - 1}
              />
            )}
            {mode === "split" ? (
              <SplitHunk lines={hunk.lines} path={path} />
            ) : (
              <InlineHunk lines={hunk.lines} path={path} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Line counts for a header, without rendering the diff twice. */
export function diffStats(before: string | null, after: string | null) {
  const diff = diffLines(before ?? "", after ?? "", 0);
  return { added: diff.added, removed: diff.removed };
}

function HunkSeparator({ skipped }: { skipped: number }) {
  if (skipped <= 0) return null;
  return (
    <div className="flex items-center gap-2 border-y border-hairline bg-surface-sunken/60 px-3 py-1 text-[0.625rem] text-muted-foreground">
      <span aria-hidden>⋯</span>
      <span>
        {skipped} unchanged line{skipped === 1 ? "" : "s"}
      </span>
    </div>
  );
}

const SIGN = { insert: "+", delete: "-", equal: " " } as const;

function rowTone(op: DiffLine["op"]) {
  if (op === "insert") return "bg-[var(--diff-add-bg)]";
  if (op === "delete") return "bg-[var(--diff-remove-bg)]";
  return undefined;
}

function InlineHunk({ lines, path }: { lines: DiffLine[]; path: string }) {
  // Word-level spans need the pair, which only exists once deletions and the
  // insertions replacing them are matched up — the same pairing the split view
  // uses for its rows.
  const spans = useMemo(() => pairSpans(lines), [lines]);

  return (
    <table className="w-full border-collapse">
      <tbody>
        {lines.map((line, index) => (
          <tr key={`${line.op}-${line.before ?? "x"}-${line.after ?? "x"}-${index}`} className={rowTone(line.op)}>
            <Gutter value={line.before} op={line.op} />
            <Gutter value={line.after} op={line.op} />
            <td
              className={cn(
                "w-4 select-none pl-1 text-center align-top",
                line.op === "insert" && "text-[var(--diff-add-ink)]",
                line.op === "delete" && "text-[var(--diff-remove-ink)]",
                line.op === "equal" && "text-transparent",
              )}
              aria-hidden={line.op === "equal"}
            >
              {SIGN[line.op]}
            </td>
            <Code line={line} path={path} spans={spans.get(index)} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SplitHunk({ lines, path }: { lines: DiffLine[]; path: string }) {
  const rows = useMemo(() => toRows(lines), [lines]);
  const spans = useMemo(() => pairSpans(lines), [lines]);
  const indexOf = useMemo(() => new Map(lines.map((line, index) => [line, index])), [lines]);

  return (
    <table className="w-full table-fixed border-collapse">
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <Gutter value={row.left?.before} op={row.left?.op ?? "equal"} />
            <Code
              line={row.left}
              path={path}
              spans={row.left ? spans.get(indexOf.get(row.left) ?? -1) : undefined}
              className={cn("w-1/2 border-r border-hairline", rowTone(row.left?.op ?? "equal"))}
            />
            <Gutter value={row.right?.after} op={row.right?.op ?? "equal"} />
            <Code
              line={row.right}
              path={path}
              spans={row.right ? spans.get(indexOf.get(row.right) ?? -1) : undefined}
              className={cn("w-1/2", rowTone(row.right?.op ?? "equal"))}
            />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Gutter({ value, op }: { value?: number; op: DiffLine["op"] }) {
  return (
    <td
      className={cn(
        "w-9 select-none border-r border-hairline px-1.5 text-right align-top text-[0.6875rem] tabular-nums",
        op === "insert" && "text-[var(--diff-add-ink)]",
        op === "delete" && "text-[var(--diff-remove-ink)]",
        // Not dimmed further: --muted-foreground is already tuned to 4.5:1,
        // and an opacity modifier on top of it is what put the old viewer's
        // gutter at 2.29:1.
        op === "equal" && "text-muted-foreground",
      )}
    >
      {value ?? ""}
    </td>
  );
}

/**
 * One code cell: the change tint painted behind, the syntax colour in front.
 *
 * Both layers hold the same characters with the same metrics, so the tint lands
 * under the characters that actually changed. The back layer is aria-hidden and
 * its text transparent — it exists only to carry a background.
 */
function Code({
  line,
  path,
  spans,
  className,
}: {
  line?: DiffLine;
  path: string;
  spans?: TokenSpan[];
  className?: string;
}) {
  if (!line) return <td className={cn("align-top", className)} />;

  const html = highlightFragment(line.text, path);
  const emphasis =
    line.op === "insert" ? "bg-[var(--diff-add-strong)]" : "bg-[var(--diff-remove-strong)]";

  return (
    <td className={cn("min-w-0 overflow-hidden px-2 align-top", className)}>
      <div className="relative whitespace-pre">
        {spans && (
          <div aria-hidden className="absolute inset-0 whitespace-pre text-transparent">
            {spans.map((span, index) => (
              <span key={index} className={span.changed ? emphasis : undefined}>
                {span.text}
              </span>
            ))}
          </div>
        )}
        <span className="relative" dangerouslySetInnerHTML={{ __html: html || "&nbsp;" }} />
      </div>
    </td>
  );
}

/**
 * Word-level spans keyed by index into the hunk's line list.
 *
 * Computed once per hunk rather than per rendered row, because inline and split
 * render the same pairs and both need them.
 */
function pairSpans(lines: DiffLine[]): Map<number, TokenSpan[]> {
  const result = new Map<number, TokenSpan[]>();
  let index = 0;

  while (index < lines.length) {
    if (lines[index].op === "equal") {
      index += 1;
      continue;
    }

    const deletions: number[] = [];
    while (index < lines.length && lines[index].op === "delete") deletions.push(index++);
    const insertions: number[] = [];
    while (index < lines.length && lines[index].op === "insert") insertions.push(index++);

    const pairs = Math.min(deletions.length, insertions.length);
    for (let i = 0; i < pairs; i += 1) {
      const spans = intraLineSpans(lines[deletions[i]].text, lines[insertions[i]].text);
      if (!spans) continue;
      result.set(deletions[i], spans.before);
      result.set(insertions[i], spans.after);
    }
  }

  return result;
}
