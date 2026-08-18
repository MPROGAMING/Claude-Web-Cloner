import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The Luau highlighter, exercised directly.
 *
 * A sequential highlighter re-scans the HTML it has already produced: the
 * string rule matches the quoted class name inside a `<span class="…">` emitted
 * by the comment rule, and the class name renders as source code. It showed up
 * on the very first real generated file — every comment line was corrupted —
 * and no test could see it, because the tokeniser was a private function inside
 * a client component.
 *
 * The patterns are read from the component source so the two cannot drift.
 */

const source = readFileSync("src/components/workspace/code-viewer.tsx", "utf8");

/** Rebuild the tokeniser exactly as the component defines it. */
function buildHighlighter() {
  const block = source.slice(
    source.indexOf("const TOKEN_PATTERNS"),
    source.indexOf("const TOKEN_RE"),
  );

  const patterns = [...block.matchAll(/pattern: String\.raw`([\s\S]*?)`,\s*\n?\s*className: "([^"]+)"/g)].map(
    (m) => ({ pattern: m[1], className: m[2] }),
  );
  expect(patterns.length).toBeGreaterThanOrEqual(5);

  const re = new RegExp(patterns.map((t) => `(${t.pattern})`).join("|"), "g");

  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return (input: string) => {
    let html = "";
    let last = 0;
    re.lastIndex = 0;
    for (let match = re.exec(input); match !== null; match = re.exec(input)) {
      const kind = match.slice(1).findIndex((g) => g !== undefined);
      if (kind === -1) continue;
      html += escapeHtml(input.slice(last, match.index));
      html += `<span class="${patterns[kind].className}">${escapeHtml(match[0])}</span>`;
      last = match.index + match[0].length;
      if (match[0].length === 0) re.lastIndex += 1;
    }
    return html + escapeHtml(input.slice(last));
  };
}

const highlight = buildHighlighter();

/** Text as the browser would show it, with all markup removed. */
function rendered(html: string): string {
  return html.replace(/<span class="[^"]*">/g, "").replace(/<\/span>/g, "");
}

describe("Luau highlighting", () => {
  it("never leaks a CSS class name into the displayed code", () => {
    const code = '--!strict\nlocal x = 1 -- a comment\n';
    const html = highlight(code);

    expect(rendered(html)).toBe(code);
    expect(html).not.toContain('class="<span');
    expect(rendered(html)).not.toContain("text-muted-foreground");
    expect(rendered(html)).not.toContain("text-[var(");
  });

  it("round-trips arbitrary source unchanged once markup is stripped", () => {
    const code = [
      "--!strict",
      "-- Comment with \"quotes\" and 55 numbers",
      'local s = "-- not a comment"',
      "local n = 42.5",
      "local t = game:GetService(\"ReplicatedStorage\")",
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
    expect(rendered(html)).toBe("local x = a &lt; b and c &gt; d");
  });

  it("highlights comments, strings, keywords and numbers", () => {
    const html = highlight('local n = 1 -- hi\nlocal s = "x"');
    expect(html).toContain("text-muted-foreground/55 italic");
    expect(html).toContain("text-[var(--success)]");
    expect(html).toContain("text-[var(--ember)]");
    expect(html).toContain("text-[var(--warning)]");
  });
});
