/**
 * Line and token diffing.
 *
 * Written rather than installed. The whole dependency here is one shortest-edit
 * -script search, and a diff library would arrive with a renderer, a patch
 * parser and a merge engine we would never call — see the bundle note in
 * `docs/IMPLEMENTATION_STATUS.md`.
 *
 * The algorithm is Myers' O(ND), which is what git uses. The cost is
 * proportional to the *size of the change*, not the size of the file, and that
 * is the property that matters here: the agent typically rewrites a handful of
 * lines in a file of several hundred, so a quadratic LCS table would be paying
 * millions of cells for a twenty-line edit.
 */

export type DiffOp = "equal" | "insert" | "delete";

export interface DiffChange<T> {
  op: DiffOp;
  value: T;
}

/**
 * Myers' shortest edit script.
 *
 * `maxEdits` bounds the search. A pair of files with nothing in common has an
 * edit distance of N+M, and chasing that to the end on two 5,000-line files is
 * 25M steps for an answer no one can read anyway — so past the bound we say so
 * and fall back to "all of this replaced all of that", which is both honest and
 * what the reader would have concluded.
 */
export function diffSequences<T>(
  before: readonly T[],
  after: readonly T[],
  options: { maxEdits?: number; equals?: (a: T, b: T) => boolean } = {},
): { changes: DiffChange<T>[]; truncated: boolean } {
  const equals = options.equals ?? ((a: T, b: T) => a === b);
  const maxEdits = options.maxEdits ?? 4000;

  // Identical prefixes and suffixes are the common case for an edited file and
  // cost nothing to strip, which keeps D small for the search that follows.
  let start = 0;
  while (start < before.length && start < after.length && equals(before[start], after[start])) {
    start += 1;
  }
  let endBefore = before.length;
  let endAfter = after.length;
  while (
    endBefore > start &&
    endAfter > start &&
    equals(before[endBefore - 1], after[endAfter - 1])
  ) {
    endBefore -= 1;
    endAfter -= 1;
  }

  const a = before.slice(start, endBefore);
  const b = after.slice(start, endAfter);

  const head: DiffChange<T>[] = before
    .slice(0, start)
    .map((value) => ({ op: "equal" as const, value }));
  const tail: DiffChange<T>[] = before
    .slice(endBefore)
    .map((value) => ({ op: "equal" as const, value }));

  const middle = search(a, b, equals, maxEdits);
  if (!middle) {
    return {
      changes: [
        ...head,
        ...a.map((value) => ({ op: "delete" as const, value })),
        ...b.map((value) => ({ op: "insert" as const, value })),
        ...tail,
      ],
      truncated: true,
    };
  }

  return { changes: [...head, ...middle, ...tail], truncated: false };
}

function search<T>(
  a: readonly T[],
  b: readonly T[],
  equals: (x: T, y: T) => boolean,
  maxEdits: number,
): DiffChange<T>[] | null {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];

  const max = Math.min(n + m, maxEdits);
  const offset = max;
  const size = 2 * max + 1;
  const v = new Int32Array(size);
  const trace: Int32Array[] = [];

  for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());

    for (let k = -d; k <= d; k += 2) {
      const index = k + offset;
      // Out of the band the bound allows; this diagonal cannot be reached.
      if (index < 0 || index >= size) continue;

      let x: number;
      if (k === -d || (k !== d && index > 0 && v[index - 1] < v[index + 1])) {
        x = v[index + 1];
      } else {
        x = v[index - 1] + 1;
      }
      let y = x - k;

      while (x < n && y < m && equals(a[x], b[y])) {
        x += 1;
        y += 1;
      }
      v[index] = x;

      if (x >= n && y >= m) return backtrack(a, b, trace, d, offset, size);
    }
  }

  return null;
}

/** Walk the saved frontiers backwards, emitting the script in forward order. */
function backtrack<T>(
  a: readonly T[],
  b: readonly T[],
  trace: Int32Array[],
  d: number,
  offset: number,
  size: number,
): DiffChange<T>[] {
  const changes: DiffChange<T>[] = [];
  let x = a.length;
  let y = b.length;

  for (let depth = d; depth > 0; depth -= 1) {
    const v = trace[depth];
    const k = x - y;
    const index = k + offset;

    const fromRight =
      k === -depth || (k !== depth && index > 0 && index + 1 < size && v[index - 1] < v[index + 1]);
    const prevK = fromRight ? k + 1 : k - 1;
    const prevX = v[prevK + offset];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
      changes.push({ op: "equal", value: a[x] });
    }

    if (y > prevY) {
      y -= 1;
      changes.push({ op: "insert", value: b[y] });
    } else if (x > prevX) {
      x -= 1;
      changes.push({ op: "delete", value: a[x] });
    }
  }

  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    changes.push({ op: "equal", value: a[x] });
  }

  return changes.reverse();
}

// --- line diffs ------------------------------------------------------------

export interface DiffLine {
  op: DiffOp;
  /** 1-based line number in the original, absent on an inserted line. */
  before?: number;
  /** 1-based line number in the new file, absent on a deleted line. */
  after?: number;
  text: string;
}

export interface DiffHunk {
  beforeStart: number;
  beforeCount: number;
  afterStart: number;
  afterCount: number;
  lines: DiffLine[];
}

export interface FileDiff {
  lines: DiffLine[];
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** True when the edit distance exceeded the bound and the diff is a wholesale replace. */
  truncated: boolean;
}

