import { describe, expect, it } from "vitest";
import {
  applyComment,
  applyEnter,
  applyMoveLines,
  applyTab,
  autoDedent,
  caretPosition,
  opensBlock,
} from "@/lib/editor/luau-editing";

/**
 * The editor's keys, tested as string transformations.
 *
 * `|` marks the caret and `[…]` a selection in these fixtures, so the intent of
 * each case is readable without counting offsets.
 */
function parse(fixture: string): { text: string; start: number; end: number } {
  if (fixture.includes("[")) {
    const start = fixture.indexOf("[");
    const end = fixture.indexOf("]") - 1;
    return { text: fixture.replace("[", "").replace("]", ""), start, end };
  }
  const start = fixture.indexOf("|");
  return { text: fixture.replace("|", ""), start, end: start };
}

function render(result: { text: string; selectionStart: number; selectionEnd: number }): string {
  const { text, selectionStart, selectionEnd } = result;
  if (selectionStart === selectionEnd) {
    return text.slice(0, selectionStart) + "|" + text.slice(selectionStart);
  }
  return (
    text.slice(0, selectionStart) +
    "[" +
    text.slice(selectionStart, selectionEnd) +
    "]" +
    text.slice(selectionEnd)
  );
}

const run = (
  fn: (text: string, start: number, end: number) => { text: string; selectionStart: number; selectionEnd: number },
  fixture: string,
) => {
  const { text, start, end } = parse(fixture);
  return render(fn(text, start, end));
};

describe("caretPosition", () => {
  it("is 1-based on both axes", () => {
    expect(caretPosition("abc", 0)).toEqual({ line: 1, column: 1 });
    expect(caretPosition("abc\ndef", 5)).toEqual({ line: 2, column: 2 });
  });

  it("puts the caret at the start of a line it has just wrapped onto", () => {
    expect(caretPosition("a\nb", 2)).toEqual({ line: 2, column: 1 });
  });
});

describe("Tab", () => {
  it("advances to the next tab stop rather than inserting a fixed width", () => {
    expect(run((t, s, e) => applyTab(t, s, e, false), "l|ocal")).toBe("l |ocal");
    expect(run((t, s, e) => applyTab(t, s, e, false), "|local")).toBe("  |local");
  });

  it("indents every line of a multi-line selection", () => {
    const result = run((t, s, e) => applyTab(t, s, e, false), "[local a = 1\nlocal b = 2]");
    expect(result).toBe("  [local a = 1\n  local b = 2]");
  });

  it("outdents a block, and stops at column zero", () => {
    const once = applyTab("    local a = 1\n    local b = 2", 0, 31, true);
    expect(once.text).toBe("  local a = 1\n  local b = 2");
    const twice = applyTab(once.text, 0, once.text.length, true);
    expect(twice.text).toBe("local a = 1\nlocal b = 2");
    const thrice = applyTab(twice.text, 0, twice.text.length, true);
    expect(thrice.text).toBe("local a = 1\nlocal b = 2");
  });

  it("leaves blank lines alone when indenting a block", () => {
    const result = applyTab("local a = 1\n\nlocal b = 2", 0, 24, false);
    expect(result.text).toBe("  local a = 1\n\n  local b = 2");
  });

  it("outdents the current line with a collapsed selection", () => {
    expect(run((t, s, e) => applyTab(t, s, e, true), "    local| a")).toBe("  local| a");
  });

  it("does not select the line below when the selection ends on a newline", () => {
    const result = applyTab("a\nb\nc", 0, 2, false);
    expect(result.text).toBe("  a\nb\nc");
  });
});

