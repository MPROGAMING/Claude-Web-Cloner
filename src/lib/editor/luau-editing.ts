/**
 * Text transformations behind the editor's keys.
 *
 * Pure string in, string out, with the resulting selection. Keeping them out of
 * the component is what makes them testable: "Tab indents the selected block"
 * is a fact about text, and proving it should not require a DOM, a textarea or
 * a synthetic keyboard event.
 *
 * The rules are Luau's, not a generic editor's. Luau blocks open with `then`,
 * `do`, `function` and `repeat` and close with `end` and `until`, and an editor
 * that only understands braces leaves a Roblox script badly indented in exactly
 * the places that matter.
 */

export const INDENT = "  ";

export interface EditResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export interface CaretPosition {
  line: number;
  column: number;
}

export function caretPosition(text: string, index: number): CaretPosition {
  const clamped = Math.max(0, Math.min(index, text.length));
  const start = text.lastIndexOf("\n", clamped - 1) + 1;
  let line = 1;
  for (let i = 0; i < start; i += 1) if (text[i] === "\n") line += 1;
  return { line, column: clamped - start + 1 };
}

function lineStartAt(text: string, index: number): number {
  return text.lastIndexOf("\n", index - 1) + 1;
}

function lineEndAt(text: string, index: number): number {
  const end = text.indexOf("\n", index);
  return end === -1 ? text.length : end;
}

/** Indexes of every line the selection touches, as [start, end] offsets. */
function selectedLines(text: string, start: number, end: number): { from: number; to: number } {
  const from = lineStartAt(text, start);
  // A selection ending exactly at a line start has not touched that line.
  const adjusted = end > start && text[end - 1] === "\n" ? end - 1 : end;
  return { from, to: lineEndAt(text, adjusted) };
}

function leadingWhitespace(line: string): string {
  return /^[ \t]*/.exec(line)?.[0] ?? "";
}

/**
 * Tab and Shift-Tab.
 *
 * A collapsed selection inserts to the next tab stop rather than a fixed two
 * spaces, so pressing Tab in the middle of a line lands on the column the rest
 * of the file uses. A selection spanning lines indents the block, which is the
 * only behaviour anyone wants once there is more than one line selected.
 */
export function applyTab(
  text: string,
  start: number,
  end: number,
  outdent: boolean,
): EditResult {
  const multiline = text.slice(start, end).includes("\n");

  if (!multiline && !outdent) {
    const column = start - lineStartAt(text, start);
    const spaces = INDENT.length - (column % INDENT.length);
    const insert = " ".repeat(spaces);
    return {
      text: text.slice(0, start) + insert + text.slice(end),
      selectionStart: start + spaces,
      selectionEnd: start + spaces,
    };
  }

  const { from, to } = selectedLines(text, start, end);
  const block = text.slice(from, to);
  const lines = block.split("\n");

  let firstDelta = 0;
  let totalDelta = 0;

  const rewritten = lines.map((line, index) => {
    if (outdent) {
      const removable = /^( {1,2}|\t)/.exec(line)?.[0] ?? "";
      if (index === 0) firstDelta = -removable.length;
      totalDelta -= removable.length;
      return line.slice(removable.length);
    }
    // Indenting a blank line just leaves trailing whitespace behind.
    if (line.trim() === "") return line;
    if (index === 0) firstDelta = INDENT.length;
    totalDelta += INDENT.length;
    return INDENT + line;
  });

  const next = text.slice(0, from) + rewritten.join("\n") + text.slice(to);
  return {
    text: next,
    selectionStart: Math.max(from, start + firstDelta),
    selectionEnd: Math.max(from, end + totalDelta),
  };
}