function splitLines(value: string): string[] {
  if (value === "") return [];
  // A file that ends in a newline does not have a final empty line; without
  // this every diff would report a phantom trailing change.
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(before: string, after: string, context = 3): FileDiff {
  const { changes, truncated } = diffSequences(splitLines(before), splitLines(after));

  const lines: DiffLine[] = [];
  let beforeNo = 0;
  let afterNo = 0;
  let added = 0;
  let removed = 0;

  for (const change of changes) {
    if (change.op === "equal") {
      beforeNo += 1;
      afterNo += 1;
      lines.push({ op: "equal", before: beforeNo, after: afterNo, text: change.value });
    } else if (change.op === "delete") {
      beforeNo += 1;
      removed += 1;
      lines.push({ op: "delete", before: beforeNo, text: change.value });
    } else {
      afterNo += 1;
      added += 1;
      lines.push({ op: "insert", after: afterNo, text: change.value });
    }
  }

  return { lines, hunks: buildHunks(lines, context), added, removed, truncated };
}

/**
 * Group changed lines into hunks with surrounding context.
 *
 * Unchanged runs longer than twice the context are elided, which is the whole
 * point: reviewing a 400-line file where 6 lines moved should show 6 lines and
 * their neighbourhood, not 400 lines and a hunt.
 */
export function buildHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const changed = lines
    .map((line, index) => (line.op === "equal" ? -1 : index))
    .filter((index) => index >= 0);
  if (changed.length === 0) return [];

  const ranges: [number, number][] = [];
  for (const index of changed) {
    const from = Math.max(0, index - context);
    const to = Math.min(lines.length - 1, index + context);
    const last = ranges[ranges.length - 1];
    // Overlapping or touching windows become one hunk; a one-line gap between
    // two hunks is noise, not a separator.
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else ranges.push([from, to]);
  }

  return ranges.map(([from, to]) => {
    const slice = lines.slice(from, to + 1);
    const firstBefore = slice.find((line) => line.before !== undefined)?.before;
    const firstAfter = slice.find((line) => line.after !== undefined)?.after;
    return {
      beforeStart: firstBefore ?? 0,
      beforeCount: slice.filter((line) => line.op !== "insert").length,
      afterStart: firstAfter ?? 0,
      afterCount: slice.filter((line) => line.op !== "delete").length,
      lines: slice,
    };
  });
}

// --- side-by-side ----------------------------------------------------------

export interface DiffRow {
  left?: DiffLine;
  right?: DiffLine;
}

/**
 * Pair a hunk's lines into side-by-side rows.
 *
 * Deletions and the insertions that follow them are paired positionally, so an
 * edited line sits opposite the line it replaced instead of being stacked below
 * a block of removals. Unequal run lengths leave one side blank, which reads
 * correctly as "this was added" / "this was removed".
 */
export function toRows(lines: DiffLine[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.op === "equal") {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }

    const deletions: DiffLine[] = [];
    while (index < lines.length && lines[index].op === "delete") {
      deletions.push(lines[index]);
      index += 1;
    }
    const insertions: DiffLine[] = [];
    while (index < lines.length && lines[index].op === "insert") {
      insertions.push(lines[index]);
      index += 1;
    }

    const height = Math.max(deletions.length, insertions.length);
    for (let row = 0; row < height; row += 1) {
      rows.push({ left: deletions[row], right: insertions[row] });
    }
  }

  return rows;
}

// --- intra-line ------------------------------------------------------------

export interface TokenSpan {
  changed: boolean;
  text: string;
}

const TOKEN_SPLIT = /([A-Za-z0-9_]+|\s+|.)/g;

function tokenize(value: string): string[] {
  return value.match(TOKEN_SPLIT) ?? [];
}

/** Fraction of the pair's characters the token diff left untouched, 0–1. */
const SIMILARITY_FLOOR = 0.35;

/**
 * Word-level spans for a replaced line pair, or null when the two lines are too
 * different for it to help.
 *
 * Highlighting every token of two unrelated lines produces a solid block of
 * emphasis that says less than no emphasis at all, so below the similarity
 * floor we decline and the row stays a plain add/remove. Similarity is measured
 * from the diff itself rather than guessed from shared prefixes: `print("hello
 * world")` and `warn("hello there")` share neither a prefix nor a meaningful
 * suffix, and are still obviously the same line edited.
 */
export function intraLineSpans(
  before: string,
  after: string,
): { before: TokenSpan[]; after: TokenSpan[] } | null {
  if (before === after) return null;
  if (before.length + after.length === 0) return null;

  const { changes, truncated } = diffSequences(tokenize(before), tokenize(after), {
    maxEdits: 400,
  });
  if (truncated) return null;

  const left: TokenSpan[] = [];
  const right: TokenSpan[] = [];
  let common = 0;

  for (const change of changes) {
    if (change.op === "equal") {
      common += change.value.length;
      push(left, false, change.value);
      push(right, false, change.value);
    } else if (change.op === "delete") {
      push(left, true, change.value);
    } else {
      push(right, true, change.value);
    }
  }

  if ((2 * common) / (before.length + after.length) < SIMILARITY_FLOOR) return null;

  return { before: left, after: right };
}

function push(spans: TokenSpan[], changed: boolean, text: string) {
  const last = spans[spans.length - 1];
  if (last && last.changed === changed) last.text += text;
  else spans.push({ changed, text });
}