describe("Enter", () => {
  it("carries the current indentation", () => {
    expect(run(applyEnter, "    local a = 1|")).toBe("    local a = 1\n    |");
  });

  it("adds a level after a block opener", () => {
    expect(run(applyEnter, "if ready then|")).toBe("if ready then\n  |");
    expect(run(applyEnter, "  for i = 1, 10 do|")).toBe("  for i = 1, 10 do\n    |");
    expect(run(applyEnter, "local function step(dt)|")).toBe("local function step(dt)\n  |");
    expect(run(applyEnter, "  repeat|")).toBe("  repeat\n    |");
    expect(run(applyEnter, "local t = {|")).toBe("local t = {\n  |");
  });

  it("does not indent after a line that merely mentions a keyword", () => {
    expect(run(applyEnter, 'print("then")|')).toBe('print("then")\n|');
    expect(run(applyEnter, "local thenValue = 1|")).toBe("local thenValue = 1\n|");
  });

  it("ignores a trailing comment when deciding", () => {
    expect(run(applyEnter, "if ready then -- go|")).toBe("if ready then -- go\n  |");
    expect(run(applyEnter, "local a = 1 -- then|")).toBe("local a = 1 -- then\n|");
  });

  it("replaces the selection", () => {
    expect(run(applyEnter, "local [a]bc")).toBe("local \n|bc");
  });
});

describe("autoDedent", () => {
  it("pulls a completed closer back one level", () => {
    const result = autoDedent("if a then\n    end", 17);
    expect(result?.text).toBe("if a then\n  end");
    expect(result?.selectionStart).toBe(15);
  });

  it("handles else, elseif, until and a brace", () => {
    for (const word of ["else", "elseif", "until", "}"]) {
      const text = `x\n  ${word}`;
      expect(autoDedent(text, text.length)?.text).toBe(`x\n${word}`);
    }
  });

  it("declines at column zero", () => {
    expect(autoDedent("end", 3)).toBeNull();
  });

  it("declines when the closer is not alone on its line", () => {
    expect(autoDedent("  local x = 1 end", 17)).toBeNull();
    expect(autoDedent("  ending", 8)).toBeNull();
  });
});

describe("comment toggle", () => {
  it("comments a single line at its own indent", () => {
    expect(applyComment("  local a = 1", 4, 4).text).toBe("  -- local a = 1");
  });

  it("uncomments when every selected line is already commented", () => {
    const commented = "-- local a = 1\n-- local b = 2";
    expect(applyComment(commented, 0, commented.length).text).toBe("local a = 1\nlocal b = 2");
  });

  it("comments the whole block when only some lines are commented", () => {
    const mixed = "-- local a = 1\nlocal b = 2";
    expect(applyComment(mixed, 0, mixed.length).text).toBe("-- -- local a = 1\n-- local b = 2");
  });

  it("leaves blank lines untouched", () => {
    const text = "local a = 1\n\nlocal b = 2";
    expect(applyComment(text, 0, text.length).text).toBe("-- local a = 1\n\n-- local b = 2");
  });

  it("round-trips", () => {
    const text = "  local a = 1\n  local b = 2";
    const commented = applyComment(text, 0, text.length);
    const back = applyComment(commented.text, 0, commented.text.length);
    expect(back.text).toBe(text);
  });
});

describe("move lines", () => {
  it("moves a line up", () => {
    const result = applyMoveLines("a\nb\nc", 2, 2, -1);
    expect(result.text).toBe("b\na\nc");
    expect(result.selectionStart).toBe(0);
  });

  it("moves a line down", () => {
    expect(applyMoveLines("a\nb\nc", 0, 0, 1).text).toBe("b\na\nc");
  });

  it("moves a selected block as one unit", () => {
    // Lines 2 and 3 ("b" and "c") move below "d".
    expect(applyMoveLines("a\nb\nc\nd", 2, 5, 1).text).toBe("a\nd\nb\nc");
  });

  it("refuses to move past the top or bottom", () => {
    expect(applyMoveLines("a\nb", 0, 0, -1).text).toBe("a\nb");
    expect(applyMoveLines("a\nb", 2, 2, 1).text).toBe("a\nb");
  });
});

describe("opensBlock", () => {
  it("recognises Luau's openers and not their lookalikes", () => {
    expect(opensBlock("if x then")).toBe(true);
    expect(opensBlock("while true do")).toBe(true);
    expect(opensBlock("function f()")).toBe(true);
    expect(opensBlock("local t = {")).toBe(true);
    expect(opensBlock("local x = 1")).toBe(false);
    expect(opensBlock("end")).toBe(false);
  });
});
