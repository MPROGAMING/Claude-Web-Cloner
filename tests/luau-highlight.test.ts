import { describe, expect, it } from "vitest";
import {
  highlightFragment,
  highlightLines,
  highlightLuauLines,
} from "@/lib/roblox/luau-highlight";

/**
 * The Luau highlighter, exercised directly.
 *
 * A sequential highlighter re-scans the HTML it has already produced: the
 * string rule matches the quoted class name inside a `<span class="…">` emitted
 * by the comment rule, and the class name renders as source code. It showed up
 * on the very first real generated file — every comment line was corrupted —
 * and no test could see it, because the tokeniser was a private function inside
 * a client component. It is a module now, so these tests exercise the code the
 * app actually runs instead of a reconstruction of it.
 */

const highlight = (source: string) => highlightLuauLines(source).join("\n");

/** Text as the browser would show it, with all markup removed. */
function rendered(html: string): string {
  return html
    .replace(/<span class="[^"]*">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

describe("Luau highlighting", () => {
  it("never leaks a CSS class name into the displayed code", () => {
    const code = '--!strict\nlocal x = 1 -- a comment';
    const html = highlight(code);

    expect(rendered(html)).toBe(code);
    expect(html).not.toContain('class="<span');
    expect(rendered(html)).not.toContain("text-muted-foreground");
    expect(rendered(html)).not.toContain("text-[var(");
  });

  it("round-trips arbitrary source unchanged once markup is stripped", () => {
    const code = [
      "--!strict",
      '-- Comment with "quotes" and 55 numbers',
      'local s = "-- not a comment"',
      "local n = 42.5",
      'local t = game:GetService("ReplicatedStorage")',
      "--[[ block\n comment ]]",
      "if a and not b then return end",
    ].join("\n");

    expect(rendered(highlight(code))).toBe(code);
  });

  it("does not treat a comment inside a string as a comment", () => {
    const html = highlight('local s = "-- not a comment"');
    // The whole literal is one string token, so no comment span is emitted.
    expect(html).not.toContain("text-muted-foreground");
  });

  it("escapes HTML in the source rather than letting it become markup", () => {
    const html = highlight("local x = a < b and c > d");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(rendered(html)).toBe("local x = a < b and c > d");
  });

  it("highlights comments, strings, keywords and numbers", () => {
    const html = highlight('local n = 1 -- hi\nlocal s = "x"');
    expect(html).toContain("text-muted-foreground/55 italic");
    expect(html).toContain("text-[var(--success)]");
    expect(html).toContain("text-[var(--ember)]");
    expect(html).toContain("text-[var(--warning)]");
  });

  it("emits exactly one entry per source line", () => {
    const code = "local a = 1\nlocal b = 2\n\nreturn a + b";
    expect(highlightLuauLines(code)).toHaveLength(4);
  });

  /**
   * Line-at-a-time highlighting cannot see that it is inside a block comment,
   * so continuation lines came back as ordinary code. Tokenising the buffer
   * once and splitting afterwards is what fixes it.
   */
  it("carries a block comment across the lines it spans", () => {
    const lines = highlightLuauLines("--[[\n  local x = 1\n]]\nlocal y = 2");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("text-muted-foreground/55 italic");
    // The keyword inside the comment is comment-coloured, not keyword-coloured.
    expect(lines[1]).not.toContain("text-[var(--ember)]");
    expect(lines[3]).toContain("text-[var(--ember)]");
  });

  it("carries a long-bracket string across lines", () => {
    const lines = highlightLuauLines('local s = [[\nend\n]]');
    expect(lines[1]).toContain("text-[var(--success)]");
    expect(lines[1]).not.toContain("text-[var(--ember)]");
  });

  it("leaves non-Luau files unhighlighted but escaped", () => {
    const lines = highlightLines("# Title <b>\nlocal x = 1", "docs/notes.md");
    expect(lines[0]).toBe("# Title &lt;b&gt;");
    expect(lines[1]).toBe("local x = 1");
  });

  it("highlights a single diff row in isolation", () => {
    expect(highlightFragment("local x = 1", "src/server/A.luau")).toContain("text-[var(--ember)]");
    expect(highlightFragment("local x = 1", "docs/A.md")).toBe("local x = 1");
  });
});