const BLOCK_OPENERS = [
  /\bthen\s*$/,
  /\bdo\s*$/,
  /\belse\s*$/,
  /\brepeat\s*$/,
  /\bfunction\b[^\n]*\)\s*$/,
  /[{([]\s*$/,
];

/** Does this line, up to the caret, open a block? */
export function opensBlock(lineToCaret: string): boolean {
  // A trailing comment does not change the block structure.
  const code = lineToCaret.replace(/--(?!\[\[)[^\n]*$/, "");
  return BLOCK_OPENERS.some((pattern) => pattern.test(code));
}

/** Enter: carry the current indent, and add one level after a block opener. */
export function applyEnter(text: string, start: number, end: number): EditResult {
  const lineStart = lineStartAt(text, start);
  const toCaret = text.slice(lineStart, start);
  const indent = leadingWhitespace(toCaret) + (opensBlock(toCaret) ? INDENT : "");
  const insert = `\n${indent}`;

  return {
    text: text.slice(0, start) + insert + text.slice(end),
    selectionStart: start + insert.length,
    selectionEnd: start + insert.length,
  };
}

const CLOSERS = /^([ \t]+)(end|else|elseif|until|\})$/;

/**
 * Pull a line that has just become a block closer back one level.
 *
 * Typed rather than pressed, so it has to be recognised from the text: the
 * caller only offers a line once, which is what stops `else` → `elseif` from
 * dedenting twice on the way through.
 */
export function autoDedent(text: string, caret: number): EditResult | null {
  const lineStart = lineStartAt(text, caret);
  const toCaret = text.slice(lineStart, caret);
  const match = CLOSERS.exec(toCaret);
  if (!match) return null;

  const indent = match[1];
  if (indent.length === 0) return null;

  const removed = indent.endsWith(INDENT) ? INDENT.length : Math.min(indent.length, INDENT.length);
  const next = text.slice(0, lineStart) + toCaret.slice(removed) + text.slice(caret);
  const position = caret - removed;

  return { text: next, selectionStart: position, selectionEnd: position };
}

/** Toggle `--` comments over the selected lines. */
export function applyComment(text: string, start: number, end: number): EditResult {
  const { from, to } = selectedLines(text, start, end);
  const lines = text.slice(from, to).split("\n");
  const meaningful = lines.filter((line) => line.trim() !== "");
  if (meaningful.length === 0) return { text, selectionStart: start, selectionEnd: end };

  const allCommented = meaningful.every((line) => /^\s*--/.test(line));

  let firstDelta = 0;
  let totalDelta = 0;

  const rewritten = lines.map((line, index) => {
    if (line.trim() === "") return line;

    if (allCommented) {
      const stripped = line.replace(/^(\s*)--\s?/, "$1");
      const delta = stripped.length - line.length;
      if (index === 0) firstDelta = delta;
      totalDelta += delta;
      return stripped;
    }

    const indent = leadingWhitespace(line);
    const commented = `${indent}-- ${line.slice(indent.length)}`;
    if (index === 0) firstDelta = 3;
    totalDelta += 3;
    return commented;
  });

  return {
    text: text.slice(0, from) + rewritten.join("\n") + text.slice(to),
    selectionStart: Math.max(from, start + firstDelta),
    selectionEnd: Math.max(from, end + totalDelta),
  };
}

/** Move the selected lines up or down one line, keeping them selected. */
export function applyMoveLines(
  text: string,
  start: number,
  end: number,
  direction: -1 | 1,
): EditResult {
  const lines = text.split("\n");
  const first = caretPosition(text, start).line - 1;
  const last = caretPosition(text, Math.max(start, end - (text[end - 1] === "\n" ? 1 : 0))).line - 1;

  const target = direction === -1 ? first - 1 : last + 1;
  if (target < 0 || target >= lines.length) {
    return { text, selectionStart: start, selectionEnd: end };
  }

  const block = lines.slice(first, last + 1);
  const rest = [...lines.slice(0, first), ...lines.slice(last + 1)];
  const insertAt = direction === -1 ? first - 1 : first + 1;
  rest.splice(insertAt, 0, ...block);

  const next = rest.join("\n");
  const shift = direction === -1 ? -(lines[first - 1].length + 1) : lines[last + 1].length + 1;

  return {
    text: next,
    selectionStart: Math.max(0, start + shift),
    selectionEnd: Math.max(0, end + shift),
  };
}
