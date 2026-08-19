/**
 * Luau syntax highlighting.
 *
 * A tokenizer rather than a grammar: the editor must stay responsive while a
 * file streams in, and a full re-parse of the buffer on every chunk is exactly
 * what makes an editor feel slow.
 *
 * It lives here, not inside a component, for two reasons. The viewer and the
 * diff view must colour the same code identically — two highlighters would
 * drift — and the one bug this code has already shipped (below) was invisible
 * to tests while the function was private to a client component.
 */

/**
 * Order is significant. The first alternative to match at a position wins, so
 * comments must precede strings (a comment may contain quotes) and both must
 * precede keywords and numbers.
 *
 * None of these may contain a capturing group — they are combined into one
 * alternation below, and the group index is what identifies the token kind.
 */
export const TOKEN_PATTERNS: { pattern: string; className: string }[] = [
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

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Is this path something the Luau rules should be applied to? */
export function isLuauPath(path: string): boolean {
  return /\.luau?$/i.test(path);
}

/**
 * Tokenise in a single pass, emitting one HTML string per source line.
 *
 * Running the patterns one after another over the accumulated HTML makes the
 * highlighter re-scan its own output: the string rule matches the quoted class
 * name inside a `<span class="…">` emitted by the comment rule, nests a span
 * inside an attribute, and the browser renders the class name as source code.
 * Every Luau comment displayed wrong because of it. Matching once and emitting
 * once means generated markup is never treated as input.
 *
 * Whole-file rather than line-by-line for the same reason a lexer is: `--[[`
 * and `[[` run past the newline, and a highlighter restarted on every line
 * cannot see that it is still inside one. Tokens are split across the line
 * buffers after they are matched, never before.
 */
export function highlightLuauLines(source: string): string[] {
  const lines: string[] = [""];

  const emit = (text: string, className?: string) => {
    const parts = text.split("\n");
    for (let i = 0; i < parts.length; i += 1) {
      if (i > 0) lines.push("");
      if (parts[i] === "") continue;
      const escaped = escapeHtml(parts[i]);
      lines[lines.length - 1] += className ? `<span class="${className}">${escaped}</span>` : escaped;
    }
  };

  let last = 0;
  TOKEN_RE.lastIndex = 0;
  for (let match = TOKEN_RE.exec(source); match !== null; match = TOKEN_RE.exec(source)) {
    const kind = match.slice(1).findIndex((group) => group !== undefined);
    if (kind === -1) continue;

    emit(source.slice(last, match.index));
    emit(match[0], TOKEN_PATTERNS[kind].className);
    last = match.index + match[0].length;

    // A zero-length match would spin forever; nudge past it.
    if (match[0].length === 0) TOKEN_RE.lastIndex += 1;
  }
  emit(source.slice(last));

  return lines;
}

/** Highlighted lines for any file: Luau rules where they apply, escaped text otherwise. */
export function highlightLines(source: string, path: string): string[] {
  if (isLuauPath(path)) return highlightLuauLines(source);
  return source.split("\n").map(escapeHtml);
}

/**
 * A single line highlighted in isolation.
 *
 * For diff rows, where each line is already its own row and there is no
 * surrounding buffer to carry a block comment's state.
 */
export function highlightFragment(line: string, path: string): string {
  if (!isLuauPath(path)) return escapeHtml(line);
  return highlightLuauLines(line)[0] ?? "";
}
