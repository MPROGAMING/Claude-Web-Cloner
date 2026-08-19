import { describe, expect, it } from "vitest";
import { buildHunks, diffLines, diffSequences, intraLineSpans, toRows } from "@/lib/diff";

/**
 * The diff is the approval surface: what it shows is what a user is consenting
 * to have written. So the properties worth pinning are the ones that would make
 * it *lie* — a line invented, a line dropped, a count that disagrees with the
 * rows on screen.
 */

/** Reconstruct both sides from the script. If either fails, the diff lied. */
function reconstruct(before: string, after: string) {
  const { lines } = diffLines(before, after);
  const left = lines.filter((l) => l.op !== "insert").map((l) => l.text);
  const right = lines.filter((l) => l.op !== "delete").map((l) => l.text);
  return { left, right };
}

const split = (value: string) => (value === "" ? [] : value.replace(/\n$/, "").split("\n"));

describe("diffLines", () => {
  it("reports no change for identical input", () => {
    const diff = diffLines("local a = 1\nreturn a", "local a = 1\nreturn a");
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
    expect(diff.hunks).toHaveLength(0);
  });

  it("reconstructs both files exactly from the script", () => {
    const before = "local a = 1\nlocal b = 2\nreturn a + b";
    const after = "local a = 1\nlocal b = 20\nlocal c = 3\nreturn a + b + c";
    const { left, right } = reconstruct(before, after);
    expect(left).toEqual(split(before));
    expect(right).toEqual(split(after));
  });

  it("reconstructs a wholesale rewrite", () => {
    const before = "one\ntwo\nthree";
    const after = "alpha\nbeta";
    const { left, right } = reconstruct(before, after);
    expect(left).toEqual(split(before));
    expect(right).toEqual(split(after));
  });

  it("treats creation as all-insert and deletion as all-delete", () => {
    const created = diffLines("", "a\nb\n");
    expect(created.added).toBe(2);
    expect(created.removed).toBe(0);

    const deleted = diffLines("a\nb\n", "");
    expect(deleted.added).toBe(0);
    expect(deleted.removed).toBe(2);
  });

  it("does not invent a trailing line for a file that ends in a newline", () => {
    const diff = diffLines("a\nb\n", "a\nb");
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
  });

  it("counts match the rows the viewer will render", () => {
    const diff = diffLines("a\nb\nc", "a\nx\nc\nd");
    expect(diff.added).toBe(diff.lines.filter((l) => l.op === "insert").length);
    expect(diff.removed).toBe(diff.lines.filter((l) => l.op === "delete").length);
  });

  it("numbers lines against the correct side", () => {
    const diff = diffLines("a\nb\nc", "a\nc");
    const removed = diff.lines.find((l) => l.op === "delete");
    expect(removed?.text).toBe("b");
    expect(removed?.before).toBe(2);
    expect(removed?.after).toBeUndefined();
  });

  it("finds a minimal edit inside a large unchanged file", () => {
    const before = Array.from({ length: 800 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 400", "line 400 changed");
    const diff = diffLines(before, after);
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.truncated).toBe(false);
  });

  /**
   * Two files with nothing in common have an edit distance of N+M. Chasing it
   * on large inputs buys an unreadable answer at quadratic cost, so the search
   * is bounded and says when it gave up.
   */
  it("falls back to a wholesale replace past the edit bound, and says so", () => {
    const before = Array.from({ length: 4000 }, (_, i) => `alpha ${i}`).join("\n");
    const after = Array.from({ length: 4000 }, (_, i) => `beta ${i}`).join("\n");
    const diff = diffLines(before, after);
    expect(diff.truncated).toBe(true);
    expect(diff.removed).toBe(4000);
    expect(diff.added).toBe(4000);
    const { left, right } = reconstruct(before, after);
    expect(left).toEqual(split(before));
    expect(right).toEqual(split(after));
  });

  it("stays fast on a realistic file", () => {
    const before = Array.from({ length: 2000 }, (_, i) => `local v${i} = ${i}`).join("\n");
    const after = before
      .replace("local v100 = 100", "local v100 = 101")
      .replace("local v1500 = 1500", "-- gone");
    const started = performance.now();
    diffLines(before, after);
    expect(performance.now() - started).toBeLessThan(150);
  });
});

describe("hunks", () => {
  it("elides unchanged stretches and keeps context around each change", () => {
    const before = Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 5", "line five").replace("line 50", "line fifty");
    const diff = diffLines(before, after, 3);

    expect(diff.hunks).toHaveLength(2);
    for (const hunk of diff.hunks) {
      expect(hunk.lines.length).toBeLessThanOrEqual(9);
      expect(hunk.lines.some((l) => l.op !== "equal")).toBe(true);
    }
  });

  it("merges changes that are closer together than the context window", () => {
    const before = "a\nb\nc\nd\ne";
    const after = "A\nb\nc\nd\nE";
    expect(diffLines(before, after, 3).hunks).toHaveLength(1);
  });

  it("reports hunk start lines that match the first numbered line inside it", () => {
    const before = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n");
    const after = before.replace("l20", "l20!");
    const [hunk] = diffLines(before, after, 2).hunks;
    expect(hunk.beforeStart).toBe(19);
    expect(hunk.lines[0].before).toBe(19);
  });

  it("returns nothing to review when nothing changed", () => {
    expect(buildHunks(diffLines("a\nb", "a\nb").lines)).toEqual([]);
  });
});

describe("toRows", () => {
  it("pairs a replaced line opposite the line it replaced", () => {
    const diff = diffLines("local a = 1", "local a = 2");
    const rows = toRows(diff.lines);
    expect(rows).toHaveLength(1);
    expect(rows[0].left?.text).toBe("local a = 1");
    expect(rows[0].right?.text).toBe("local a = 2");
  });

  it("leaves the opposite side empty for a pure insertion", () => {
    const rows = toRows(diffLines("a", "a\nb").lines);
    const inserted = rows.find((row) => row.right?.op === "insert");
    expect(inserted?.left).toBeUndefined();
  });

  it("keeps every line from the script", () => {
    const diff = diffLines("a\nb\nc\nd", "a\nx\ny\nd");
    const rows = toRows(diff.lines);
    const seen = rows.flatMap((row) => [row.left, row.right]).filter(Boolean);
    // Equal lines appear on both sides, so count them once.
    const unique = new Set(seen.map((line) => `${line!.op}:${line!.text}`));
    for (const line of diff.lines) expect(unique.has(`${line.op}:${line.text}`)).toBe(true);
  });
});

describe("intraLineSpans", () => {
  it("marks only the tokens that actually changed", () => {
    const spans = intraLineSpans("local speed = 16", "local speed = 24");
    expect(spans).not.toBeNull();
    expect(spans!.before.filter((s) => s.changed).map((s) => s.text)).toEqual(["16"]);
    expect(spans!.after.filter((s) => s.changed).map((s) => s.text)).toEqual(["24"]);
  });

  it("reassembles each side exactly", () => {
    const before = 'print("hello world")';
    const after = 'warn("hello there")';
    const spans = intraLineSpans(before, after)!;
    expect(spans.before.map((s) => s.text).join("")).toBe(before);
    expect(spans.after.map((s) => s.text).join("")).toBe(after);
  });

  it("declines when the two lines have nothing in common", () => {
    expect(intraLineSpans("local a = 1", "return someCompletelyOtherThing()")).toBeNull();
  });
});

describe("diffSequences", () => {
  it("handles empty input on either side", () => {
    expect(diffSequences([], []).changes).toEqual([]);
    expect(diffSequences([], ["a"]).changes).toEqual([{ op: "insert", value: "a" }]);
    expect(diffSequences(["a"], []).changes).toEqual([{ op: "delete", value: "a" }]);
  });

  it("preserves order", () => {
    const { changes } = diffSequences(["a", "b", "c"], ["a", "c"]);
    expect(changes.map((c) => c.value)).toEqual(["a", "b", "c"]);
  });
});
